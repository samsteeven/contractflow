import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Suivi d'un contrat en vigueur : sa durée (`contract_terms`), ce qu'il faut faire et quand
 * (`obligations`), et la trace des rappels envoyés (`reminders`).
 *
 * Ces tables sont séparées de `contracts` à dessein : un contrat signé est figé par la base,
 * mais sa durée se prolonge et ses obligations avancent.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('contract_terms', (table) => {
      table.increments('id').notNullable()
      table
        .integer('contract_id')
        .notNullable()
        .unique()
        .references('contracts.id')
        .onDelete('CASCADE')
      table.date('starts_on').notNullable()
      table.date('ends_on').notNullable()
      table.boolean('auto_renew').notNullable().defaultTo(false)
      // Jours avant la fin pour s'opposer à la reconduction.
      table.integer('notice_days').notNullable().defaultTo(0)
      table.integer('renewal_months').nullable()
      table.string('status', 20).notNullable().defaultTo('active')
      table.integer('created_by').notNullable().references('users.id')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.check('ends_on > starts_on', [], 'contract_terms_dates_check')
      table.check('notice_days between 0 and 365', [], 'contract_terms_notice_check')
      table.check(
        'renewal_months is null or renewal_months between 1 and 60',
        [],
        'contract_terms_renewal_check'
      )
      table.check("status in ('active', 'terminated')", [], 'contract_terms_status_check')
    })

    this.schema.createTable('obligations', (table) => {
      table.increments('id').notNullable()
      table
        .integer('organization_id')
        .notNullable()
        .references('organizations.id')
        .onDelete('CASCADE')
      table.integer('contract_id').notNullable().references('contracts.id').onDelete('CASCADE')
      table.string('title', 200).notNullable()
      table.string('kind', 30).notNullable()
      table.date('due_on').notNullable()
      table.integer('assignee_id').notNullable().references('users.id')
      table.string('status', 20).notNullable().defaultTo('open')
      table.string('notes', 2000).nullable()
      table.timestamp('completed_at').nullable()
      table.integer('completed_by').nullable().references('users.id')
      table.integer('created_by').notNullable().references('users.id')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['organization_id', 'status', 'due_on'])
      table.index(['contract_id'])
      table.check(
        "kind in ('payment', 'delivery', 'report', 'review', 'renewal_notice', 'other')",
        [],
        'obligations_kind_check'
      )
      table.check("status in ('open', 'done', 'cancelled')", [], 'obligations_status_check')
    })
    // Un seul préavis de reconduction ouvert par contrat et par date : le recalculer ne le double pas.
    this.schema.raw(`
      CREATE UNIQUE INDEX obligations_one_open_notice
      ON obligations (contract_id, due_on)
      WHERE kind = 'renewal_notice' AND status = 'open'
    `)

    this.schema.createTable('reminders', (table) => {
      table.increments('id').notNullable()
      table.integer('obligation_id').notNullable().references('obligations.id').onDelete('CASCADE')
      // Palier atteint : d30, d7, d1, d0, overdue. Un rappel par obligation et par palier.
      table.string('stage', 10).notNullable()
      table.integer('recipient_id').notNullable().references('users.id')
      table.timestamp('queued_at').notNullable()
      // queued : à envoyer ; sent : envoyé ; skipped : l'obligation s'est fermée entre-temps.
      table.string('status', 10).notNullable().defaultTo('queued')
      table.timestamp('sent_at').nullable()
      table.integer('attempts').notNullable().defaultTo(0)
      table.string('last_error', 500).nullable()

      table.unique(['obligation_id', 'stage'])
      table.check("stage in ('d30', 'd7', 'd1', 'd0', 'overdue')", [], 'reminders_stage_check')
      table.check("status in ('queued', 'sent', 'skipped')", [], 'reminders_status_check')
    })
  }

  async down() {
    this.schema.dropTable('reminders')
    this.schema.dropTable('obligations')
    this.schema.dropTable('contract_terms')
  }
}
