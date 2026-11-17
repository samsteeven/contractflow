import RuleViolation from '#exceptions/rule_violation'
import type Contract from '#models/contract'
import ContractTerm from '#models/contract_term'
import Membership from '#models/membership'
import Obligation from '#models/obligation'
import { recordAudit } from '#services/audit'
import { lockContract } from '#services/contract_service'
import {
  ADMIN_ROLES,
  MANUAL_OBLIGATION_KINDS,
  type ObligationKind,
  type Role,
} from '#services/vocabulary'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

/** Une date calendaire `yyyy-MM-dd`, sans heure ni fuseau : une échéance est un jour. */
export function parseDay(value: string, field: string) {
  const day = DateTime.fromISO(value, { zone: 'utc' })
  if (!day.isValid || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RuleViolation('invalid_term', `Date invalide : ${field}.`, 422)
  }
  return day.startOf('day')
}

type TermInput = {
  startsOn: string
  endsOn: string
  autoRenew: boolean
  noticeDays: number
  renewalMonths: number | null
  assigneeId: number
}

export default class ObligationService {
  /**
   * Fixe la durée d'un contrat signé et en déduit son échéance : une obligation « préavis de
   * reconduction » quand le contrat se reconduit seul, « fin du contrat » sinon, datée de la fin
   * moins le préavis. Le contrat est figé, mais sa durée vit dans une table à part.
   */
  async setTerm(organizationId: number, contractId: number, actorId: number, input: TermInput) {
    const startsOn = parseDay(input.startsOn, 'début')
    const endsOn = parseDay(input.endsOn, 'fin')
    if (endsOn <= startsOn) {
      throw new RuleViolation('invalid_term', 'La fin doit suivre le début.', 422)
    }
    if (input.autoRenew && !input.renewalMonths) {
      throw new RuleViolation(
        'invalid_term',
        'Une reconduction automatique demande une durée de reconduction.',
        422
      )
    }

    return db.transaction(async (trx) => {
      const contract = await this.#signedContract(trx, organizationId, contractId)
      if (await ContractTerm.query({ client: trx }).where('contract_id', contract.id).first()) {
        throw new RuleViolation('term_exists', 'La durée de ce contrat est déjà définie.')
      }
      await this.#assertMember(trx, organizationId, input.assigneeId)

      const term = await ContractTerm.create(
        {
          contractId: contract.id,
          startsOn,
          endsOn,
          autoRenew: input.autoRenew,
          noticeDays: input.noticeDays,
          renewalMonths: input.autoRenew || input.renewalMonths ? input.renewalMonths : null,
          status: 'active',
          createdBy: actorId,
        },
        { client: trx }
      )
      await this.#scheduleTermEnd(trx, contract, term, input.assigneeId, actorId)
      await recordAudit(trx, {
        organizationId,
        actorId,
        action: 'term.set',
        subject: { type: 'contract', id: contract.id },
        metadata: { endsOn: input.endsOn, autoRenew: input.autoRenew },
      })
      return term
    })
  }

  async addObligation(
    organizationId: number,
    contractId: number,
    actorId: number,
    input: {
      title: string
      kind: ObligationKind
      dueOn: string
      assigneeId: number
      notes: string | null
    }
  ) {
    const dueOn = parseDay(input.dueOn, 'échéance')
    if (!MANUAL_OBLIGATION_KINDS.includes(input.kind)) {
      throw new RuleViolation(
        'invalid_obligation',
        'Le préavis de reconduction se déduit de la durée du contrat : il ne se crée pas à la main.',
        422
      )
    }
    return db.transaction(async (trx) => {
      const contract = await this.#signedContract(trx, organizationId, contractId)
      await this.#assertMember(trx, organizationId, input.assigneeId)
      const obligation = await Obligation.create(
        {
          organizationId,
          contractId: contract.id,
          title: input.title.trim(),
          kind: input.kind,
          dueOn,
          assigneeId: input.assigneeId,
          status: 'open',
          notes: input.notes?.trim() || null,
          createdBy: actorId,
        },
        { client: trx }
      )
      await recordAudit(trx, {
        organizationId,
        actorId,
        action: 'obligation.created',
        subject: { type: 'obligation', id: obligation.id },
        metadata: { contractId: contract.id, title: obligation.title, dueOn: input.dueOn },
      })
      return obligation
    })
  }

  /** Seul le responsable ou un administrateur clôt une obligation, une seule fois. */
  async complete(
    organizationId: number,
    contractId: number,
    obligationId: number,
    actor: { id: number; role: Role }
  ) {
    return db.transaction(async (trx) => {
      const contract = await lockContract(trx, organizationId, contractId)
      const obligation = await this.#openObligation(trx, contract, obligationId)
      if (obligation.assigneeId !== actor.id && !ADMIN_ROLES.includes(actor.role)) {
        throw new RuleViolation(
          'not_assignee',
          'Seul le responsable ou un administrateur peut clore cette obligation.',
          403
        )
      }
      obligation.merge({ status: 'done', completedAt: DateTime.utc(), completedBy: actor.id })
      await obligation.save()
      await recordAudit(trx, {
        organizationId,
        actorId: actor.id,
        action: 'obligation.completed',
        subject: { type: 'obligation', id: obligation.id },
        metadata: { contractId: contract.id, title: obligation.title },
      })
      return obligation
    })
  }

