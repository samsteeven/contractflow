import { ObligationSchema } from '#database/schema'
import Contract from '#models/contract'
import User from '#models/user'
import type { ObligationKind, ObligationStatus } from '#services/vocabulary'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Obligation extends ObligationSchema {
  @column()
  declare kind: ObligationKind

  @column()
  declare status: ObligationStatus

  @belongsTo(() => User, { foreignKey: 'assigneeId' })
  declare assignee: BelongsTo<typeof User>

  @belongsTo(() => Contract)
  declare contract: BelongsTo<typeof Contract>
}
