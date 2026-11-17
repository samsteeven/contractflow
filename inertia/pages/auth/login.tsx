import Field from '~/components/field'
import AuthLayout from '~/layouts/auth'
import { Head } from '@inertiajs/react'
import { Form, Link } from '@adonisjs/inertia/react'

export default function Login() {
  return (
    <>
      <Head title="Connexion" />
      <h1 className="auth__title">Connexion</h1>
      <p className="auth__sub">Retrouvez vos contrats et vos validations en attente.</p>

      <Form route="session.store">
        {({ errors, processing }) => (
          <div className="auth__form">
            <Field id="email" label="E-mail" error={errors.email}>
              <input
                id="email"
                name="email"
                type="email"
                className="field__input"
                autoComplete="username"
                required
              />
            </Field>
            <Field id="password" label="Mot de passe" error={errors.password}>
              <input
                id="password"
                name="password"
                type="password"
                className="field__input"
                autoComplete="current-password"
                required
              />
            </Field>
            <button type="submit" className="btn btn--primary btn--block" disabled={processing}>
              {processing ? 'Un instant…' : 'Se connecter'}
            </button>
          </div>
        )}
      </Form>

      <p className="auth__foot">
        Pas encore de compte ?{' '}
        <Link route="new_account.create" className="il">
          Créer un compte
        </Link>
      </p>
    </>
  )
}

Login.layout = [AuthLayout]
