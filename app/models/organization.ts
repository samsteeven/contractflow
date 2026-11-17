import { OrganizationSchema } from '#database/schema'
import Membership from '#models/membership'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'

export default class Organization extends OrganizationSchema {
  @hasMany(() => Membership)
  declare memberships: HasMany<typeof Membership>
}
