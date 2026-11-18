import RuleViolation from '#exceptions/rule_violation'
import InvitationService from '#services/invitation_service'
import { acceptInvitationValidator } from '#validators/user'
import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'

/** Côté invité : le lien reçu par e-mail. Hors organisation : la personne n'en fait pas encore partie. */
@inject()
export default class InvitationLinksController {
  constructor(protected invitations: InvitationService) {}

  async show({ inertia, params, auth }: HttpContext) {
    // Un lien ouvert depuis un e-mail n'a pas de page d'origine où revenir : page introuvable.
    const invitation = await this.invitations.preview(params.token).catch((error) => {
      if (error instanceof RuleViolation && error.reason === 'invitation_unknown') {
        throw new Exception('Invitation introuvable.', { status: 404 })
      }
      throw error
    })
    return inertia.render('invitations/show', {
      token: params.token as string,
      invitation,
      signedInAs: auth.user?.email ?? null,
    })
  }

  async accept({ request, response, params, auth, session }: HttpContext) {
    const input = await request.validateUsing(acceptInvitationValidator)
    const { user, organizationId } = await this.invitations.accept(
      params.token,
      { fullName: input.fullName ?? null, password: input.password ?? null },
      auth.user ?? null
    )

    await auth.use('web').login(user)
    session.put('organization_id', organizationId)
    session.flash('success', 'Bienvenue : vous avez rejoint l’organisation.')
    return response.redirect().toRoute('dashboard')
  }
}
