import { SignatureEventSchema } from '#database/schema'
import { column } from '@adonisjs/lucid/orm'

/** Journal des événements du prestataire. Immuable : la base refuse UPDATE et DELETE. */
export default class SignatureEvent extends SignatureEventSchema {
  @column()
  declare payload: Record<string, unknown>
}
