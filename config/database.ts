import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
  connection: 'pg',

  connections: {
    pg: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD').release(),
        database: env.get('DB_DATABASE'),
        ssl: env.get('DB_SSL') ? { rejectUnauthorized: true } : false,
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      /**
       * database/schema.ts est régénéré à chaque `migration:run` : les colonnes des modèles
       * viennent des migrations, jamais d'une déclaration écrite à la main.
       */
      schemaGeneration: {
        // Régénéré en développement seulement : jamais dans une image de production.
        enabled: env.get('NODE_ENV') !== 'production',
        rulesPaths: ['./database/schema_rules.js'],
      },
    },
  },
})

export default dbConfig
