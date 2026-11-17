export const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  legal: 'Juridique',
  manager: 'Direction',
  member: 'Rédacteur',
  viewer: 'Lecteur',
}

export const APPROVER_ROLES = ['legal', 'manager', 'admin', 'owner'] as const
export const ROLES = ['member', 'legal', 'manager', 'viewer', 'admin', 'owner'] as const

export const TYPE_LABELS: Record<string, string> = {
  service: 'Prestation de services',
  supplier: 'Fournisseur',
  subcontracting: 'Sous-traitance',
  nda: 'Confidentialité (NDA)',
  partnership: 'Partenariat',
}

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  in_review: 'En validation',
  approved: 'Approuvé',
  rejected: 'Rejeté',
}

export const STEP_LABELS: Record<string, string> = {
  pending: 'En attente',
  approved: 'Validée',
  rejected: 'Rejetée',
  skipped: 'Annulée',
}

const AUDIT_LABELS: Record<string, string> = {
  'contract.created': 'Contrat créé',
  'contract.revised': 'Nouvelle version',
  'contract.submitted': 'Soumis à validation',
  'approval.approved': 'Étape validée',
  'approval.rejected': 'Étape rejetée',
  'contract.approved': 'Contrat approuvé',
}

export function auditLabel(action: string, metadata: Record<string, unknown>) {
  const label = AUDIT_LABELS[action] ?? action
  const details = [
    metadata.step && `« ${metadata.step} »`,
    metadata.version && `version ${metadata.version}`,
    metadata.round && `tour ${metadata.round}`,
  ].filter(Boolean)
  return details.length ? `${label} (${details.join(', ')})` : label
}

const dateTime = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })

export function formatDate(iso: string | null | undefined) {
  return iso ? dateTime.format(new Date(iso)) : ''
}
