import { AuditLogSchema } from '#database/schema'
import User from '#models/user'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/** Journal en ajout seul : la base refuse UPDATE et DELETE sur cette table. */
export default class AuditLog extends AuditLogSchema {
  @column()
  declare metadata: Record<string, string | number | boolean | null>

  @belongsTo(() => User, { foreignKey: 'actorId' })
  declare actor: BelongsTo<typeof User>
}
