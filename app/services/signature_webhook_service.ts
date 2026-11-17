import { createHash } from 'node:crypto'
import RuleViolation from '#exceptions/rule_violation'
import Contract from '#models/contract'
import ContractVersion from '#models/contract_version'
import SignatureEvent from '#models/signature_event'
import SignatureProof from '#models/signature_proof'
import SignatureRequest from '#models/signature_request'
import { recordAudit } from '#services/audit'
import { lockContract } from '#services/contract_service'
import type { WebhookEvent } from '#services/signature_provider'
import { verifyWebhook } from '#services/webhook_signature'
import env from '#start/env'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

export type WebhookResult = 'applied' | 'ignored' | 'duplicate'

const TYPES = ['signer.signed', 'signer.declined'] as const

function parseEvent(rawBody: string): WebhookEvent {
  let data: Record<string, unknown>
  try {
    data = JSON.parse(rawBody)
  } catch {
    throw new RuleViolation('invalid_webhook', 'Corps illisible.', 422)
  }
  const text = (value: unknown) => (typeof value === 'string' && value.length <= 100 ? value : null)
  const id = text(data.id)
  const requestId = text(data.requestId)
  const signerId = text(data.signerId)
  const type = TYPES.find((candidate) => candidate === data.type)
  if (!id || !requestId || !signerId || !type || typeof data.occurredAt !== 'string') {
    throw new RuleViolation('invalid_webhook', 'Événement incomplet ou inconnu.', 422)
  }
  return { id, type, requestId, signerId, occurredAt: data.occurredAt }
}

export default class SignatureWebhookService {
  /**
   * Point d'entrée des événements du prestataire. L'ordre compte :
   * 1. la signature et l'horodatage sont vérifiés avant de lire le corps ;
   * 2. tout le reste se passe sous le verrou du contrat, donc deux livraisons simultanées de
   *    la même demande s'exécutent l'une après l'autre ;
   * 3. un identifiant d'événement déjà vu est ignoré (les prestataires rejouent) ;
   * 4. un événement qui ne correspond plus à l'état (demande annulée, signataire déjà
   *    décidé) est archivé mais n'a aucun effet.
   */
  async handle(
    rawBody: string,
    header: string | undefined,
    now = DateTime.utc()
  ): Promise<WebhookResult> {
    verifyWebhook(env.get('SIGNATURE_WEBHOOK_SECRET'), header, rawBody, Math.floor(now.toSeconds()))
    const event = parseEvent(rawBody)

    const known = await SignatureRequest.query().where('external_id', event.requestId).firstOrFail()
    const owner = await Contract.query().where('id', known.contractId).firstOrFail()

    return db.transaction(async (trx) => {
      const contract = await lockContract(trx, owner.organizationId, owner.id)

      const seen = await SignatureEvent.query({ client: trx }).where('event_id', event.id).first()
      if (seen) return 'duplicate'

      const request = await SignatureRequest.query({ client: trx })
        .where('id', known.id)
        .preload('signers')
        .firstOrFail()
      const signer = request.signers.find((candidate) => candidate.externalId === event.signerId)

      let outcome: 'applied' | 'ignored' = 'ignored'
      if (request.status === 'pending' && signer && signer.status === 'pending') {
        outcome = 'applied'
        signer.status = event.type === 'signer.signed' ? 'signed' : 'declined'
        signer.signedAt = event.type === 'signer.signed' ? now : null
        await signer.save()

        if (event.type === 'signer.declined') {
          request.status = 'declined'
          request.completedAt = now
          await request.save()
          contract.status = 'approved'
          await contract.save()
          await recordAudit(trx, {
            organizationId: contract.organizationId,
            actorId: null,
            action: 'signature.declined',
            subject: { type: 'contract', id: contract.id },
            metadata: { signer: signer.email },
          })
        } else {
          await recordAudit(trx, {
            organizationId: contract.organizationId,
            actorId: null,
            action: 'signature.signed',
            subject: { type: 'contract', id: contract.id },
            metadata: { signer: signer.email },
          })
          if (request.signers.every((candidate) => candidate.status === 'signed')) {
            await this.complete(trx, contract, request, now, event)
          }
        }
      }

      await SignatureEvent.create(
        {
          eventId: event.id,
          type: event.type,
          signatureRequestId: request.id,
          payload: { ...event },
          outcome,
        },
        { client: trx }
      )
      return outcome
    })
  }

  /**
   * Dernier signataire : la demande est complète, le contrat passe à `signed` (la base le fige
   * alors) et la preuve est archivée. Le fichier est écrit avant la ligne ; si la base échoue,
   * il est retiré.
   */
  private async complete(
    trx: TransactionClientContract,
    contract: Contract,
    request: SignatureRequest,
    now: DateTime,
    current: WebhookEvent
  ) {
    const version = await ContractVersion.findOrFail(request.contractVersionId, { client: trx })
    const events = await SignatureEvent.query({ client: trx })
      .where('signature_request_id', request.id)
      .where('outcome', 'applied')
      .orderBy('id')

    // L'événement en cours n'est enregistré qu'après coup : on l'ajoute à ceux déjà archivés.
    const eventOf = new Map(events.map((event) => [String(event.payload.signerId), event.eventId]))
    eventOf.set(current.signerId, current.id)

    const proof = JSON.stringify(
      {
        contractId: contract.id,
        title: contract.title,
        counterparty: contract.counterparty,
        version: version.number,
        textChecksum: version.checksum,
        documentId: request.documentId,
        provider: request.provider,
        requestId: request.externalId,
        completedAt: now.toISO(),
        signers: request.signers.map((signer) => ({
          name: signer.name,
          email: signer.email,
          signedAt: signer.signedAt?.toISO() ?? null,
          eventId: eventOf.get(signer.externalId) ?? null,
        })),
      },
      null,
      2
    )
    const key = `organizations/${contract.organizationId}/contracts/${contract.id}/signature-proof-${request.externalId}.json`
    const disk = drive.use()
    await disk.put(key, proof, { contentType: 'application/json' })
    try {
      await SignatureProof.create(
        {
          signatureRequestId: request.id,
          storageKey: key,
          checksum: createHash('sha256').update(proof).digest('hex'),
        },
        { client: trx }
      )
      request.status = 'completed'
      request.completedAt = now
      await request.save()
      contract.status = 'signed'
      await contract.save()
      await recordAudit(trx, {
        organizationId: contract.organizationId,
        actorId: null,
        action: 'contract.signed',
        subject: { type: 'contract', id: contract.id },
        metadata: { version: version.number, signers: request.signers.length },
      })
    } catch (error) {
      await disk.delete(key).catch(() => {})
      throw error
    }
  }
}
