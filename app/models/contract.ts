import { ContractSchema } from '#database/schema'
import Approval from '#models/approval'
import ContractVersion from '#models/contract_version'
import User from '#models/user'
import type { ContractStatus, ContractType } from '#services/vocabulary'
import { belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

export default class Contract extends ContractSchema {
  @column()
  declare status: ContractStatus

  @column()
  declare type: ContractType

  @hasMany(() => ContractVersion, { onQuery: (query) => query.orderBy('number', 'desc') })
  declare versions: HasMany<typeof ContractVersion>

  @hasMany(() => Approval, { onQuery: (query) => query.orderBy('round').orderBy('position') })
  declare approvals: HasMany<typeof Approval>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare author: BelongsTo<typeof User>
}
