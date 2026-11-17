import Page from '~/components/page'
import AppLayout from '~/layouts/app'
import { TYPE_LABELS } from '~/lib/labels'
import { type InertiaProps } from '~/types'
import { type Data } from '@generated/data'
import { Link } from '@adonisjs/inertia/react'

type Props = InertiaProps<{ templates: Data.ContractTemplate[]; canWrite: boolean }>

export default function TemplatesIndex({ templates, canWrite }: Props) {
  return (
    <Page
      title="Modèles de contrats"
      description="Un texte réutilisable dont les variables {{nom}} sont remplies à la création du contrat."
      actions={
        canWrite && (
          <Link route="templates.create" className="btn btn--primary">
            Nouveau modèle
          </Link>
        )
      }
    >
      {templates.length === 0 ? (
        <p className="muted">Aucun modèle pour l’instant.</p>
      ) : (
        <ul className="cards" data-testid="templates">
          {templates.map((template) => (
            <li key={template.id} className="card">
              <h2 className="card__title">{template.name}</h2>
              <p className="muted">
                {TYPE_LABELS[template.type]} ·{' '}
                {template.variables.length > 0
                  ? `variables : ${template.variables.join(', ')}`
                  : 'aucune variable'}
              </p>
              {canWrite && (
                <Link
                  route="contracts.create"
                  qs={{ template: template.id }}
                  className="btn btn--secondary btn--sm"
                >
                  Créer un contrat
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}

TemplatesIndex.layout = [AppLayout]
