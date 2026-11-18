import Invitation from '#models/invitation'
import InvitationService, { stateOf } from '#services/invitation_service'
import { addMemberValidator } from '#validators/contract'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

/** Côté administration : inviter, renvoyer, retirer. La liste s'affiche sur la page de l'équipe. */
@inject()
export default class InvitationsController {
  constructor(protected invitations: InvitationService) {}

  async store({
    request,
    response,
    session,
    bouncer,
    auth,
    organization,
    membership,
  }: HttpContext) {
    await bouncer.with('OrganizationPolicy').authorize('manage', membership)
    const input = await request.validateUsing(addMemberValidator)
    await this.invitations.invite(
      organization.id,
      { id: auth.getUserOrFail().id, role: membership.role },
      input
    )

    session.flash('success', `Invitation envoyée à ${input.email.trim().toLowerCase()}.`)
    return response.redirect().toRoute('members.index')
  }

  async revoke({
    response,
    session,
    params,
    bouncer,
    auth,
    organization,
    membership,
  }: HttpContext) {
    await bouncer.with('OrganizationPolicy').authorize('manage', membership)
    await this.invitations.revoke(
      organization.id,
      auth.getUserOrFail(),
      Number(params.invitationId)
    )

    session.flash('success', 'Invitation retirée.')
    return response.redirect().toRoute('members.index')
  }

  /** Les invitations à traiter (ouvertes ou expirées) de l'organisation, pour la page de l'équipe. */
  static async pending(organizationId: number) {
    const invitations = await Invitation.query()
      .where('organization_id', organizationId)
      .whereNull('accepted_at')
      .whereNull('revoked_at')
      .orderBy('id', 'desc')
    return invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expired: stateOf(invitation) === 'expired',
      expiresOn: invitation.expiresAt.toISODate()!,
    }))
  }
}
