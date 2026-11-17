import Field from '~/components/field'
import Page from '~/components/page'
import AppLayout from '~/layouts/app'
import { TYPE_LABELS } from '~/lib/labels'
import { Form, Link } from '@adonisjs/inertia/react'

export default function ContractsCreate() {
  return (
    <Page
      title="Nouveau contrat"
      description="Le contrat est créé en brouillon, avec sa version 1."
    >
      <Form route="contracts.store">
        {({ errors, processing }) => (
          <div className="form">
            <Field id="title" label="Intitulé" error={errors.title}>
              <input id="title" name="title" className="field__input" required />
            </Field>
            <div className="form__row">
              <Field id="counterparty" label="Cocontractant" error={errors.counterparty}>
                <input id="counterparty" name="counterparty" className="field__input" required />
              </Field>
              <Field id="type" label="Type" error={errors.type}>
                <select id="type" name="type" className="field__input" defaultValue="service">
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field id="body" label="Texte du contrat" error={errors.body}>
              <textarea
                id="body"
                name="body"
                className="field__input field__input--text"
                rows={16}
                required
              />
            </Field>
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
