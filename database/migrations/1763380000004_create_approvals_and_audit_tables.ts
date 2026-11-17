import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * À la soumission, les étapes du circuit sont copiées dans `approvals` : modifier le circuit
 * ensuite ne change pas une validation en cours. Chaque décision porte sur une version précise.
 *
 * `audit_logs` est un journal : on y ajoute, on n'y modifie ni ne supprime rien.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('approvals', (table) => {
      table.increments('id').notNullable()
      table.integer('contract_id').notNullable().references('contracts.id').onDelete('CASCADE')
      table.integer('contract_version_id').notNullable().references('contract_versions.id')
      table.integer('round').notNullable()
      table.integer('position').notNullable()
      table.string('step_name', 200).notNullable()
      table.string('approver_role', 20).notNullable()
      table.string('status', 20).notNullable().defaultTo('pending')
      table.integer('decided_by').nullable().references('users.id')
      table.timestamp('decided_at').nullable()
      table.string('comment', 2000).nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['contract_id', 'round', 'position'])
      table.check(
        "status in ('pending', 'approved', 'rejected', 'skipped')",
        [],
        'approvals_status_check'
      )
      // Une décision a toujours un auteur et une date ; une étape en attente n'en a pas.
      table.check(
        "(status in ('approved', 'rejected')) = (decided_by is not null and decided_at is not null)",
        [],
        'approvals_decision_check'
      )
    })

    this.schema.createTable('audit_logs', (table) => {
      table.increments('id').notNullable()
      table
        .integer('organization_id')
        .notNullable()
        .references('organizations.id')
        .onDelete('CASCADE')
      table.integer('actor_id').nullable().references('users.id')
      table.string('action', 60).notNullable()
      table.string('subject_type', 40).notNullable()
      table.integer('subject_id').notNullable()
      table.jsonb('metadata').notNullable().defaultTo('{}')
      table.timestamp('created_at').notNullable()

      table.index(['organization_id', 'subject_type', 'subject_id'])
    })

    this.schema.raw(`
      CREATE TRIGGER audit_logs_immutable
      BEFORE UPDATE OR DELETE ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION forbid_change()
    `)
  }

  async down() {
    this.schema.dropTable('audit_logs')
    this.schema.dropTable('approvals')
  }
}
