import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Modèles de contrats (texte avec variables `{{nom}}`), commentaires sur un contrat et
 * documents PDF archivés. Comme les versions et le journal, commentaires et documents sont
 * en ajout seul : la base refuse de les modifier (déclencheur `forbid_change`, voir la
 * migration des contrats). Un PDF atteste d'une version validée à une date donnée.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('contract_templates', (table) => {
      table.increments('id').notNullable()
      table
        .integer('organization_id')
        .notNullable()
        .references('organizations.id')
        .onDelete('CASCADE')
      table.string('name', 200).notNullable()
      table.string('type', 20).notNullable()
      table.text('body').notNullable()
      table.integer('created_by').notNullable().references('users.id')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['organization_id', 'name'])
      table.check(
        "type in ('service', 'supplier', 'subcontracting', 'nda', 'partnership')",
        [],
        'contract_templates_type_check'
      )
    })

    this.schema.alterTable('contracts', (table) => {
      table
        .integer('template_id')
        .nullable()
        .references('contract_templates.id')
        .onDelete('SET NULL')
    })

    this.schema.createTable('comments', (table) => {
      table.increments('id').notNullable()
      table.integer('contract_id').notNullable().references('contracts.id').onDelete('CASCADE')
      // Version lue au moment du commentaire : un commentaire se rapporte à un texte précis.
      table.integer('contract_version_id').notNullable().references('contract_versions.id')
      table.integer('author_id').notNullable().references('users.id')
      table.string('body', 2000).notNullable()
      table.timestamp('created_at').notNullable()

      table.index(['contract_id', 'id'])
    })

    this.schema.createTable('contract_documents', (table) => {
      table.increments('id').notNullable()
      table.integer('contract_id').notNullable().references('contracts.id').onDelete('CASCADE')
      // Un seul PDF par version : régénérer ne remplace rien.
      table.integer('contract_version_id').notNullable().unique().references('contract_versions.id')
      table.string('storage_key', 300).notNullable().unique()
      table.string('content_type', 100).notNullable()
      table.integer('size_bytes').notNullable()
      table.specificType('checksum', 'char(64)').notNullable()
      table.integer('generated_by').notNullable().references('users.id')
      table.timestamp('created_at').notNullable()
    })

    this.schema.raw(`
      CREATE TRIGGER comments_immutable
      BEFORE UPDATE OR DELETE ON comments
      FOR EACH ROW EXECUTE FUNCTION forbid_change()
    `)
    this.schema.raw(`
      CREATE TRIGGER contract_documents_immutable
      BEFORE UPDATE OR DELETE ON contract_documents
      FOR EACH ROW EXECUTE FUNCTION forbid_change()
    `)
  }

  async down() {
    this.schema.dropTable('contract_documents')
    this.schema.dropTable('comments')
    this.schema.alterTable('contracts', (table) => {
      table.dropColumn('template_id')
    })
    this.schema.dropTable('contract_templates')
  }
}
