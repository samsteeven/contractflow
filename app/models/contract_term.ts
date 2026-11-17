import { ContractTermSchema } from '#database/schema'
import type { TermStatus } from '#services/vocabulary'
import { column } from '@adonisjs/lucid/orm'

export default class ContractTerm extends ContractTermSchema {
  @column()
  declare status: TermStatus
}
