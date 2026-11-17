import type Membership from '#models/membership'
import type User from '#models/user'
import { ADMIN_ROLES } from '#services/vocabulary'
import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'

/** Administrer l'organisation : ses membres et ses circuits de validation. */
export default class OrganizationPolicy extends BasePolicy {
  manage(_user: User, membership: Membership): AuthorizerResponse {
    return ADMIN_ROLES.includes(membership.role)
  }
}
