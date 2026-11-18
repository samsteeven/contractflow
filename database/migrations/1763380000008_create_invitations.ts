import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Invitation d'une personne à rejoindre une organisation. Le jeton n'est jamais stocké :
 * seule son empreinte SHA-256 l'est, comme pour un mot de passe, pour qu'une fuite de la base
 * ne donne pas de liens utilisables.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('invitations', (table) => {
      table.increments('id').notNullable()
      table
        .integer('organization_id')
        .notNullable()
        .references('organizations.id')
        .onDelete('CASCADE')
      table.string('email', 254).notNullable()
      table.string('role', 20).notNullable()
      table.string('token_hash', 64).notNullable().unique()
      table.integer('invited_by').notNullable().references('users.id')
      table.timestamp('expires_at').notNullable()
      table.timestamp('accepted_at').nullable()
      table.integer('accepted_by').nullable().references('users.id')
      table.timestamp('revoked_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.check(
        "role in ('owner', 'admin', 'legal', 'manager', 'member', 'viewer')",
        [],
        'invitations_role_check'
      )
      table.check('email = lower(email)', [], 'invitations_email_lower_check')
    })

    // Une seule invitation ouverte par adresse et par organisation : en renvoyer une
    // remplace le jeton, elle ne s'ajoute pas.
    this.schema.raw(`
      CREATE UNIQUE INDEX invitations_one_open
      ON invitations (organization_id, email)
      WHERE accepted_at IS NULL AND revoked_at IS NULL
    `)
  }

  async down() {
    this.schema.dropTable('invitations')
  }
}
