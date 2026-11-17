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

export const CONTRACT_STATUSES = ['draft', 'in_review', 'approved', 'rejected'] as const
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
