import { DeadlineBadge } from '~/components/contract_tracking'
import Page from '~/components/page'
import AppLayout from '~/layouts/app'
import { formatDay, KIND_LABELS } from '~/lib/labels'
import { type InertiaProps } from '~/types'
import { Link } from '@adonisjs/inertia/react'

type Props = InertiaProps<{
  mine: boolean
  deadlines: {
    id: number
    title: string
    kind: string
    dueOn: string
    daysLeft: number
    assignee: string
    contractId: number
    contractTitle: string
    counterparty: string
  }[]
}>

export default function DeadlinesIndex({ mine, deadlines }: Props) {
  return (
    <Page
      title="Échéances"
      description="Les obligations ouvertes des contrats signés, la plus proche en premier. Leur responsable est prévenu par e-mail à 30 jours, 7 jours, 1 jour, le jour même et en cas de retard."
    >
      <nav className="filters" aria-label="Filtre">
        <Link route="deadlines.index" className="filter" aria-current={mine ? undefined : 'true'}>
          Toutes
        </Link>
        <Link
          route="deadlines.index"
          qs={{ mine: 1 }}
          className="filter"
          aria-current={mine ? 'true' : undefined}
        >
          Les miennes
        </Link>
      </nav>

      {deadlines.length === 0 ? (
        <p className="muted">Aucune échéance ouverte.</p>
      ) : (
        <ul className="rows" data-testid="deadlines">
          {deadlines.map((deadline) => (
            <li key={deadline.id}>
              <div>
                <strong>{deadline.title}</strong> <DeadlineBadge daysLeft={deadline.daysLeft} />
                <div className="muted">
                  {KIND_LABELS[deadline.kind]} · {formatDay(deadline.dueOn)} · {deadline.assignee} ·{' '}
                  <Link
                    route="contracts.show"
                    routeParams={{ id: deadline.contractId }}
                    className="il"
                  >
                    {deadline.contractTitle}
                  </Link>{' '}
                  ({deadline.counterparty})
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}

DeadlinesIndex.layout = [AppLayout]
