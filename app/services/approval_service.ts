import RuleViolation from '#exceptions/rule_violation'
import Approval from '#models/approval'
import ContractVersion from '#models/contract_version'
import { recordAudit } from '#services/audit'
import { lockContract } from '#services/contract_service'
import type { Role } from '#services/vocabulary'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

export type Decision = 'approve' | 'reject'

/** L'étape active d'un tour : la première encore en attente. Aucune si le tour est clos. */
export function activeStep(approvals: Approval[]) {
  return approvals.find((approval) => approval.status === 'pending') ?? null
}

export default class ApprovalService {
  /**
   * Enregistre la décision d'un approbateur sur une étape.
   *
   * Tout se joue sous le verrou du contrat : deux décisions simultanées sur la même étape
   * s'exécutent l'une après l'autre, la seconde trouve l'étape déjà décidée et est refusée.
   * Un approbateur n'agit que sur l'étape active, avec le rôle attendu, et jamais sur un texte
   * qu'il a lui-même rédigé.
   */
  async decide(input: {
    organizationId: number
    contractId: number
    approvalId: number
    actor: { id: number; role: Role }
    decision: Decision
    comment: string | null
  }) {
    const { organizationId, contractId, approvalId, actor, decision } = input
    const comment = input.comment?.trim() || null

    return db.transaction(async (trx) => {
      const contract = await lockContract(trx, organizationId, contractId)
      const round = await Approval.query({ client: trx })
        .where('contract_id', contract.id)
        .where('round', contract.reviewRound)
        .orderBy('position')
      const approval = await Approval.query({ client: trx })
        .where('id', approvalId)
        .where('contract_id', contract.id)
        .firstOrFail()

      if (approval.status !== 'pending' || approval.round !== contract.reviewRound) {
        throw new RuleViolation('already_decided', 'Cette étape a déjà été traitée.')
      }
      if (activeStep(round)?.id !== approval.id) {
        throw new RuleViolation(
          'step_not_active',
          "Cette étape n'est pas encore active : les étapes précédentes doivent être validées."
        )
      }
      if (actor.role !== approval.approverRole) {
        throw new RuleViolation(
          'wrong_role',
          'Votre rôle ne permet pas de traiter cette étape.',
          403
        )
      }
      const version = await ContractVersion.findOrFail(approval.contractVersionId, { client: trx })
      if (version.authorId === actor.id) {
        throw new RuleViolation(
          'self_approval',
          'Vous avez rédigé cette version : une autre personne doit la valider.',
          403
        )
      }
      if (decision === 'reject' && !comment) {
        throw new RuleViolation('comment_required', 'Un rejet doit être motivé.', 422)
      }

      approval.merge({
        status: decision === 'approve' ? 'approved' : 'rejected',
        decidedBy: actor.id,
        decidedAt: DateTime.now(),
        comment,
      })
      await approval.save()
      const subject = { type: 'contract' as const, id: contract.id }
      const metadata = { round: approval.round, step: approval.stepName, version: version.number }
      await recordAudit(trx, {
        organizationId,
        actorId: actor.id,
        action: decision === 'approve' ? 'approval.approved' : 'approval.rejected',
        subject,
        metadata,
      })

      const remaining = round.filter((step) => step.id !== approval.id && step.status === 'pending')
      if (decision === 'reject') {
        // Les étapes suivantes n'auront pas lieu : le contrat repart chez son rédacteur.
        for (const step of remaining) {
          step.status = 'skipped'
          await step.save()
        }
        contract.status = 'rejected'
        await contract.save()
      } else if (remaining.length === 0) {
        contract.status = 'approved'
        await contract.save()
        await recordAudit(trx, {
          organizationId,
          actorId: actor.id,
          action: 'contract.approved',
          subject,
          metadata: { round: approval.round, version: version.number },
        })
      }
      return { approval, contract }
    })
  }
}
