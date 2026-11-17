import Contract from '#models/contract'
import ContractDocument from '#models/contract_document'
import DocumentService from '#services/document_service'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class DocumentsController {
  constructor(protected documents: DocumentService) {}

  /** Produit (ou retrouve) le PDF de la version validée. */
  async store({ response, params, session, bouncer, auth, organization, membership }: HttpContext) {
    await bouncer.with('ContractPolicy').authorize('write', membership)
    await this.documents.generate(organization.id, Number(params.id), auth.getUserOrFail().id)

    session.flash('success', 'PDF archivé.')
    return response.redirect().toRoute('contracts.show', { id: params.id })
  }

  /** Redirige vers une URL pré-signée de cinq minutes ; le PDF n'est jamais public. */
  async show({ response, params, organization }: HttpContext) {
    const contract = await Contract.query()
      .where('id', params.id)
      .where('organization_id', organization.id)
      .firstOrFail()
    const document = await ContractDocument.query()
      .where('contract_id', contract.id)
      .orderBy('id', 'desc')
      .preload('version')
      .firstOrFail()

    const slug = contract.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const url = await this.documents.downloadUrl(
      document,
      `${slug || 'contrat'}-v${document.version.number}.pdf`
    )
    return response.redirect(url)
  }
}
