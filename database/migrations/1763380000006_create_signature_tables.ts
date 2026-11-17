import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Signature électronique : une demande par contrat approuvé, des signataires, les événements
 * reçus du prestataire (en ajout seul, un identifiant d'événement ne s'enregistre qu'une fois)
 * et la preuve archivée à la fin.
 *
 * Un contrat signé est figé par la base elle-même : un déclencheur refuse toute modification
 * ou suppression d'une ligne `contracts` dont l'état est `signed`.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw('ALTER TABLE contracts DROP CONSTRAINT contracts_status_check')
    this.schema.raw(`
      ALTER TABLE contracts ADD CONSTRAINT contracts_status_check
      CHECK (status in ('draft', 'in_review', 'approved', 'rejected', 'signing', 'signed'))
    `)

    this.schema.createTable('signature_requests', (table) => {
      table.increments('id').notNullable()
      table.integer('contract_id').notNullable().references('contracts.id').onDelete('CASCADE')
      table.integer('contract_version_id').notNullable().references('contract_versions.id')
      table.integer('document_id').notNullable().references('contract_documents.id')
      table.string('provider', 30).notNullable()
      table.string('external_id', 100).notNullable().unique()
      table.string('status', 20).notNullable().defaultTo('pending')
      table.integer('requested_by').notNullable().references('users.id')
      table.timestamp('completed_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.check(
        "status in ('pending', 'completed', 'declined', 'cancelled')",
        [],
        'signature_requests_status_check'
      )
    })
    // Une seule demande en cours par contrat.
    this.schema.raw(`
      CREATE UNIQUE INDEX signature_requests_one_pending
      ON signature_requests (contract_id) WHERE status = 'pending'
    `)

    this.schema.createTable('signature_signers', (table) => {
      table.increments('id').notNullable()
      table
        .integer('signature_request_id')
        .notNullable()
        .references('signature_requests.id')
        .onDelete('CASCADE')
      table.string('name', 200).notNullable()
      table.string('email', 254).notNullable()
      // Identifiant du signataire chez le prestataire ; il sert aussi de capacité d'accès
      // à la page de signature du bac à sable : long, aléatoire, unique.
      table.string('external_id', 100).notNullable().unique()
      table.string('status', 20).notNullable().defaultTo('pending')
      table.timestamp('signed_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['signature_request_id', 'email'])
      table.check(
        "status in ('pending', 'signed', 'declined')",
        [],
        'signature_signers_status_check'
      )
    })

    this.schema.createTable('signature_events', (table) => {
      table.increments('id').notNullable()
      // Identifiant fourni par le prestataire : rejouer un événement ne le traite pas deux fois.
      table.string('event_id', 100).notNullable().unique()
      table.string('type', 40).notNullable()
      table.integer('signature_request_id').nullable().references('signature_requests.id')
      table.jsonb('payload').notNullable()
      table.string('outcome', 20).notNullable()
      table.timestamp('created_at').notNullable()

      table.check("outcome in ('applied', 'ignored')", [], 'signature_events_outcome_check')
    })

    this.schema.createTable('signature_proofs', (table) => {
      table.increments('id').notNullable()
      table
        .integer('signature_request_id')
        .notNullable()
        .unique()
        .references('signature_requests.id')
      table.string('storage_key', 300).notNullable().unique()
      table.specificType('checksum', 'char(64)').notNullable()
      table.timestamp('created_at').notNullable()
    })

    this.schema.raw(`
      CREATE TRIGGER signature_events_immutable
      BEFORE UPDATE OR DELETE ON signature_events
      FOR EACH ROW EXECUTE FUNCTION forbid_change()
    `)
    this.schema.raw(`
      CREATE TRIGGER signature_proofs_immutable
      BEFORE UPDATE OR DELETE ON signature_proofs
      FOR EACH ROW EXECUTE FUNCTION forbid_change()
    `)

    this.schema.raw(`
      CREATE OR REPLACE FUNCTION freeze_signed_contract() RETURNS trigger AS $$
      BEGIN
        IF OLD.status = 'signed' THEN
          RAISE EXCEPTION 'contrat signé : immuable';
        END IF;
        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `)
    this.schema.raw(`
      CREATE TRIGGER contracts_frozen_when_signed
      BEFORE UPDATE OR DELETE ON contracts
      FOR EACH ROW EXECUTE FUNCTION freeze_signed_contract()
    `)
  }

  async down() {
    this.schema.raw('DROP TRIGGER IF EXISTS contracts_frozen_when_signed ON contracts')
    this.schema.raw('DROP FUNCTION IF EXISTS freeze_signed_contract()')
    this.schema.dropTable('signature_proofs')
    this.schema.dropTable('signature_events')
    this.schema.dropTable('signature_signers')
    this.schema.dropTable('signature_requests')
    this.schema.raw('ALTER TABLE contracts DROP CONSTRAINT contracts_status_check')
    this.schema.raw(`
      ALTER TABLE contracts ADD CONSTRAINT contracts_status_check
      CHECK (status in ('draft', 'in_review', 'approved', 'rejected'))
    `)
  }
}
