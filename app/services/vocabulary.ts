/**
 * Vocabulaire du domaine. Les mêmes listes sont imposées par des contraintes CHECK en base
 * (voir database/migrations) : une valeur inconnue est refusée même hors de l'application.
 */

export const ROLES = ['owner', 'admin', 'legal', 'manager', 'member', 'viewer'] as const
export type Role = (typeof ROLES)[number]

/** Rôles qui peuvent tenir une étape de validation. */
export const APPROVER_ROLES = ['owner', 'admin', 'legal', 'manager'] as const
export type ApproverRole = (typeof APPROVER_ROLES)[number]

/** Rôles qui rédigent : créer un contrat, le réviser, le soumettre. */
export const AUTHOR_ROLES: readonly Role[] = ['owner', 'admin', 'legal', 'manager', 'member']

/** Rôles qui administrent l'organisation : membres et circuits de validation. */
export const ADMIN_ROLES: readonly Role[] = ['owner', 'admin']

export const CONTRACT_TYPES = [
  'service',
  'supplier',
  'subcontracting',
  'nda',
  'partnership',
] as const
export type ContractType = (typeof CONTRACT_TYPES)[number]

export const CONTRACT_STATUSES = [
  'draft',
  'in_review',
  'approved',
  'rejected',
  'signing',
  'signed',
] as const
export type ContractStatus = (typeof CONTRACT_STATUSES)[number]

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'skipped'] as const
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number]

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  service: 'Prestation de services',
  supplier: 'Fournisseur',
  subcontracting: 'Sous-traitance',
  nda: 'Accord de confidentialité',
  partnership: 'Partenariat',
}

/** Rôles qui engagent l'organisation : demander ou annuler une signature. */
export const SIGNATURE_ROLES: readonly Role[] = ['owner', 'admin', 'manager']

export const SIGNATURE_STATUSES = ['pending', 'completed', 'declined', 'cancelled'] as const
export type SignatureStatus = (typeof SIGNATURE_STATUSES)[number]

export const SIGNER_STATUSES = ['pending', 'signed', 'declined'] as const
export type SignerStatus = (typeof SIGNER_STATUSES)[number]

export const OBLIGATION_KINDS = [
  'payment',
  'delivery',
  'report',
  'review',
  'renewal_notice',
  'other',
] as const
export type ObligationKind = (typeof OBLIGATION_KINDS)[number]
/** Le préavis de reconduction est créé par le système à partir de la durée du contrat. */
export const MANUAL_OBLIGATION_KINDS: readonly ObligationKind[] = OBLIGATION_KINDS.filter(
  (kind) => kind !== 'renewal_notice'
)

export const OBLIGATION_STATUSES = ['open', 'done', 'cancelled'] as const
export type ObligationStatus = (typeof OBLIGATION_STATUSES)[number]

export const TERM_STATUSES = ['active', 'terminated'] as const
export type TermStatus = (typeof TERM_STATUSES)[number]

export const REMINDER_STAGES = ['d30', 'd7', 'd1', 'd0', 'overdue'] as const
export type ReminderStage = (typeof REMINDER_STAGES)[number]
