import { AttachmentSchema } from '#database/schema'
import User from '#models/user'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/** Pièce jointe analysée et saine. Immuable : la base refuse UPDATE et DELETE. */
export default class Attachment extends AttachmentSchema {
  @belongsTo(() => User, { foreignKey: 'uploadedBy' })
  declare uploader: BelongsTo<typeof User>
}
