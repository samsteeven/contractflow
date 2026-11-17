import { randomBytes } from 'node:crypto'
import { signWebhook } from '#services/webhook_signature'
import env from '#start/env'

export type SignerInput = { name: string; email: string }

export type CreatedRequest = {
  externalId: string
  signers: { email: string; externalId: string }[]
}

export type WebhookEvent = {
  id: string
  type: 'signer.signed' | 'signer.declined'
  occurredAt: string
  requestId: string
  signerId: string
}

/**
 * Ce que l'application attend d'un prestataire de signature. Un prestataire réel (Yousign,
 * Docusign…) s'ajoute en écrivant un autre adaptateur ; le reste du code ne le connaît pas.
 * Les événements reviennent par webhook signé, jamais par un retour d'appel.
 */
export interface SignatureProvider {
  readonly name: string
  createRequest(input: {
    title: string
    documentChecksum: string
    signers: SignerInput[]
  }): Promise<CreatedRequest>
  cancelRequest(externalId: string): Promise<void>
  /** Adresse où un signataire signe, quand le prestataire en fournit une. */
  signUrl(signerExternalId: string): string | null
}

const token = (prefix: string) => `${prefix}_${randomBytes(18).toString('base64url')}`

/**
 * Bac à sable intégré : il joue le rôle du prestataire sans compte ni réseau. Il fournit une
 * page de signature (`/sandbox/sign/:id`) et émet de vrais événements signés avec le secret
 * partagé, que `SignatureWebhookService` vérifie comme ceux d'un prestataire extérieur.
 */
export class SandboxSignatureProvider implements SignatureProvider {
  readonly name = 'sandbox'

  async createRequest(input: { signers: SignerInput[] }): Promise<CreatedRequest> {
    return {
      externalId: token('sbx_req'),
      signers: input.signers.map((signer) => ({
        email: signer.email,
        externalId: token('sbx_sig'),
      })),
    }
  }

  async cancelRequest() {}

  signUrl(signerExternalId: string) {
    return `${env.get('APP_URL', 'http://localhost:3333')}/sandbox/sign/${signerExternalId}`
  }

  /** Un événement tel que le prestataire l'enverrait : corps brut et en-tête de signature. */
  buildEvent(event: Omit<WebhookEvent, 'id' | 'occurredAt'>, now = new Date()) {
    const body: WebhookEvent = {
      ...event,
      id: token('evt'),
      occurredAt: now.toISOString(),
    }
    const rawBody = JSON.stringify(body)
    const header = signWebhook(
      env.get('SIGNATURE_WEBHOOK_SECRET'),
      rawBody,
      Math.floor(now.getTime() / 1000)
    )
    return { rawBody, header }
  }
}

let provider: SignatureProvider | null = null

export function signatureProvider(): SignatureProvider {
  provider ??= new SandboxSignatureProvider()
  return provider
}
