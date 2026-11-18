import Field from '~/components/field'
import AuthLayout from '~/layouts/auth'
import { ROLE_LABELS } from '~/lib/labels'
import { type InertiaProps } from '~/types'
import { Head } from '@inertiajs/react'
import { Form, Link } from '@adonisjs/inertia/react'

type Props = InertiaProps<{
  token: string
  invitation: {
    state: 'open' | 'expired' | 'accepted' | 'revoked'
    email: string
    role: string
    organizationName: string
    accountExists: boolean
  }
  signedInAs: string | null
}>

const CLOSED = {
  expired: 'Cette invitation a expiré. Demandez-en une nouvelle à un administrateur.',
  accepted: 'Cette invitation a déjà été utilisée.',
  revoked: 'Cette invitation a été retirée.',
}

export default function InvitationShow({ token, invitation, signedInAs }: Props) {
  const wrongAccount = signedInAs !== null && signedInAs.toLowerCase() !== invitation.email

  return (
    <>
      <Head title="Invitation" />
      <h1 className="auth__title">Rejoindre {invitation.organizationName}</h1>

      {invitation.state !== 'open' ? (
        <p className="auth__sub" data-testid="invitation-closed">
          {CLOSED[invitation.state]}
        </p>
      ) : (
        <>
          <p className="auth__sub">
            Vous êtes invité avec le rôle <strong>{ROLE_LABELS[invitation.role]}</strong>, à
            l’adresse <strong>{invitation.email}</strong>.
          </p>

          {wrongAccount ? (
            <>
              <p className="auth__sub" data-testid="invitation-wrong-account">
                Vous êtes connecté avec {signedInAs}. Déconnectez-vous puis rouvrez ce lien avec la
                bonne adresse.
              </p>
              <Form route="session.destroy">
                <button type="submit" className="btn btn--secondary btn--block">
                  Me déconnecter
                </button>
              </Form>
            </>
          ) : signedInAs ? (
            <Form route="invitations.accept" routeParams={{ token }}>
              {({ processing }) => (
                <div className="auth__form">
                  <button
                    type="submit"
                    className="btn btn--primary btn--block"
                    disabled={processing}
                  >
                    Rejoindre l’organisation
                  </button>
                </div>
              )}
            </Form>
          ) : invitation.accountExists ? (
            <p className="auth__sub" data-testid="invitation-login">
              Un compte existe déjà avec cette adresse.{' '}
              <Link route="session.create" className="il">
                Connectez-vous
              </Link>
              , puis rouvrez ce lien.
            </p>
          ) : (
            <Form route="invitations.accept" routeParams={{ token }}>
              {({ errors, processing }) => (
                <div className="auth__form">
                  <Field id="fullName" label="Nom complet" error={errors.fullName}>
                    <input
                      id="fullName"
                      name="fullName"
                      className="field__input"
                      autoComplete="name"
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
                  <button
                    type="submit"
                    className="btn btn--primary btn--block"
                    disabled={processing}
                  >
                    {processing ? 'Un instant…' : 'Créer mon compte et rejoindre'}
                  </button>
                </div>
              )}
            </Form>
          )}
        </>
      )}
    </>
  )
}

InvitationShow.layout = [AuthLayout]
