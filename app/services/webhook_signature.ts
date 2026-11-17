import { createHmac, timingSafeEqual } from 'node:crypto'
import RuleViolation from '#exceptions/rule_violation'

/** Un événement plus vieux que cela est refusé : un message capturé ne se rejoue pas longtemps. */
export const TOLERANCE_SECONDS = 300

function digest(secret: string, timestamp: number, rawBody: string) {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex')
}

/** En-tête `t=<secondes>,v1=<HMAC-SHA256 de "t.corps">`, calculé sur le corps brut exact. */
export function signWebhook(secret: string, rawBody: string, nowSeconds: number) {
  return `t=${nowSeconds},v1=${digest(secret, nowSeconds, rawBody)}`
}

/**
 * Vérifie l'en-tête avant de lire le moindre champ du corps : signature exacte (comparaison à
 * temps constant), horodatage dans la fenêtre de tolérance.
 */
export function verifyWebhook(
  secret: string,
  header: string | undefined,
  rawBody: string,
  nowSeconds: number
) {
  const refuse = (message: string) => new RuleViolation('invalid_webhook', message, 401)
  if (!header) throw refuse('Signature absente.')

  const parts = Object.fromEntries(
    header.split(',').map((part) => {
      const [key, ...value] = part.trim().split('=')
      return [key, value.join('=')]
    })
  )
  const timestamp = Number(parts.t)
  if (!Number.isInteger(timestamp) || !parts.v1) throw refuse('Signature mal formée.')
  if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) {
    throw refuse('Horodatage hors de la fenêtre de tolérance.')
  }

  const expected = Buffer.from(digest(secret, timestamp, rawBody), 'hex')
  const received = Buffer.from(parts.v1, 'hex')
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw refuse('Signature invalide.')
  }
}
