import { ContractTemplateSchema } from '#database/schema'
import type { ContractType } from '#services/vocabulary'
import { column } from '@adonisjs/lucid/orm'

export default class ContractTemplate extends ContractTemplateSchema {
  @column()
  declare type: ContractType
}
