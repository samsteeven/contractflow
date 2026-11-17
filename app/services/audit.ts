import AuditLog from '#models/audit_log'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export type AuditAction =
  | 'organization.created'
  | 'member.added'
  | 'workflow.created'
  | 'contract.created'
  | 'contract.revised'
  | 'contract.submitted'
  | 'approval.approved'
  | 'approval.rejected'
  | 'contract.approved'
  | 'template.created'
  | 'comment.added'
  | 'document.generated'
  | 'signature.requested'
  | 'signature.signed'
  | 'signature.declined'
  | 'signature.cancelled'
  | 'contract.signed'

type Entry = {
  organizationId: number
  /** Absent quand l'événement vient du prestataire de signature. */
  actorId: number | null
  action: AuditAction
  subject: {
    type: 'organization' | 'membership' | 'workflow' | 'contract' | 'template'
    id: number
  }
  metadata?: Record<string, string | number | boolean | null>
}

/**
 * Toujours dans la transaction de l'action qu'elle décrit : pas d'action sans trace,
 * pas de trace d'une action annulée.
 */
export async function recordAudit(trx: TransactionClientContract, entry: Entry) {
  await AuditLog.create(
    {
      organizationId: entry.organizationId,
      actorId: entry.actorId,
      action: entry.action,
      subjectType: entry.subject.type,
      subjectId: entry.subject.id,
      metadata: entry.metadata ?? {},
    },
    { client: trx }
  )
}
