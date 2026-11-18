import { createHash, randomBytes } from 'node:crypto'
import InvitationMail from '#mails/invitation_mail'
import RuleViolation from '#exceptions/rule_violation'
import Invitation from '#models/invitation'
import Membership from '#models/membership'
import Organization from '#models/organization'
import User from '#models/user'
import { recordAudit } from '#services/audit'
import { assertGrantable } from '#services/organization_service'
import type { Role } from '#services/vocabulary'
import mail from '@adonisjs/mail/services/main'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

export const INVITATION_DAYS = 7

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

export type InvitationState = 'open' | 'expired' | 'accepted' | 'revoked'

export function stateOf(invitation: Invitation, now = DateTime.utc()): InvitationState {
  if (invitation.acceptedAt) return 'accepted'
  if (invitation.revokedAt) return 'revoked'
  if (invitation.expiresAt <= now) return 'expired'
  return 'open'
}

const findUserByEmail = (client: TransactionClientContract, email: string) =>
  User.query({ client }).whereRaw('lower(email) = ?', [email]).first()

export default class InvitationService {
  /**
   * Invite une adresse. Le jeton (32 octets aléatoires) part par e-mail et n'est jamais stocké :
   * seule son empreinte l'est. Réinviter la même adresse remplace le jeton et prolonge le délai,
   * l'ancien lien cesse de marcher ; l'index unique partiel rend l'appel simultané sûr.
   * L'e-mail part après l'enregistrement : s'il échoue, l'invitation existe et se renvoie.
   */
  async invite(
    organizationId: number,
    actor: { id: number; role: Role },
    input: { email: string; role: Role },
    now = DateTime.utc()
  ) {
    assertGrantable(actor.role, input.role)
    const email = normalizeEmail(input.email)
    const token = randomBytes(32).toString('base64url')
    const expiresAt = now.plus({ days: INVITATION_DAYS })

    const invitation = await db.transaction(async (trx) => {
      const user = await findUserByEmail(trx, email)
      if (user) {
        const member = await Membership.query({ client: trx })
          .where('organization_id', organizationId)
          .where('user_id', user.id)
          .first()
        if (member) throw new RuleViolation('already_member', 'Cette personne est déjà membre.')
      }

      const result = await trx.rawQuery(
        `INSERT INTO invitations
           (organization_id, email, role, token_hash, invited_by, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (organization_id, email) WHERE accepted_at IS NULL AND revoked_at IS NULL
         DO UPDATE SET role = EXCLUDED.role, token_hash = EXCLUDED.token_hash,
           invited_by = EXCLUDED.invited_by, expires_at = EXCLUDED.expires_at,
           updated_at = EXCLUDED.updated_at
         RETURNING id`,
        [
          organizationId,
          email,
          input.role,
          hashToken(token),
          actor.id,
          expiresAt.toSQL({ includeOffset: false }),
          now.toSQL({ includeOffset: false }),
          now.toSQL({ includeOffset: false }),
        ]
      )
      const row = await Invitation.findOrFail(result.rows[0].id, { client: trx })
      await recordAudit(trx, {
        organizationId,
        actorId: actor.id,
        action: 'invitation.sent',
        subject: { type: 'invitation', id: row.id },
        metadata: { email, role: input.role },
      })
      return row
    })

    const [organization, inviter] = await Promise.all([
      Organization.findOrFail(organizationId),
      User.findOrFail(actor.id),
    ])
    try {
      await mail.send(
        new InvitationMail({
          to: email,
          organizationName: organization.name,
          inviterName: inviter.fullName ?? inviter.email,
          role: input.role,
          token,
          expiresOn: expiresAt.toISODate()!,
        })
      )
    } catch {
      throw new RuleViolation(
        'mail_failed',
        "L'invitation est enregistrée, mais l'e-mail n'est pas parti : renvoyez-la.",
        502
      )
    }
    return invitation
  }

