import { SignatureRequestSchema } from '#database/schema'
import SignatureSigner from '#models/signature_signer'
import type { SignatureStatus } from '#services/vocabulary'
import { column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'

export default class SignatureRequest extends SignatureRequestSchema {
  @column()
  declare status: SignatureStatus

  @hasMany(() => SignatureSigner, { onQuery: (query) => query.orderBy('id') })
  declare signers: HasMany<typeof SignatureSigner>
}
