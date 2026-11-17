import { ContractDocumentSchema } from '#database/schema'
import ContractVersion from '#models/contract_version'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/** PDF archivé d'une version validée. Immuable : la base refuse UPDATE et DELETE. */
export default class ContractDocument extends ContractDocumentSchema {
  @belongsTo(() => ContractVersion, { foreignKey: 'contractVersionId' })
  declare version: BelongsTo<typeof ContractVersion>
}
