import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Un contrat ne porte que son état ; son texte vit dans ses versions, qui ne changent jamais.
 * La base elle-même refuse de modifier ou de supprimer une version : la règle ne dépend pas
 * de la discipline du code applicatif.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('contracts', (table) => {
      table.increments('id').notNullable()
      table
        .integer('organization_id')
        .notNullable()
        .references('organizations.id')
        .onDelete('CASCADE')
      table.string('title', 200).notNullable()
      table.string('counterparty', 200).notNullable()
      table.string('type', 20).notNullable()
      table.string('status', 20).notNullable().defaultTo('draft')
      // Circuit choisi à la dernière soumission, et numéro du tour de validation en cours.
      table.integer('workflow_id').nullable().references('workflows.id').onDelete('SET NULL')
      table.integer('review_round').notNullable().defaultTo(0)
      table.integer('created_by').notNullable().references('users.id')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['organization_id', 'status'])
      table.check(
        "type in ('service', 'supplier', 'subcontracting', 'nda', 'partnership')",
        [],
        'contracts_type_check'
      )
      table.check(
        "status in ('draft', 'in_review', 'approved', 'rejected')",
        [],
        'contracts_status_check'
      )
    })

    this.schema.createTable('contract_versions', (table) => {
      table.increments('id').notNullable()
      table.integer('contract_id').notNullable().references('contracts.id').onDelete('CASCADE')
      table.integer('number').notNullable()
      table.text('body').notNullable()
      table.string('change_note', 500).nullable()
      table.integer('author_id').notNullable().references('users.id')
      // SHA-256 du texte : prouve quel texte exact a été validé.
      table.specificType('checksum', 'char(64)').notNullable()
      table.timestamp('created_at').notNullable()

      table.unique(['contract_id', 'number'])
      table.check('number >= 1', [], 'contract_versions_number_check')
    })

    // OR REPLACE : `migration:fresh` supprime les tables, pas les fonctions.
    this.schema.raw(`
      CREATE OR REPLACE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION '% : les lignes de % sont immuables', TG_OP, TG_TABLE_NAME
          USING ERRCODE = 'integrity_constraint_violation';
      END $$
    `)
    this.schema.raw(`
      CREATE TRIGGER contract_versions_immutable
      BEFORE UPDATE OR DELETE ON contract_versions
      FOR EACH ROW EXECUTE FUNCTION forbid_change()
    `)
  }

  async down() {
    this.schema.dropTable('contract_versions')
    this.schema.dropTable('contracts')
    this.schema.raw('DROP FUNCTION forbid_change()')
  }
}
