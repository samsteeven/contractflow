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
  signing: 'En signature',
  signed: 'Signé',
}

export const STEP_LABELS: Record<string, string> = {
  pending: 'En attente',
  approved: 'Validée',
  rejected: 'Rejetée',
  skipped: 'Annulée',
  completed: 'Signée par tous',
  declined: 'Refusée',
  cancelled: 'Annulée',
}

const AUDIT_LABELS: Record<string, string> = {
  'contract.created': 'Contrat créé',
  'contract.revised': 'Nouvelle version',
  'contract.submitted': 'Soumis à validation',
  'approval.approved': 'Étape validée',
  'approval.rejected': 'Étape rejetée',
  'contract.approved': 'Contrat approuvé',
  'comment.added': 'Commentaire ajouté',
  'document.generated': 'PDF archivé',
  'signature.requested': 'Envoyé à la signature',
  'signature.signed': 'Signature recueillie',
  'signature.declined': 'Signature refusée',
  'signature.cancelled': 'Signature annulée',
  'contract.signed': 'Contrat signé',
  'term.set': 'Durée définie',
  'term.renewed': 'Contrat reconduit',
  'term.terminated': 'Contrat terminé',
  'obligation.created': 'Obligation ajoutée',
  'obligation.completed': 'Obligation close',
  'obligation.cancelled': 'Obligation annulée',
}

export function auditLabel(action: string, metadata: Record<string, unknown>) {
  const label = AUDIT_LABELS[action] ?? action
  const details = [
    metadata.step && `« ${metadata.step} »`,
    metadata.version && `version ${metadata.version}`,
    metadata.round && `tour ${metadata.round}`,
    metadata.signer && String(metadata.signer),
  ].filter(Boolean)
  return details.length ? `${label} (${details.join(', ')})` : label
}

export const KIND_LABELS: Record<string, string> = {
  payment: 'Paiement',
  delivery: 'Livraison',
  report: 'Rapport',
  review: 'Revue',
  renewal_notice: 'Échéance du contrat',
  other: 'Autre',
}

const day = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' })

/** Un jour calendaire `AAAA-MM-JJ`, sans heure : affiché en UTC pour ne jamais glisser d'un jour. */
export function formatDay(value: string) {
  return day.format(new Date(`${value}T00:00:00Z`))
}

const dateTime = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })

export function formatDate(iso: string | null | undefined) {
  return iso ? dateTime.format(new Date(iso)) : ''
}
