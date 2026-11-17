import type Membership from '#models/membership'
import type User from '#models/user'
import { AUTHOR_ROLES, SIGNATURE_ROLES } from '#services/vocabulary'
import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'

/**
 * Qui peut rédiger. Lire est ouvert à tout membre (le filtre par organisation suffit) ;
 * décider d'une étape dépend de l'état du circuit et se vérifie dans ApprovalService.
 */
export default class ContractPolicy extends BasePolicy {
  write(_user: User, membership: Membership): AuthorizerResponse {
    return AUTHOR_ROLES.includes(membership.role)
  }

  /** Engager l'organisation : signature, reconduction ou fin d'un contrat. */
  engage(_user: User, membership: Membership): AuthorizerResponse {
    return SIGNATURE_ROLES.includes(membership.role)
  }

  /** Demander ou annuler une signature engage l'organisation. */
  requestSignature(_user: User, membership: Membership): AuthorizerResponse {
    return SIGNATURE_ROLES.includes(membership.role)
  }
}
