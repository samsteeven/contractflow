import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Pièces jointes d'un contrat (annexes). Une ligne n'existe que si le fichier a été analysé
 * et trouvé sain : un fichier refusé n'est jamais stocké. Comme le journal, la table est en
 * ajout seul (déclencheur `forbid_change`, voir la migration des contrats).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('attachments', (table) => {
      table.increments('id').notNullable()
      table
        .integer('organization_id')
        .notNullable()
        .references('organizations.id')
        .onDelete('CASCADE')
      table.integer('contract_id').notNullable().references('contracts.id').onDelete('CASCADE')
      table.string('filename', 200).notNullable()
      table.string('content_type', 100).notNullable()
      table.integer('size_bytes').notNullable()
      table.string('checksum', 64).notNullable()
      table.string('storage_key', 500).notNullable()
      table.string('scanner', 40).notNullable()
      table.integer('uploaded_by').notNullable().references('users.id')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['contract_id'])
      table.check('size_bytes > 0', [], 'attachments_size_check')
    })

    this.schema.raw(`
      CREATE TRIGGER attachments_append_only
      BEFORE UPDATE OR DELETE ON attachments
      FOR EACH ROW EXECUTE FUNCTION forbid_change()
    `)
  }

  async down() {
    this.schema.dropTable('attachments')
  }
}
