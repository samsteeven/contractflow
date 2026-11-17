import Page from '~/components/page'
import StatusBadge from '~/components/status_badge'
import AppLayout from '~/layouts/app'
import { formatDate, STATUS_LABELS, TYPE_LABELS } from '~/lib/labels'
import { type InertiaProps } from '~/types'
import { type Data } from '@generated/data'
import { Link } from '@adonisjs/inertia/react'
import { Plus } from 'lucide-react'

type Props = InertiaProps<{
  contracts: Data.Contract[]
  status: string | null
  canWrite: boolean
}>

export default function ContractsIndex({ contracts, status, canWrite }: Props) {
  return (
    <Page
      title="Contrats"
      actions={
        canWrite && (
          <Link route="contracts.create" className="btn btn--primary btn--sm">
            <Plus size={15} /> Nouveau contrat
          </Link>
        )
      }
    >
      <nav className="filters" aria-label="Filtrer par état">
        <Link route="contracts.index" className="filter" aria-current={status ? undefined : 'true'}>
          Tous
        </Link>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <Link
            key={value}
            route="contracts.index"
            qs={{ status: value }}
            className="filter"
            aria-current={status === value ? 'true' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>

      {contracts.length === 0 ? (
        <p className="muted">Aucun contrat{status ? ' dans cet état' : ''}.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Contrat</th>
                <th scope="col">Cocontractant</th>
                <th scope="col">Type</th>
                <th scope="col">État</th>
                <th scope="col">Modifié</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((contract) => (
                <tr key={contract.id}>
                  <td>
                    <Link route="contracts.show" routeParams={{ id: contract.id }} className="il">
                      {contract.title}
                    </Link>
                  </td>
                  <td>{contract.counterparty}</td>
                  <td>{TYPE_LABELS[contract.type]}</td>
                  <td>
                    <StatusBadge status={contract.status} />
                  </td>
                  <td className="muted">{formatDate(contract.updatedAt ?? contract.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  )
}

ContractsIndex.layout = [AppLayout]
