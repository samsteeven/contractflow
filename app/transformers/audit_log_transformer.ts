import type AuditLog from '#models/audit_log'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class AuditLogTransformer extends BaseTransformer<AuditLog> {
  toObject() {
    const actor = this.resource.actor
    return {
      ...this.pick(this.resource, ['id', 'action', 'metadata', 'createdAt']),
      // Sans acteur : l'événement vient du prestataire de signature.
      actor: actor ? (actor.fullName ?? actor.email) : 'Prestataire de signature',
    }
  }
}
