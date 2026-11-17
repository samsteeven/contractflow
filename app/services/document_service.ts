import { createHash } from 'node:crypto'
import PDFDocument from 'pdfkit'
import RuleViolation from '#exceptions/rule_violation'
import Approval from '#models/approval'
import ContractDocument from '#models/contract_document'
import { recordAudit } from '#services/audit'
import { latestVersion, lockContract } from '#services/contract_service'
import { CONTRACT_TYPE_LABELS } from '#services/vocabulary'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

type Dossier = {
  title: string
  counterparty: string
  typeLabel: string
  versionNumber: number
  checksum: string
  body: string
  generatedAt: DateTime
  steps: {
    name: string
    role: string
    decider: string | null
    decidedAt: DateTime | null
    comment: string | null
  }[]
}

/** Mise en page seule : aucune règle ici, `buildPdf` ne lit ni la base ni le disque. */
export function buildPdf(dossier: Dossier): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 56,
      info: { Title: dossier.title, Producer: 'ContractFlow' },
    })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.font('Helvetica-Bold').fontSize(18).text(dossier.title)
    doc.moveDown(0.3)
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#555555')
      .text(`${dossier.typeLabel} · ${dossier.counterparty} · version ${dossier.versionNumber}`)
    doc.moveDown(1)
    doc.fillColor('#000000').fontSize(11).text(dossier.body, { lineGap: 2 })

    doc.addPage()
    doc.font('Helvetica-Bold').fontSize(14).text('Dossier de validation')
    doc.moveDown(0.6)
    doc.font('Helvetica').fontSize(10)
    for (const step of dossier.steps) {
      const who = step.decider ?? 'inconnu'
      const when = step.decidedAt ? step.decidedAt.setLocale('fr').toFormat('dd/MM/yyyy HH:mm') : ''
      doc.font('Helvetica-Bold').text(`${step.name} (${step.role})`, { continued: false })
      doc.font('Helvetica').text(`Validé par ${who}, le ${when} UTC`)
      if (step.comment) doc.text(`Commentaire : ${step.comment}`)
      doc.moveDown(0.5)
    }
    doc.moveDown(1)
    doc
      .fontSize(9)
      .fillColor('#555555')
      .text(`Empreinte SHA-256 du texte validé : ${dossier.checksum}`)
      .text(`Document généré le ${dossier.generatedAt.toFormat('dd/MM/yyyy HH:mm')} UTC`)
    doc.end()
  })
}

export default class DocumentService {
  /**
   * Archive le PDF de la version validée : texte, étapes de validation, empreinte du texte.
   * Seul un contrat approuvé a un PDF, et il n'y en a qu'un par version : appeler deux fois
   * renvoie le même document (le verrou du contrat rend l'appel simultané sûr aussi).
   * Le fichier est écrit avant la ligne en base ; si la base échoue, on retire le fichier.
   */
  async generate(organizationId: number, contractId: number, actorId: number) {
    return db.transaction(async (trx) => {
      const contract = await lockContract(trx, organizationId, contractId)
      if (contract.status !== 'approved') {
        throw new RuleViolation(
          'contract_not_approved',
          "Le PDF n'est produit que pour un contrat approuvé."
        )
      }
      const version = await latestVersion(trx, contract.id)
      const existing = await ContractDocument.query({ client: trx })
        .where('contract_version_id', version.id)
        .first()
      if (existing) return existing

      const steps = await Approval.query({ client: trx })
        .where('contract_id', contract.id)
        .where('contract_version_id', version.id)
        .where('round', contract.reviewRound)
        .preload('decider')
        .orderBy('position')
      const body = await buildPdf({
        title: contract.title,
        counterparty: contract.counterparty,
        typeLabel: CONTRACT_TYPE_LABELS[contract.type],
        versionNumber: version.number,
        checksum: version.checksum,
        body: version.body,
        generatedAt: DateTime.utc(),
        steps: steps.map((step) => ({
          name: step.stepName,
          role: step.approverRole,
          decider: step.decider ? (step.decider.fullName ?? step.decider.email) : null,
          decidedAt: step.decidedAt,
          comment: step.comment,
        })),
      })

      const key = `organizations/${organizationId}/contracts/${contract.id}/v${version.number}-${version.checksum.slice(0, 12)}.pdf`
      const disk = drive.use()
      await disk.put(key, body, { contentType: 'application/pdf' })
      try {
        const document = await ContractDocument.create(
          {
            contractId: contract.id,
            contractVersionId: version.id,
            storageKey: key,
            contentType: 'application/pdf',
            sizeBytes: body.length,
            checksum: createHash('sha256').update(body).digest('hex'),
            generatedBy: actorId,
          },
          { client: trx }
        )
        await recordAudit(trx, {
          organizationId,
          actorId,
          action: 'document.generated',
          subject: { type: 'contract', id: contract.id },
          metadata: { version: version.number, sizeBytes: body.length },
        })
        return document
      } catch (error) {
        await disk.delete(key).catch(() => {})
        throw error
      }
    })
  }

  /**
   * Adresse temporaire du PDF. Le fichier n'est jamais public : l'URL expire vite et ne sert
   * qu'à qui a passé le contrôle d'accès de l'application.
   */
  async downloadUrl(document: ContractDocument, filename: string) {
    return drive.use().getSignedUrl(document.storageKey, {
      expiresIn: '5 mins',
      contentType: 'application/pdf',
      contentDisposition: `attachment; filename="${filename}"`,
    })
  }
}
