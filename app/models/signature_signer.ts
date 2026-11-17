import { SignatureSignerSchema } from '#database/schema'
import type { SignerStatus } from '#services/vocabulary'
import { column } from '@adonisjs/lucid/orm'

export default class SignatureSigner extends SignatureSignerSchema {
  @column()
  declare status: SignerStatus
}
