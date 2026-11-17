import Membership from '#models/membership'
import type Organization from '#models/organization'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Établit l'organisation courante de l'utilisateur connecté et son rôle dans celle-ci.
 *
 * L'organisation ne vient jamais de l'URL ni d'un champ de formulaire : elle vient de
 * l'appartenance de l'utilisateur, relue à chaque requête. Chaque contrôleur filtre ensuite
 * ses requêtes sur `ctx.organization.id`, et une ressource d'une autre organisation répond 404.
 */
export default class OrganizationMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.getUserOrFail()
    const memberships = await Membership.query()
      .where('user_id', user.id)
      .preload('organization')
      .orderBy('id')

    const preferred = ctx.session.get('organization_id')
    const membership = memberships.find((m) => m.organizationId === preferred) ?? memberships[0]
    if (!membership) {
      throw new Exception("Ce compte n'appartient à aucune organisation.", { status: 403 })
    }

    ctx.organization = membership.organization
    ctx.membership = membership
    return next()
  }
}

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    organization: Organization
    membership: Membership
  }
}
