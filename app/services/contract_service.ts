import { createHash } from 'node:crypto'
import RuleViolation from '#exceptions/rule_violation'
import Approval from '#models/approval'
import Contract from '#models/contract'
import ContractTemplate from '#models/contract_template'
import ContractVersion from '#models/contract_version'
import Workflow from '#models/workflow'
import { recordAudit } from '#services/audit'
import { renderTemplate } from '#services/template_service'
import type { ContractType } from '#services/vocabulary'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

/** Fins de ligne et espaces finaux ne font pas une nouvelle version. */
export function normalizeBody(body: string) {
  return body.replace(/\r\n?/g, '\n').trimEnd()
}

export function checksumOf(body: string) {
  return createHash('sha256').update(normalizeBody(body), 'utf8').digest('hex')
}

/**
 * Verrouille la ligne du contrat pour la durée de la transaction. Toute action qui change l'état
 * d'un contrat passe par ici : deux actions simultanées sur le même contrat s'exécutent l'une
 * après l'autre, et la seconde voit l'état laissé par la première.
 */
export function lockContract(trx: TransactionClientContract, organizationId: number, id: number) {
  return Contract.query({ client: trx })
    .where('id', id)
    .where('organization_id', organizationId)
    .forUpdate()
    .firstOrFail()
}

export function latestVersion(trx: TransactionClientContract, contractId: number) {
  return ContractVersion.query({ client: trx })
    .where('contract_id', contractId)
    .orderBy('number', 'desc')
    .firstOrFail()
}

export default class ContractService {
  async create(
    organizationId: number,
    actorId: number,
    input: {
      title: string
      counterparty: string
      type: ContractType
      body: string
      templateId?: number | null
    }
  ) {
    return db.transaction(async (trx) => {
      const contract = await Contract.create(
        {
          organizationId,
          title: input.title,
          counterparty: input.counterparty,
          type: input.type,
          status: 'draft',
          reviewRound: 0,
          createdBy: actorId,
          templateId: input.templateId ?? null,
        },
        { client: trx }
      )
      await this.#addVersion(trx, contract.id, 1, actorId, input.body, null)
      await recordAudit(trx, {
        organizationId,
        actorId,
        action: 'contract.created',
        subject: { type: 'contract', id: contract.id },
        metadata: {
          title: input.title,
          type: input.type,
          templateId: input.templateId ?? null,
        },
      })
      return contract
    })
  }

  /**
   * Crée un contrat depuis un modèle de l'organisation. Le texte est rempli une fois pour
   * toutes : le contrat ne suit pas les évolutions ultérieures du modèle.
   */
  async createFromTemplate(
    organizationId: number,
    actorId: number,
    input: {
      templateId: number
      title: string
      counterparty: string
      values: Record<string, string>
    }
  ) {
    const template = await ContractTemplate.query()
      .where('id', input.templateId)
      .where('organization_id', organizationId)
      .firstOrFail()
    return this.create(organizationId, actorId, {
      title: input.title,
      counterparty: input.counterparty,
      type: template.type,
      body: renderTemplate(template.body, input.values),
      templateId: template.id,
    })
  }

  /**
   * Modifier un contrat, c'est lui ajouter une version. Impossible pendant une validation
   * (les approbateurs lisent tous le même texte). Réviser un contrat approuvé ou rejeté le
   * remet en brouillon : une approbation vaut pour une version, pas pour les suivantes.
   */
  async revise(
    organizationId: number,
    contractId: number,
    actorId: number,
    input: { body: string; changeNote: string | null }
  ) {
    return db.transaction(async (trx) => {
      const contract = await lockContract(trx, organizationId, contractId)
      if (contract.status === 'in_review') {
        throw new RuleViolation(
          'contract_in_review',
          'Ce contrat est en cours de validation : il ne peut pas être modifié.'
        )
      }
      if (contract.status === 'signing') {
        throw new RuleViolation(
          'contract_in_signature',
          'Ce contrat est en cours de signature : annulez la demande avant de le modifier.'
        )
      }
      if (contract.status === 'signed') {
        throw new RuleViolation(
          'contract_signed',
          'Ce contrat est signé : il ne peut plus changer.'
        )
      }
      const previous = await latestVersion(trx, contract.id)
      if (previous.checksum === checksumOf(input.body)) {
        throw new RuleViolation('no_change', 'Le texte est identique à la dernière version.')
      }

      const version = await this.#addVersion(
        trx,
        contract.id,
        previous.number + 1,
        actorId,
        input.body,
        input.changeNote
      )
      const reopened = contract.status !== 'draft'
      contract.status = 'draft'
      await contract.save()
      await recordAudit(trx, {
        organizationId,
        actorId,
        action: 'contract.revised',
        subject: { type: 'contract', id: contract.id },
        metadata: { version: version.number, reopened },
      })
      return version
    })
  }

  /**
   * Ouvre un tour de validation : les étapes du circuit sont copiées dans `approvals`,
   * attachées à la version soumise. Modifier le circuit ensuite ne change pas ce tour.
   */
  async submit(organizationId: number, contractId: number, actorId: number, workflowId: number) {
    return db.transaction(async (trx) => {
      const contract = await lockContract(trx, organizationId, contractId)
      if (contract.status !== 'draft') {
        throw new RuleViolation(
          'contract_not_draft',
          'Seul un brouillon peut être soumis à validation.'
        )
      }
      const workflow = await Workflow.query({ client: trx })
        .where('id', workflowId)
        .where('organization_id', organizationId)
        .preload('steps')
        .firstOrFail()
      if (workflow.steps.length === 0) {
        throw new RuleViolation('workflow_without_steps', "Ce circuit n'a aucune étape.", 422)
      }

      const version = await latestVersion(trx, contract.id)
      const round = contract.reviewRound + 1
      await Approval.createMany(
        workflow.steps.map((step) => ({
          contractId: contract.id,
          contractVersionId: version.id,
          round,
          position: step.position,
          stepName: step.name,
          approverRole: step.approverRole,
          status: 'pending' as const,
        })),
        { client: trx }
      )
      contract.merge({ status: 'in_review', workflowId: workflow.id, reviewRound: round })
      await contract.save()
      await recordAudit(trx, {
        organizationId,
        actorId,
        action: 'contract.submitted',
        subject: { type: 'contract', id: contract.id },
        metadata: { version: version.number, round, workflow: workflow.name },
      })
      return contract
    })
  }

  #addVersion(
    trx: TransactionClientContract,
    contractId: number,
    number: number,
    authorId: number,
    body: string,
    changeNote: string | null
  ) {
    const normalized = normalizeBody(body)
    return ContractVersion.create(
      {
        contractId,
        number,
        body: normalized,
        changeNote,
        authorId,
        checksum: checksumOf(normalized),
      },
      { client: trx }
    )
  }
}
