import Field from '~/components/field'
import Page from '~/components/page'
import Section from '~/components/section'
import AppLayout from '~/layouts/app'
import { APPROVER_ROLES, ROLE_LABELS } from '~/lib/labels'
import { type InertiaProps } from '~/types'
import { Form } from '@adonisjs/inertia/react'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

type Props = InertiaProps<{
  workflows: {
    id: number
    name: string
    steps: { position: number; name: string; approverRole: string }[]
  }[]
  canManage: boolean
}>

export default function WorkflowsIndex({ workflows, canManage }: Props) {
  // Identifiants locaux des lignes d'étapes du formulaire : leur ordre fait la position.
  const [rows, setRows] = useState([1, 2])
  const [nextRow, setNextRow] = useState(3)

  return (
    <Page
      title="Circuits de validation"
      description="Une suite ordonnée d'étapes, chacune confiée à un rôle. Un contrat soumis suit le circuit choisi, étape par étape."
    >
      {workflows.length === 0 ? (
        <p className="muted">Aucun circuit pour l’instant.</p>
      ) : (
        <ul className="cards" data-testid="workflows">
          {workflows.map((workflow) => (
            <li key={workflow.id} className="card">
              <h2 className="card__title">{workflow.name}</h2>
              <ol className="chain">
                {workflow.steps.map((step) => (
                  <li key={step.position}>
                    <strong>{step.name}</strong>
                    <span className="muted"> · {ROLE_LABELS[step.approverRole]}</span>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <Section title="Nouveau circuit">
          <Form
            route="workflows.store"
            resetOnSuccess
            onSuccess={() => {
              setRows([1, 2])
              setNextRow(3)
            }}
          >
            {({ errors, processing }) => {
              const messages = errors as Record<string, string | undefined>
              return (
                <div className="form">
                  <Field id="name" label="Nom du circuit" error={messages.name}>
                    <input id="name" name="name" className="field__input" required />
                  </Field>

                  <fieldset className="fieldset">
                    <legend className="field__label">Étapes, dans l’ordre</legend>
                    {rows.map((row, index) => (
                      <div key={row} className="form__row form__row--step">
                        <Field
                          id={`step-name-${row}`}
                          label={`Étape ${index + 1}`}
                          error={messages[`steps.${index}.name`]}
                        >
                          <input
                            id={`step-name-${row}`}
                            name={`steps[${index}][name]`}
                            className="field__input"
                            required
                          />
                        </Field>
                        <Field
                          id={`step-role-${row}`}
                          label="Rôle approbateur"
                          error={messages[`steps.${index}.approverRole`]}
                        >
                          <select
                            id={`step-role-${row}`}
                            name={`steps[${index}][approverRole]`}
                            className="field__input"
                          >
                            {APPROVER_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <button
                          type="button"
                          className="iconbtn"
                          aria-label={`Retirer l'étape ${index + 1}`}
                          disabled={rows.length === 1}
                          onClick={() => setRows(rows.filter((other) => other !== row))}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {messages.steps && (
                      <span className="field__error" role="alert">
                        {messages.steps}
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={rows.length >= 10}
                      onClick={() => {
                        setRows([...rows, nextRow])
                        setNextRow(nextRow + 1)
                      }}
                    >
                      <Plus size={15} /> Ajouter une étape
                    </button>
                  </fieldset>

                  <div className="form__actions">
                    <button type="submit" className="btn btn--primary" disabled={processing}>
                      Créer le circuit
                    </button>
                  </div>
                </div>
              )
            }}
          </Form>
        </Section>
      )}
    </Page>
  )
}

WorkflowsIndex.layout = [AppLayout]
