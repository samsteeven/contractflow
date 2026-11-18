import Field from '~/components/field'
import Page from '~/components/page'
import Section from '~/components/section'
import AppLayout from '~/layouts/app'
import { formatDay, ROLE_LABELS, ROLES } from '~/lib/labels'
import { type InertiaProps } from '~/types'
import { Form } from '@adonisjs/inertia/react'

type Props = InertiaProps<{
  members: { id: number; name: string; email: string; role: string }[]
  canManage: boolean
  invitations: { id: number; email: string; role: string; expired: boolean; expiresOn: string }[]
}>

export default function MembersIndex({ members, canManage, invitations }: Props) {
  return (
    <Page
      title="Équipe"
      description="Le rôle d'un membre décide de ce qu'il rédige et des étapes qu'il valide."
    >
      <div className="table-wrap">
        <table className="table" data-testid="members">
          <thead>
            <tr>
              <th scope="col">Nom</th>
              <th scope="col">E-mail</th>
              <th scope="col">Rôle</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>{member.name}</td>
                <td>{member.email}</td>
                <td>{ROLE_LABELS[member.role]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage && invitations.length > 0 && (
        <Section title="Invitations en attente">
          <ul className="rows" data-testid="invitations">
            {invitations.map((invitation) => (
              <li key={invitation.id}>
                <div>
                  <strong>{invitation.email}</strong>{' '}
                  <span className="muted">
                    {ROLE_LABELS[invitation.role]} ·{' '}
                    {invitation.expired
                      ? 'expirée'
                      : `valable jusqu’au ${formatDay(invitation.expiresOn)}`}
                  </span>
                </div>
                <Form route="invitations.revoke" routeParams={{ invitationId: invitation.id }}>
                  {({ processing }) => (
                    <button
                      type="submit"
                      className="btn btn--secondary btn--sm"
                      disabled={processing}
                    >
                      Retirer
                    </button>
                  )}
                </Form>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {canManage && (
        <Section
          title="Inviter quelqu’un"
          description="La personne reçoit un lien valable sept jours : elle crée son compte, ou se connecte si elle en a déjà un. Inviter à nouveau la même adresse renvoie le lien et remplace l’ancien. Seul un propriétaire accorde les rôles Administrateur et Propriétaire."
        >
          <Form route="invitations.store" resetOnSuccess>
            {({ errors, processing }) => (
              <div className="form">
                <div className="form__row">
                  <Field id="email" label="E-mail" error={errors.email}>
                    <input id="email" name="email" type="email" className="field__input" required />
                  </Field>
                  <Field id="role" label="Rôle" error={errors.role}>
                    <select id="role" name="role" className="field__input" defaultValue="member">
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="form__actions">
                  <button type="submit" className="btn btn--primary" disabled={processing}>
                    Envoyer l’invitation
                  </button>
                </div>
              </div>
            )}
          </Form>
        </Section>
      )}
    </Page>
  )
}

MembersIndex.layout = [AppLayout]
