import Page from '~/components/page'
import Section from '~/components/section'
import AppLayout from '~/layouts/app'
import { STATUS_LABELS } from '~/lib/labels'
import { type InertiaProps } from '~/types'
import { Link } from '@adonisjs/inertia/react'

type Props = InertiaProps<{
  counts: Record<string, number>
  waiting: { contractId: number; title: string; counterparty: string; stepName: string }[]
}>

export default function Dashboard({ counts, waiting, organization }: Props) {
  return (
    <Page title="Tableau de bord" description={organization?.name}>
      <div className="stats">
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <Link key={status} route="contracts.index" qs={{ status }} className="stat">
            <span className="stat__label">{label}</span>
            <span className="stat__value" data-testid={`count-${status}`}>
              {counts[status] ?? 0}
            </span>
          </Link>
        ))}
      </div>

      <Section
        title="À valider par moi"
        description="Les contrats dont l'étape active attend votre rôle."
      >
        {waiting.length === 0 ? (
          <p className="muted">Aucun contrat n’attend votre décision.</p>
        ) : (
          <ul className="rows" data-testid="waiting">
            {waiting.map((item) => (
              <li key={item.contractId}>
                <Link route="contracts.show" routeParams={{ id: item.contractId }} className="row">
                  <span>
                    <strong>{item.title}</strong>
                    <span className="muted"> · {item.counterparty}</span>
                  </span>
                  <span className="muted">{item.stepName}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Page>
  )
}

Dashboard.layout = [AppLayout]
