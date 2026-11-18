import { createConnection } from 'node:net'
import env from '#start/env'

export type ScanResult = { clean: true } | { clean: false; signature: string }

/** Un analyseur qui n'a pas pu rendre de verdict : le fichier n'est alors pas accepté. */
export class ScannerUnavailable extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScannerUnavailable'
  }
}

export interface VirusScanner {
  readonly name: string
  scan(data: Buffer): Promise<ScanResult>
}

const CHUNK_SIZE = 64 * 1024

/**
 * ClamAV par son protocole `INSTREAM` (démon `clamd`, port 3310) : la commande `zINSTREAM`,
 * puis le fichier en blocs précédés de leur taille sur quatre octets, puis un bloc de taille
 * zéro. Le démon répond `stream: OK` ou `stream: <signature> FOUND`.
 *
 * Tout ce qui n'est pas un verdict net (connexion refusée, délai dépassé, réponse inattendue,
 * limite de taille du démon) lève `ScannerUnavailable` : on ne laisse jamais passer un fichier
 * que l'on n'a pas pu analyser.
 */
export class ClamAvScanner implements VirusScanner {
  readonly name = 'clamav'

  constructor(
    private host: string,
    private port: number,
    private timeoutMs = 20_000
  ) {}

  static fromEnv(): VirusScanner | null {
    const host = env.get('CLAMAV_HOST')
    if (!host) return null
    return new ClamAvScanner(host, env.get('CLAMAV_PORT', 3310))
  }

  scan(data: Buffer): Promise<ScanResult> {
    return new Promise((resolve, reject) => {
      const socket = createConnection({ host: this.host, port: this.port })
      const chunks: Buffer[] = []
      let settled = false
      const finish = (action: () => void) => {
        if (settled) return
        settled = true
        socket.destroy()
        action()
      }
      const fail = (reason: string) =>
        finish(() => reject(new ScannerUnavailable(`Analyse antivirus impossible : ${reason}`)))

      socket.setTimeout(this.timeoutMs, () => fail('délai dépassé'))
      socket.on('error', (error) => fail(error.message))
      socket.on('data', (chunk: Buffer) => chunks.push(chunk))
      socket.on('close', () => {
        const answer = Buffer.concat(chunks).toString('utf8').replace(/\0/g, '').trim()
        const found = /^stream: (.+) FOUND$/.exec(answer)
        if (answer === 'stream: OK') finish(() => resolve({ clean: true }))
        else if (found) finish(() => resolve({ clean: false, signature: found[1] }))
        else fail(`réponse inattendue (${answer.slice(0, 80) || 'vide'})`)
      })

      socket.on('connect', () => {
        socket.write('zINSTREAM\0')
        for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
          const chunk = data.subarray(offset, offset + CHUNK_SIZE)
          const size = Buffer.alloc(4)
          size.writeUInt32BE(chunk.length)
          socket.write(size)
          socket.write(chunk)
        }
        socket.write(Buffer.alloc(4)) // bloc de taille zéro : fin du flux
      })
    })
  }
}
