import Contract from '#models/contract'
import SignatureProof from '#models/signature_proof'
import SignatureRequest from '#models/signature_request'
import SignatureService from '#services/signature_service'
import { signatureProvider } from '#services/signature_provider'
import { requestSignatureValidator } from '#validators/contract'
import drive from '@adonisjs/drive/services/main'
import type { HttpContext } from '@adonisjs/core/http'

export default class SignaturesController {
  protected signatures = new SignatureService(signatureProvider())

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
    await bouncer.with('ContractPolicy').authorize('requestSignature', membership)
    const { signers } = await request.validateUsing(requestSignatureValidator)
    await this.signatures.request(
      organization.id,
      Number(params.id),
      auth.getUserOrFail().id,
      signers
    )

    session.flash('success', 'Contrat envoyé à la signature.')
    return response.redirect().toRoute('contracts.show', { id: params.id })
  }

  async cancel({
    response,
    session,
    params,
    bouncer,
    auth,
    organization,
    membership,
  }: HttpContext) {
    await bouncer.with('ContractPolicy').authorize('requestSignature', membership)
    await this.signatures.cancel(organization.id, Number(params.id), auth.getUserOrFail().id)

    session.flash('success', 'Demande de signature annulée.')
    return response.redirect().toRoute('contracts.show', { id: params.id })
  }

  /** La preuve d'une signature complète, par URL pré-signée de cinq minutes. */
  async proof({ response, params, organization }: HttpContext) {
    const contract = await Contract.query()
      .where('id', params.id)
      .where('organization_id', organization.id)
      .firstOrFail()
    const request = await SignatureRequest.query()
      .where('contract_id', contract.id)
      .where('status', 'completed')
      .firstOrFail()
    const proof = await SignatureProof.query()
      .where('signature_request_id', request.id)
      .firstOrFail()

    const url = await drive.use().getSignedUrl(proof.storageKey, {
      expiresIn: '5 mins',
      contentType: 'application/json',
      contentDisposition: `attachment; filename="preuve-signature-contrat-${contract.id}.json"`,
    })
    return response.redirect(url)
  }
}