  /** Annuler (l'obligation n'a plus lieu d'être) : son créateur ou un administrateur. */
  async cancel(
    organizationId: number,
    contractId: number,
    obligationId: number,
    actor: { id: number; role: Role }
  ) {
    return db.transaction(async (trx) => {
      const contract = await lockContract(trx, organizationId, contractId)
      const obligation = await this.#openObligation(trx, contract, obligationId)
      if (obligation.createdBy !== actor.id && !ADMIN_ROLES.includes(actor.role)) {
        throw new RuleViolation(
          'not_assignee',
          'Seul son créateur ou un administrateur peut annuler cette obligation.',
          403
        )
      }
      obligation.status = 'cancelled'
      await obligation.save()
      await recordAudit(trx, {
        organizationId,
        actorId: actor.id,
        action: 'obligation.cancelled',
        subject: { type: 'obligation', id: obligation.id },
        metadata: { contractId: contract.id, title: obligation.title },
      })
      return obligation
    })
  }

  /**
   * Reconduit le contrat : la fin recule de la durée de reconduction, l'échéance en cours est
   * close et la suivante est créée. Sous le verrou du contrat, deux reconductions simultanées
   * ne s'additionnent pas : la seconde voit la nouvelle fin et recule encore, sciemment, une
   * action = une reconduction.
   */
  async renew(organizationId: number, contractId: number, actorId: number) {
    return db.transaction(async (trx) => {
      const contract = await this.#signedContract(trx, organizationId, contractId)
      const term = await this.#activeTerm(trx, contract)
      if (!term.renewalMonths) {
        throw new RuleViolation(
          'no_renewal_term',
          "Ce contrat n'a pas de durée de reconduction.",
          422
        )
      }
      const open = await this.#openEndObligation(trx, contract.id)
      const assigneeId = open?.assigneeId ?? actorId
      await this.#closeEndObligation(open, actorId, 'done')

      term.endsOn = term.endsOn.plus({ months: term.renewalMonths })
      await term.save()
      await this.#scheduleTermEnd(trx, contract, term, assigneeId, actorId)
      await recordAudit(trx, {
        organizationId,
        actorId,
        action: 'term.renewed',
        subject: { type: 'contract', id: contract.id },
        metadata: { endsOn: term.endsOn.toISODate() },
      })
      return term
    })
  }

  /** Met fin au contrat : plus d'échéance de fin à surveiller. */
  async terminate(organizationId: number, contractId: number, actorId: number) {
    return db.transaction(async (trx) => {
      const contract = await this.#signedContract(trx, organizationId, contractId)
      const term = await this.#activeTerm(trx, contract)
      await this.#closeEndObligation(
        await this.#openEndObligation(trx, contract.id),
        actorId,
        'cancelled'
      )
      term.status = 'terminated'
      await term.save()
      await recordAudit(trx, {
        organizationId,
        actorId,
        action: 'term.terminated',
        subject: { type: 'contract', id: contract.id },
      })
      return term
    })
  }

  async #signedContract(trx: TransactionClientContract, organizationId: number, id: number) {
    const contract = await lockContract(trx, organizationId, id)
    if (contract.status !== 'signed') {
      throw new RuleViolation(
        'contract_not_signed',
        'Le suivi des obligations commence quand le contrat est signé.'
      )
    }
    return contract
  }

  async #activeTerm(trx: TransactionClientContract, contract: Contract) {
    const term = await ContractTerm.query({ client: trx }).where('contract_id', contract.id).first()
    if (!term) throw new RuleViolation('no_term', "La durée de ce contrat n'est pas définie.")
    if (term.status !== 'active') {
      throw new RuleViolation('term_terminated', 'Ce contrat est terminé.')
    }
    return term
  }

  async #assertMember(trx: TransactionClientContract, organizationId: number, userId: number) {
    const membership = await Membership.query({ client: trx })
      .where('organization_id', organizationId)
      .where('user_id', userId)
      .first()
    if (!membership) {
      throw new RuleViolation(
        'unknown_assignee',
        "Le responsable doit faire partie de l'organisation.",
        422
      )
    }
  }

  async #openObligation(trx: TransactionClientContract, contract: Contract, id: number) {
    const obligation = await Obligation.query({ client: trx })
      .where('id', id)
      .where('contract_id', contract.id)
      .where('organization_id', contract.organizationId)
      .firstOrFail()
    if (obligation.status !== 'open') {
      throw new RuleViolation('obligation_closed', 'Cette obligation est déjà close.')
    }
    return obligation
  }

  #openEndObligation(trx: TransactionClientContract, contractId: number) {
    return Obligation.query({ client: trx })
      .where('contract_id', contractId)
      .where('kind', 'renewal_notice')
      .where('status', 'open')
      .first()
  }

  async #closeEndObligation(
    obligation: Obligation | null,
    actorId: number,
    status: 'done' | 'cancelled'
  ) {
    if (!obligation) return
    obligation.status = status
    if (status === 'done') obligation.merge({ completedAt: DateTime.utc(), completedBy: actorId })
    await obligation.save()
  }

  /** L'échéance de fin : fin moins préavis, au plus tôt aujourd'hui n'est pas imposé (le passé reste visible, en retard). */
  async #scheduleTermEnd(
    trx: TransactionClientContract,
    contract: Contract,
    term: ContractTerm,
    assigneeId: number,
    actorId: number
  ) {
    await Obligation.create(
      {
        organizationId: contract.organizationId,
        contractId: contract.id,
        title: term.autoRenew
          ? 'Préavis de non-reconduction : décider avant cette date'
          : 'Fin du contrat : renouveler ou clore',
        kind: 'renewal_notice',
        dueOn: term.endsOn.minus({ days: term.noticeDays }),
        assigneeId,
        status: 'open',
        notes: `Fin du contrat le ${term.endsOn.toISODate()}.`,
        createdBy: actorId,
      },
      { client: trx }
    )
  }
}
