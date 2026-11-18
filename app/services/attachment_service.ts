import { createHash, randomUUID } from 'node:crypto'
import RuleViolation from '#exceptions/rule_violation'
import Attachment from '#models/attachment'
import { recordAudit } from '#services/audit'
import { lockContract } from '#services/contract_service'
import { ClamAvScanner, ScannerUnavailable, type VirusScanner } from '#services/virus_scanner'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

type Kind = { contentType: string; matches: (head: Buffer) => boolean }

const ZIP = (head: Buffer) => head.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))

/**
 * Les seuls types acceptés. On ne croit ni le type annoncé par le navigateur ni la seule
 * extension : les premiers octets doivent correspondre à l'extension, et le type enregistré
 * est celui que NOUS déduisons.
 */
export const ALLOWED_TYPES: Record<string, Kind> = {
  pdf: {
    contentType: 'application/pdf',
    matches: (h) => h.subarray(0, 5).toString('latin1') === '%PDF-',
  },
  png: {
    contentType: 'image/png',
    matches: (h) =>
      h.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  jpg: {
    contentType: 'image/jpeg',
    matches: (h) => h.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  },
  jpeg: {
    contentType: 'image/jpeg',
    matches: (h) => h.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  },
  docx: {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    matches: ZIP,
  },
  xlsx: {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    matches: ZIP,
  },
}

/** Nom affichable : sans chemin, sans caractères de contrôle ni guillemets, borné. */
export function sanitizeFilename(raw: string) {
  const base = raw.split(/[\\/]/).pop() ?? ''
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f"]/g, '').trim()
  return (cleaned || 'fichier').slice(-200)
}

export default class AttachmentService {
  constructor(private scanner: VirusScanner | null = ClamAvScanner.fromEnv()) {}

  /**
   * Ajoute une pièce jointe : type et taille vérifiés, analyse antivirus, puis seulement
   * écriture du fichier et de sa ligne. Un fichier infecté ou non analysable n'est JAMAIS
   * stocké ; l'infection est tracée au journal. Pas d'ajout sur un contrat en signature ou
   * signé (il ne change plus). L'analyse se fait avant de prendre le verrou du contrat :
   * elle peut durer, le verrou ne doit pas.
   */
  async add(
    organizationId: number,
    contractId: number,
    actorId: number,
    file: { name: string; data: Buffer }
  ) {
    const filename = sanitizeFilename(file.name)
    if (file.data.length === 0) {
      throw new RuleViolation('file_empty', 'Le fichier est vide.', 422)
    }
    if (file.data.length > MAX_ATTACHMENT_BYTES) {
      throw new RuleViolation(
        'file_too_large',
        `Le fichier dépasse ${MAX_ATTACHMENT_BYTES / 1024 / 1024} Mo.`,
        413
      )
    }
    const extension = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : ''
    const kind = ALLOWED_TYPES[extension]
    if (!kind || !kind.matches(file.data)) {
      throw new RuleViolation(
        'file_type_not_allowed',
        'Type de fichier refusé : PDF, PNG, JPEG, DOCX ou XLSX, dont le contenu correspond à l’extension.',
        422
      )
    }

    // Le contrat doit exister dans l'organisation et accepter encore des pièces : on le vérifie
    // une première fois sans verrou pour ne pas analyser pour rien, puis sous verrou à l'écriture.
    await db.transaction(async (trx) =>
      this.#assertOpen(await lockContract(trx, organizationId, contractId))
    )

    if (!this.scanner) {
      throw new RuleViolation(
        'scanner_unavailable',
        "Aucun antivirus n'est configuré : le fichier est refusé.",
        503
      )
    }
    let verdict
    try {
      verdict = await this.scanner.scan(file.data)
    } catch (error) {
      if (error instanceof ScannerUnavailable) {
        throw new RuleViolation(
          'scanner_unavailable',
          'Analyse antivirus indisponible : le fichier est refusé, réessayez plus tard.',
          503
        )
      }
      throw error
    }

    const checksum = createHash('sha256').update(file.data).digest('hex')
    if (!verdict.clean) {
      await db.transaction(async (trx) => {
        await lockContract(trx, organizationId, contractId)
        await recordAudit(trx, {
          organizationId,
          actorId,
          action: 'attachment.rejected',
          subject: { type: 'contract', id: contractId },
          metadata: { filename, signature: verdict.signature, checksum },
        })
      })
      throw new RuleViolation(
        'file_infected',
        'Le fichier contient un programme malveillant : il est refusé.',
        422
      )
    }

    return db.transaction(async (trx) => {
      this.#assertOpen(await lockContract(trx, organizationId, contractId))
      const key = `organizations/${organizationId}/contracts/${contractId}/attachments/${randomUUID()}`
      const disk = drive.use()
      await disk.put(key, file.data, { contentType: kind.contentType })
      try {
        const attachment = await Attachment.create(
          {
            organizationId,
            contractId,
            filename,
            contentType: kind.contentType,
            sizeBytes: file.data.length,
            checksum,
            storageKey: key,
            scanner: this.scanner!.name,
            uploadedBy: actorId,
          },
          { client: trx }
        )
        await recordAudit(trx, {
          organizationId,
          actorId,
          action: 'attachment.added',
          subject: { type: 'contract', id: contractId },
          metadata: { filename, sizeBytes: file.data.length, checksum },
        })
        return attachment
      } catch (error) {
        await disk.delete(key).catch(() => {})
        throw error
      }
    })
  }

  /** Adresse temporaire : le fichier n'est jamais public, et toujours téléchargé, jamais affiché. */
  async downloadUrl(attachment: Attachment) {
    return drive.use().getSignedUrl(attachment.storageKey, {
      expiresIn: '5 mins',
      contentType: attachment.contentType,
      contentDisposition: `attachment; filename="${attachment.filename.replace(/[^\x20-\x7e]/g, '_')}"`,
    })
  }

  #assertOpen(contract: { status: string }) {
    if (contract.status === 'signing') {
      throw new RuleViolation(
        'contract_in_signature',
        'Contrat en cours de signature : pas de nouvelle pièce jointe.'
      )
    }
    if (contract.status === 'signed') {
      throw new RuleViolation('contract_signed', 'Contrat signé : pas de nouvelle pièce jointe.')
    }
  }
}
