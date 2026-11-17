import Field from '~/components/field'
import AuthLayout from '~/layouts/auth'
import { Head } from '@inertiajs/react'
import { Form, Link } from '@adonisjs/inertia/react'

export default function Signup() {
  return (
    <>
      <Head title="Créer un compte" />
      <h1 className="auth__title">Créer un compte</h1>
      <p className="auth__sub">
        Votre organisation est créée avec vous : vous en êtes le propriétaire.
      </p>

      <Form route="new_account.store">
        {({ errors, processing }) => (
          <div className="auth__form">
            <Field id="fullName" label="Nom complet" error={errors.fullName}>
              <input id="fullName" name="fullName" className="field__input" autoComplete="name" />
            </Field>
            <Field id="organizationName" label="Organisation" error={errors.organizationName}>
              <input
                id="organizationName"
                name="organizationName"
                className="field__input"
                autoComplete="organization"
                required
              />
            </Field>
            <Field id="email" label="E-mail" error={errors.email}>
              <input
                id="email"
                name="email"
                type="email"
                className="field__input"
                autoComplete="email"
                required
              />
            </Field>
            <Field
              id="password"
              label="Mot de passe"
              hint="10 caractères au minimum."
              error={errors.password}
            >
              <input
                id="password"
                name="password"
                type="password"
                className="field__input"
                autoComplete="new-password"
                required
              />
            </Field>
            <Field
              id="passwordConfirmation"
              label="Confirmer le mot de passe"
              error={errors.passwordConfirmation}
            >
              <input
                id="passwordConfirmation"
                name="passwordConfirmation"
                type="password"
                className="field__input"
                autoComplete="new-password"
                required
              />
            </Field>
            <button type="submit" className="btn btn--primary btn--block" disabled={processing}>
              {processing ? 'Un instant…' : 'Créer le compte'}
            </button>
          </div>
        )}
      </Form>

      <p className="auth__foot">
        Déjà un compte ?{' '}
        <Link route="session.create" className="il">
          Se connecter
        </Link>
      </p>
    </>
  )
}

Signup.layout = [AuthLayout]
