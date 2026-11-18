import { spawnSync } from 'node:child_process'
import { crc32 } from 'node:zlib'
import { defineConfig } from 'cypress'

/**
 * Tests de bout en bout : un vrai navigateur contre l'application complète (PostgreSQL,
 * boîte de réception Mailpit, antivirus ClamAV). L'application tourne en environnement `test`
 * sur le port 3334 (`npm run e2e:serve`), sur la base `contractflow_test` : ne pas lancer en
 * même temps que `npm test`, qui vide cette base.
 */
const ENV = { ...process.env, NODE_ENV: 'test' }

function ace(...args: string[]) {
  const result = spawnSync(process.execPath, ['ace', ...args], { env: ENV, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`node ace ${args.join(' ')} a échoué :\n${result.stdout}\n${result.stderr}`)
  }
}

/** La chaîne de test EICAR, coupée en deux pour qu'aucun fichier du dépôt ne la contienne en entier. */
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-' + 'STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'

/** Archive ZIP à entrées non compressées, assez pour faire un « .docx » qu'un antivirus ouvre. */
function storedZip(entries: Record<string, string>) {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name)
    const data = Buffer.from(content)
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)
    locals.push(local, nameBytes, data)
    centrals.push(central, nameBytes)
    offset += local.length + nameBytes.length + data.length
  }
  const directory = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(entries).length, 8)
  end.writeUInt16LE(Object.keys(entries).length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, directory, end])
}

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3334',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
    screenshotOnRunFailure: true,
    viewportWidth: 1280,
    viewportHeight: 800,
    defaultCommandTimeout: 8000,
    setupNodeEvents(on) {
      on('task', {
        /** Base vierge puis données de démonstration : chaque scénario part d'un état connu. */
        reset() {
          ace('migration:fresh')
          ace('db:seed', '--files', 'database/seeders/demo_seeder.ts')
          return null
        },
        /** Un .docx infecté (ou sain), en base64, construit à la volée. */
        docx(infected: boolean) {
          const entries: Record<string, string> = { 'word/document.xml': '<w:document/>' }
          if (infected) entries['eicar.com'] = EICAR
          return storedZip(entries).toString('base64')
        },
      })
    },
  },
})
