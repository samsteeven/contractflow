import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Un circuit de validation est une donnée, pas du code : une suite ordonnée d'étapes,
 * chacune confiée à un rôle. Une organisation en définit autant qu'elle veut.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('workflows', (table) => {
      table.increments('id').notNullable()
      table
        .integer('organization_id')
        .notNullable()
        .references('organizations.id')
        .onDelete('CASCADE')
      table.string('name', 200).notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['organization_id', 'name'])
    })

    this.schema.createTable('workflow_steps', (table) => {
      table.increments('id').notNullable()
      table.integer('workflow_id').notNullable().references('workflows.id').onDelete('CASCADE')
      table.integer('position').notNullable()
      table.string('name', 200).notNullable()
      table.string('approver_role', 20).notNullable()

      table.unique(['workflow_id', 'position'])
      table.check('position >= 1', [], 'workflow_steps_position_check')
      // Seuls ces rôles valident : un rédacteur ou un lecteur ne peut pas être approbateur.
      table.check(
        "approver_role in ('owner', 'admin', 'legal', 'manager')",
        [],
        'workflow_steps_approver_role_check'
      )
    })
  }

  async down() {
    this.schema.dropTable('workflow_steps')
    this.schema.dropTable('workflows')
  }
}
