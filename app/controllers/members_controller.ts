import Membership from '#models/membership'
import OrganizationService from '#services/organization_service'
import { ADMIN_ROLES } from '#services/vocabulary'
import { addMemberValidator } from '#validators/contract'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class MembersController {
  constructor(protected organizations: OrganizationService) {}

  async index({ inertia, organization, membership }: HttpContext) {
    const members = await Membership.query()
      .where('organization_id', organization.id)
      .preload('user')
      .orderBy('id')

    return inertia.render('members/index', {
      members: members.map((member) => ({
        id: member.id,
        name: member.user.fullName ?? member.user.email,
        email: member.user.email,
        role: member.role,
      })),
      canManage: ADMIN_ROLES.includes(membership.role),
    })
  }

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
    await this.organizations.addMember(
      organization.id,
      { id: auth.getUserOrFail().id, role: membership.role },
      input
    )

    session.flash('success', 'Membre ajouté.')
    return response.redirect().toRoute('members.index')
  }
}
