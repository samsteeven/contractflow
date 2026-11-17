import RuleViolation from '#exceptions/rule_violation'
import SignatureRequest from '#models/signature_request'
import SignatureSigner from '#models/signature_signer'
import { recordAudit } from '#services/audit'
import { latestVersion, lockContract } from '#services/contract_service'
import DocumentService from '#services/document_service'
import { type SignatureProvider, type SignerInput } from '#services/signature_provider'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_SIGNERS = 5

export function cleanSigners(signers: SignerInput[]) {
  const cleaned = signers.map((signer) => ({
    name: signer.name.trim(),
    email: signer.email.trim().toLowerCase(),
  }))
  const emails = new Set(cleaned.map((signer) => signer.email))
  if (
    cleaned.length === 0 ||
    cleaned.length > MAX_SIGNERS ||
    emails.size !== cleaned.length ||
    cleaned.some((signer) => !signer.name || !EMAIL.test(signer.email))
  ) {
    throw new RuleViolation(
      'invalid_signers',
      `Indiquez de un à ${MAX_SIGNERS} signataires, chacun avec un nom et une adresse e-mail distincte.`,
      422
    )
  }
  return cleaned
}

export default class SignatureService {
  constructor(
    protected provider: SignatureProvider,
    protected documents = new DocumentService()
  ) {}

  /**
   * Envoie le PDF de la version approuvée à la signature. Le contrat passe en `signing` : plus
   * aucune modification possible tant que la demande est ouverte. Tout se joue sous le verrou
   * du contrat, y compris l'appel au prestataire : s'il échoue, rien n'est enregistré.
   */
  async request(
    organizationId: number,
    contractId: number,
    actorId: number,
    signers: SignerInput[]
  ) {
    const people = cleanSigners(signers)

    return db.transaction(async (trx) => {
      const contract = await lockContract(trx, organizationId, contractId)
      if (contract.status !== 'approved') {
        throw new RuleViolation(
          'contract_not_approved',
          'Seul un contrat approuvé peut être envoyé à la signature.'
        )
      }
      const document = await this.documents.generateLocked(trx, contract, actorId)
      const version = await latestVersion(trx, contract.id)

      const created = await this.provider.createRequest({
        title: contract.title,
        documentChecksum: document.checksum,
        signers: people,
      })
      const request = await SignatureRequest.create(
        {
          contractId: contract.id,
          contractVersionId: version.id,
          documentId: document.id,
          provider: this.provider.name,
          externalId: created.externalId,
          status: 'pending',
          requestedBy: actorId,
        },
        { client: trx }
      )
      await SignatureSigner.createMany(
        people.map((person) => ({
          signatureRequestId: request.id,
          name: person.name,
          email: person.email,
          externalId: created.signers.find((signer) => signer.email === person.email)!.externalId,
          status: 'pending' as const,
        })),
        { client: trx }
      )

      contract.status = 'signing'
      await contract.save()
      await recordAudit(trx, {
        organizationId,
        actorId,
        action: 'signature.requested',
        subject: { type: 'contract', id: contract.id },
        metadata: { version: version.number, signers: people.length },
      })
      return request
    })
  }

  /** Retire la demande en cours : le contrat redevient approuvé, donc modifiable à nouveau. */
  async cancel(organizationId: number, contractId: number, actorId: number) {
    return db.transaction(async (trx) => {
      const contract = await lockContract(trx, organizationId, contractId)
      const request = await SignatureRequest.query({ client: trx })
        .where('contract_id', contract.id)
        .where('status', 'pending')
        .first()
      if (!request) {
        throw new RuleViolation(
          'no_pending_signature',
          'Aucune signature en cours pour ce contrat.'
        )
      }
      await this.provider.cancelRequest(request.externalId)
      request.status = 'cancelled'
      request.completedAt = DateTime.utc()
      await request.save()
      contract.status = 'approved'
      await contract.save()
      await recordAudit(trx, {
        organizationId,
        actorId,
        action: 'signature.cancelled',
        subject: { type: 'contract', id: contract.id },
      })
      return request
    })
  }
}
