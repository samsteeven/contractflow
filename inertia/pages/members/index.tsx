import Field from '~/components/field'
import Page from '~/components/page'
import Section from '~/components/section'
import AppLayout from '~/layouts/app'
import { ROLE_LABELS, ROLES } from '~/lib/labels'
import { type InertiaProps } from '~/types'
import { Form } from '@adonisjs/inertia/react'

type Props = InertiaProps<{
  members: { id: number; name: string; email: string; role: string }[]
  canManage: boolean
}>

export default function MembersIndex({ members, canManage }: Props) {
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

      {canManage && (
        <Section
          title="Ajouter un membre"
          description="La personne doit déjà avoir un compte. Seul un propriétaire accorde les rôles Administrateur et Propriétaire."
        >
          <Form route="members.store" resetOnSuccess>
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
                    Ajouter
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