  /** Retire l'invitation ouverte : son lien ne marche plus. */
  async revoke(organizationId: number, actor: { id: number }, invitationId: number) {
    await db.transaction(async (trx) => {
      const invitation = await Invitation.query({ client: trx })
        .where('id', invitationId)
        .where('organization_id', organizationId)
        .forUpdate()
        .firstOrFail()
      if (stateOf(invitation) !== 'open' && stateOf(invitation) !== 'expired') {
        throw new RuleViolation('invitation_closed', 'Cette invitation est déjà close.')
      }
      invitation.revokedAt = DateTime.utc()
      await invitation.useTransaction(trx).save()
      await recordAudit(trx, {
        organizationId,
        actorId: actor.id,
        action: 'invitation.revoked',
        subject: { type: 'invitation', id: invitation.id },
        metadata: { email: invitation.email },
      })
    })
  }

  /** Ce que la page du lien affiche. Un jeton inconnu ne dit rien de plus qu'un 404. */
  async preview(token: string) {
    const invitation = await Invitation.query()
      .where('token_hash', hashToken(token))
      .preload('organization')
      .first()
    if (!invitation) {
      throw new RuleViolation('invitation_unknown', 'Invitation introuvable.', 404)
    }
    const account = await User.query().whereRaw('lower(email) = ?', [invitation.email]).first()
    return {
      state: stateOf(invitation),
      email: invitation.email,
      role: invitation.role,
      organizationName: invitation.organization.name,
      accountExists: Boolean(account),
    }
  }

  /**
   * Accepte l'invitation, une seule fois (verrou de la ligne). Trois cas :
   * - une personne connectée avec l'adresse invitée rejoint l'organisation ;
   * - une personne connectée avec une autre adresse est refusée : le lien n'est pas pour elle ;
   * - une adresse sans compte crée son compte avec le mot de passe fourni.
   * Une adresse qui a déjà un compte doit se connecter : le mot de passe ne s'écrase jamais ici.
   * Recevoir le lien prouve la possession de l'adresse, pas besoin d'une autre vérification.
   */
  async accept(
    token: string,
    input: { fullName: string | null; password: string | null },
    currentUser: User | null,
    now = DateTime.utc()
  ) {
    return db.transaction(async (trx) => {
      const invitation = await Invitation.query({ client: trx })
        .where('token_hash', hashToken(token))
        .forUpdate()
        .first()
      if (!invitation) {
        throw new RuleViolation('invitation_unknown', 'Invitation introuvable.', 404)
      }
      const state = stateOf(invitation, now)
      if (state !== 'open') {
        const messages = {
          expired: 'Cette invitation a expiré : demandez-en une nouvelle.',
          accepted: 'Cette invitation a déjà été utilisée.',
          revoked: 'Cette invitation a été retirée.',
        }
        throw new RuleViolation('invitation_closed', messages[state], 409)
      }

      let user: User
      if (currentUser) {
        if (normalizeEmail(currentUser.email) !== invitation.email) {
          throw new RuleViolation(
            'invitation_wrong_account',
            'Cette invitation est adressée à une autre adresse que celle de votre compte.',
            403
          )
        }
        user = currentUser
      } else {
        const existing = await findUserByEmail(trx, invitation.email)
        if (existing) {
          throw new RuleViolation(
            'account_exists',
            'Un compte existe avec cette adresse : connectez-vous, puis rouvrez le lien.',
            422
          )
        }
        if (!input.password) {
          throw new RuleViolation('invitation_closed', 'Choisissez un mot de passe.', 422)
        }
        user = await User.create(
          { fullName: input.fullName, email: invitation.email, password: input.password },
          { client: trx }
        )
      }

      const existingMembership = await Membership.query({ client: trx })
        .where('organization_id', invitation.organizationId)
        .where('user_id', user.id)
        .first()
      if (!existingMembership) {
        const membership = await Membership.create(
          { organizationId: invitation.organizationId, userId: user.id, role: invitation.role },
          { client: trx }
        )
        await recordAudit(trx, {
          organizationId: invitation.organizationId,
          actorId: user.id,
          action: 'member.added',
          subject: { type: 'membership', id: membership.id },
          metadata: { email: user.email, role: invitation.role, via: 'invitation' },
        })
      }

      invitation.acceptedAt = now
      invitation.acceptedBy = user.id
      await invitation.useTransaction(trx).save()
      return { user, organizationId: invitation.organizationId }
    })
  }
}
