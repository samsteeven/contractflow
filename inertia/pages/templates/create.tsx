import Field from '~/components/field'
import Page from '~/components/page'
import AppLayout from '~/layouts/app'
import { TYPE_LABELS } from '~/lib/labels'
import { Form, Link } from '@adonisjs/inertia/react'

export default function TemplatesCreate() {
  return (
    <Page
      title="Nouveau modèle"
      description="Écrivez les variables entre doubles accolades : {{prestataire}}, {{montant}}, {{date_debut}}. Minuscules, chiffres et tirets bas uniquement."
    >
      <Form route="templates.store">
        {({ errors, processing }) => (
          <div className="form">
            <div className="form__row">
              <Field id="name" label="Nom du modèle" error={errors.name}>
                <input id="name" name="name" className="field__input" required />
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
            <Field id="body" label="Texte du modèle" error={errors.body}>
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
                {processing ? 'Enregistrement…' : 'Enregistrer le modèle'}
              </button>
              <Link route="templates.index" className="btn btn--ghost">
                Annuler
              </Link>
            </div>
          </div>
        )}
      </Form>
    </Page>
  )
}

TemplatesCreate.layout = [AppLayout]
