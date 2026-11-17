import { STATUS_LABELS, STEP_LABELS } from '~/lib/labels'

/** État d'un contrat ou d'une étape : toujours un libellé, la couleur ne porte jamais seule le sens. */
export default function StatusBadge({ status, step = false }: { status: string; step?: boolean }) {
  const label = (step ? STEP_LABELS : STATUS_LABELS)[status] ?? status
  return (
    <span className="badge" data-status={status}>
      {label}
    </span>
  )
}
