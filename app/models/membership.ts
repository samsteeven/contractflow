import { MembershipSchema } from '#database/schema'
import Organization from '#models/organization'
import User from '#models/user'
import type { Role } from '#services/vocabulary'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Membership extends MembershipSchema {
  @column()
  declare role: Role

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
