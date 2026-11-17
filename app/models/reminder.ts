import { ReminderSchema } from '#database/schema'
import Obligation from '#models/obligation'
import User from '#models/user'
import type { ReminderStage } from '#services/vocabulary'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Reminder extends ReminderSchema {
  @column()
  declare stage: ReminderStage

  @column()
  declare status: 'queued' | 'sent' | 'skipped'

  @belongsTo(() => Obligation)
  declare obligation: BelongsTo<typeof Obligation>

  @belongsTo(() => User, { foreignKey: 'recipientId' })
  declare recipient: BelongsTo<typeof User>
}
