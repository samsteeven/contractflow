/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  // Base de données
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.secret(),
  DB_DATABASE: Env.schema.string(),
  // Connexion chiffrée (RDS) : vérifiée avec le certificat de l'autorité d'AWS (NODE_EXTRA_CA_CERTS)
  DB_SSL: Env.schema.boolean.optional(),

  // Session
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'database'] as const),

  /*
  |----------------------------------------------------------
  | Variables for configuring the drive package
  |----------------------------------------------------------
  */
  DRIVE_DISK: Env.schema.enum(['fs', 's3'] as const),
  AWS_ACCESS_KEY_ID: Env.schema.string.optional(),
  AWS_SECRET_ACCESS_KEY: Env.schema.string.optional(),
  AWS_REGION: Env.schema.string.optional(),
  S3_BUCKET: Env.schema.string.optional(),
  S3_ENDPOINT: Env.schema.string.optional(),

  // Signature électronique : prestataire et secret partagé des webhooks entrants
  SIGNATURE_PROVIDER: Env.schema.enum(['sandbox'] as const),
  SIGNATURE_WEBHOOK_SECRET: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the mail package
  |----------------------------------------------------------
  */
  MAIL_MAILER: Env.schema.enum(['smtp'] as const),
  MAIL_FROM_NAME: Env.schema.string(),
  MAIL_FROM_ADDRESS: Env.schema.string(),
  SMTP_HOST: Env.schema.string(),
  SMTP_PORT: Env.schema.number(),
  // Authentification SMTP (Amazon SES) ; absentes en local avec Mailpit
  SMTP_USERNAME: Env.schema.string.optional(),
  SMTP_PASSWORD: Env.schema.secret.optional(),

  // File de tâches (BullMQ sur Redis) pour les rappels d'échéances
  REDIS_HOST: Env.schema.string(),
  REDIS_PORT: Env.schema.number(),
  // ElastiCache : jeton d'authentification et chiffrement en transit
  REDIS_PASSWORD: Env.schema.secret.optional(),
  REDIS_TLS: Env.schema.boolean.optional(),

  // Antivirus (clamd). Sans hôte, les pièces jointes sont refusées : jamais acceptées sans analyse.
  CLAMAV_HOST: Env.schema.string.optional(),
  CLAMAV_PORT: Env.schema.number.optional(),

  // Derrière un répartiteur de charge : faire confiance à ses en-têtes X-Forwarded-*
  TRUST_PROXY: Env.schema.boolean.optional(),
})
