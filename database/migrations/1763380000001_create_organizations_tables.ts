import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Une organisation est l'entreprise cliente : toutes les données métier lui appartiennent.
 * Le rôle d'un membre décide de ce qu'il peut faire, et des étapes de validation qu'il peut traiter.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('organizations', (table) => {
      table.increments('id').notNullable()
      table.string('name', 200).notNullable()
      table.string('slug', 100).notNullable().unique()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    this.schema.createTable('memberships', (table) => {
      table.increments('id').notNullable()
      table
        .integer('organization_id')
        .notNullable()
        .references('organizations.id')
        .onDelete('CASCADE')
      table.integer('user_id').notNullable().references('users.id').onDelete('CASCADE')
      table.string('role', 20).notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['organization_id', 'user_id'])
      table.index(['user_id'])
      table.check(
        "role in ('owner', 'admin', 'legal', 'manager', 'member', 'viewer')",
        [],
        'memberships_role_check'
      )
    })
  }

  async down() {
    this.schema.dropTable('memberships')
    this.schema.dropTable('organizations')
  }
}
