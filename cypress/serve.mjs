// Lance l'application pour les tests de bout en bout : environnement `test`, port 3334,
// antivirus et adresse publique réglés. Multiplateforme : pas de variable d'environnement
// à écrire dans les scripts npm.
import { spawn } from 'node:child_process'

const server = spawn(process.execPath, ['ace', 'serve'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PORT: '3334',
    APP_URL: 'http://localhost:3334',
    CLAMAV_HOST: process.env.CLAMAV_HOST ?? '127.0.0.1',
    CLAMAV_PORT: process.env.CLAMAV_PORT ?? '3310',
  },
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal))
}
server.on('exit', (code) => process.exit(code ?? 0))
