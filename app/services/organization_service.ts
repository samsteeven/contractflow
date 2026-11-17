import RuleViolation from '#exceptions/rule_violation'
import Membership from '#models/membership'
import Organization from '#models/organization'
import User from '#models/user'
import { recordAudit } from '#services/audit'
import type { Role } from '#services/vocabulary'
import string from '@adonisjs/core/helpers/string'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export default class OrganizationService {
  /** Crée l'organisation et fait de son créateur le propriétaire, dans la transaction fournie. */
  async createWithOwner(trx: TransactionClientContract, owner: User, name: string) {
    const organization = await Organization.create(
      {
        name,
        slug: `${string.slug(name, { lower: true }).slice(0, 60) || 'org'}-${string.random(6).toLowerCase()}`,
      },
      { client: trx }
    )
    await Membership.create(
      { organizationId: organization.id, userId: owner.id, role: 'owner' },
      { client: trx }
    )
    await recordAudit(trx, {
      organizationId: organization.id,
      actorId: owner.id,
      action: 'organization.created',
      subject: { type: 'organization', id: organization.id },
      metadata: { name },
    })
    return organization
  }

  /**
   * Ajoute un compte existant à l'organisation. Seul un propriétaire accorde les rôles
   * « propriétaire » et « administrateur » : un administrateur ne peut pas s'élever lui-même.
   */
  async addMember(
    organizationId: number,
    actor: { id: number; role: Role },
    input: { email: string; role: Role }
  ) {
    if ((input.role === 'owner' || input.role === 'admin') && actor.role !== 'owner') {
      throw new RuleViolation(
        'role_not_grantable',
        'Seul un propriétaire peut accorder ce rôle.',
        403
      )
    }

    return db.transaction(async (trx) => {
      const user = await User.query({ client: trx }).where('email', input.email).first()
      if (!user) {
        throw new RuleViolation(
          'unknown_user',
          "Aucun compte avec cet e-mail : la personne doit d'abord s'inscrire.",
          422
        )
      }
      const existing = await Membership.query({ client: trx })
        .where('organization_id', organizationId)
        .where('user_id', user.id)
        .first()
      if (existing) {
        throw new RuleViolation('already_member', 'Cette personne est déjà membre.')
      }

      const membership = await Membership.create(
        { organizationId, userId: user.id, role: input.role },
        { client: trx }
      )
      await recordAudit(trx, {
        organizationId,
        actorId: actor.id,
        action: 'member.added',
        subject: { type: 'membership', id: membership.id },
        metadata: { email: user.email, role: input.role },
      })
      return membership
    })
  }
}
