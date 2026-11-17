import { ApprovalSchema } from '#database/schema'
import ContractVersion from '#models/contract_version'
import User from '#models/user'
import type { ApprovalStatus, ApproverRole } from '#services/vocabulary'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Approval extends ApprovalSchema {
  @column()
  declare status: ApprovalStatus

  @column()
  declare approverRole: ApproverRole

  @belongsTo(() => User, { foreignKey: 'decidedBy' })
  declare decider: BelongsTo<typeof User>

  @belongsTo(() => ContractVersion)
  declare version: BelongsTo<typeof ContractVersion>
}
