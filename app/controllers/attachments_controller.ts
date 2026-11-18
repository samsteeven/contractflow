import Attachment from '#models/attachment'
import Contract from '#models/contract'
import AttachmentService, { MAX_ATTACHMENT_BYTES } from '#services/attachment_service'
import RuleViolation from '#exceptions/rule_violation'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { readFile } from 'node:fs/promises'

@inject()
export default class AttachmentsController {
  constructor(protected attachments: AttachmentService) {}

  async store({
    request,
    response,
    session,
    params,
    bouncer,
    auth,
    organization,
    membership,
  }: HttpContext) {
    await bouncer.with('ContractPolicy').authorize('write', membership)
    const file = request.file('file', { size: MAX_ATTACHMENT_BYTES })
    if (!file) throw new RuleViolation('file_empty', 'Choisissez un fichier.', 422)
    if (!file.isValid) {
      const first = file.errors[0]
      throw new RuleViolation(
        first?.type === 'size' ? 'file_too_large' : 'file_type_not_allowed',
        first?.message ?? 'Fichier refusé.',
        first?.type === 'size' ? 413 : 422
      )
    }

    await this.attachments.add(organization.id, Number(params.id), auth.getUserOrFail().id, {
      name: file.clientName,
      data: await readFile(file.tmpPath!),
    })

    session.flash('success', 'Pièce jointe ajoutée après analyse antivirus.')
    return response.redirect().toRoute('contracts.show', { id: params.id })
  }

  /** Redirige vers une URL pré-signée de cinq minutes. */
  async show({ response, params, organization }: HttpContext) {
    const contract = await Contract.query()
      .where('id', params.id)
      .where('organization_id', organization.id)
      .firstOrFail()
    const attachment = await Attachment.query()
      .where('id', params.attachmentId)
      .where('contract_id', contract.id)
      .where('organization_id', organization.id)
      .firstOrFail()

    return response.redirect(await this.attachments.downloadUrl(attachment))
  }
}
