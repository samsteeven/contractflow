import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, services } from '@adonisjs/drive'

/**
 * Les PDF ne sont jamais publics : on les livre par URL pré-signée à durée courte.
 * `fs` sert au développement sans S3 et aux tests ; `s3` vise AWS, ou MinIO en local
 * (S3_ENDPOINT) avec adressage par chemin.
 */
const driveConfig = defineConfig({
  default: env.get('DRIVE_DISK'),

  services: {
    fs: services.fs({
      location: app.makePath(env.get('NODE_ENV') === 'test' ? 'tmp/storage' : 'storage'),
      serveFiles: true,
      routeBasePath: '/storage',
      visibility: 'private',
    }),
    s3: services.s3({
      // Sur AWS, aucun identifiant : le rôle de la tâche fournit les droits (chaîne par défaut du SDK).
      // Des identifiants vides empêcheraient ce mécanisme ; on ne les passe que s'ils existent.
      ...(env.get('AWS_ACCESS_KEY_ID') && env.get('AWS_SECRET_ACCESS_KEY')
        ? {
            credentials: {
              accessKeyId: env.get('AWS_ACCESS_KEY_ID')!,
              secretAccessKey: env.get('AWS_SECRET_ACCESS_KEY')!,
            },
          }
        : {}),
      region: env.get('AWS_REGION', 'eu-west-3'),
      bucket: env.get('S3_BUCKET', 'contractflow-documents'),
      endpoint: env.get('S3_ENDPOINT'),
      forcePathStyle: Boolean(env.get('S3_ENDPOINT')),
      visibility: 'private',
    }),
  },
})

export default driveConfig

declare module '@adonisjs/drive/types' {
  export interface DriveDisks extends InferDriveDisks<typeof driveConfig> {}
}
