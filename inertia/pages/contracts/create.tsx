import Field from '~/components/field'
import Page from '~/components/page'
import AppLayout from '~/layouts/app'
import { TYPE_LABELS } from '~/lib/labels'
import { type InertiaProps } from '~/types'
import { type Data } from '@generated/data'
import { Form, Link } from '@adonisjs/inertia/react'

type Props = InertiaProps<{
  templates: Data.ContractTemplate[]
  selectedTemplateId: number | null
}>

/** `date_debut` s'affiche « Date debut » : le nom de la variable sert d'étiquette. */
const labelOf = (variable: string) => {
  const text = variable.replaceAll('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export default function ContractsCreate({ templates, selectedTemplateId }: Props) {
  const template = templates.find((item) => item.id === selectedTemplateId) ?? null

  return (
    <Page
      title="Nouveau contrat"
      description="Le contrat est créé en brouillon, avec sa version 1."
    >
      <nav className="filters" aria-label="Point de départ">
        <Link
          route="contracts.create"
          className="filter"
          aria-current={template ? undefined : 'true'}
        >
          Texte libre
        </Link>
        {templates.map((item) => (
          <Link
            key={item.id}
            route="contracts.create"
            qs={{ template: item.id }}
            className="filter"
            aria-current={template?.id === item.id ? 'true' : undefined}
          >
            {item.name}
          </Link>
        ))}
      </nav>

      <Form route="contracts.store" key={template?.id ?? 'libre'}>
        {({ errors, processing }) => (
          <div className="form">
            <Field id="title" label="Intitulé" error={errors.title}>
              <input id="title" name="title" className="field__input" required />
            </Field>
            <div className="form__row">
              <Field id="counterparty" label="Cocontractant" error={errors.counterparty}>
                <input id="counterparty" name="counterparty" className="field__input" required />
              </Field>
              {!template && (
                <Field id="type" label="Type" error={errors.type}>
                  <select id="type" name="type" className="field__input" defaultValue="service">
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>

            {template ? (
              <>
                <input type="hidden" name="templateId" value={template.id} />
                {template.variables.map((variable) => (
                  <Field
                    key={variable}
                    id={`values-${variable}`}
                    label={labelOf(variable)}
                    error={(errors as Record<string, string>)[`values.${variable}`]}
                  >
                    <input
                      id={`values-${variable}`}
                      name={`values[${variable}]`}
                      className="field__input"
                      required
                    />
                  </Field>
                ))}
                <p className="muted">
                  Le texte du modèle « {template.name} » est rempli avec ces valeurs, puis ne suit
                  plus le modèle.
                </p>
              </>
            ) : (
              <Field id="body" label="Texte du contrat" error={errors.body}>
                <textarea
                  id="body"
                  name="body"
                  className="field__input field__input--text"
                  rows={16}
                  required
                />
              </Field>
            )}
            <div className="form__actions">
              <button type="submit" className="btn btn--primary" disabled={processing}>
                {processing ? 'Enregistrement…' : 'Créer le brouillon'}
              </button>
              <Link route="contracts.index" className="btn btn--ghost">
                Annuler
              </Link>
            </div>
          </div>
        )}
      </Form>
    </Page>
  )
}

ContractsCreate.layout = [AppLayout]
