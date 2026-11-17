import ContractVersion from '#models/contract_version'
import Contract from '#models/contract'
import SignatureRequest from '#models/signature_request'
import SignatureSigner from '#models/signature_signer'
import { SandboxSignatureProvider } from '#services/signature_provider'
import SignatureWebhookService from '#services/signature_webhook_service'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Page de signature du bac à sable : elle tient la place de celle d'un prestataire. L'adresse
 * (`/sandbox/sign/:signerId`) contient l'identifiant aléatoire du signataire, qui sert de
 * capacité d'accès. Signer ou refuser n'écrit rien directement : la page émet un événement
 * signé et le fait traiter par le même service que le webhook public.
 */
@inject()
export default class SandboxController {
  protected provider = new SandboxSignatureProvider()

  constructor(protected webhooks: SignatureWebhookService) {}

  async show({ inertia, params }: HttpContext) {
    const signer = await SignatureSigner.query().where('external_id', params.signerId).firstOrFail()
    const request = await SignatureRequest.findOrFail(signer.signatureRequestId)
    const contract = await Contract.findOrFail(request.contractId)
    const version = await ContractVersion.findOrFail(request.contractVersionId)

    return inertia.render('sandbox/sign', {
      signerId: signer.externalId,
      signer: { name: signer.name, status: signer.status },
      requestStatus: request.status,
      contract: { title: contract.title, counterparty: contract.counterparty },
      version: { number: version.number, body: version.body, checksum: version.checksum },
    })
  }

  async decide({ request, response, params, session }: HttpContext) {
    const signer = await SignatureSigner.query().where('external_id', params.signerId).firstOrFail()
    const signature = await SignatureRequest.findOrFail(signer.signatureRequestId)
    const type = request.input('decision') === 'decline' ? 'signer.declined' : 'signer.signed'

    const { rawBody, header } = this.provider.buildEvent({
      type,
      requestId: signature.externalId,
      signerId: signer.externalId,
    })
    const result = await this.webhooks.handle(rawBody, header)

    session.flash(
      result === 'applied' ? 'success' : 'error',
      result === 'applied'
        ? type === 'signer.signed'
          ? 'Signature enregistrée.'
          : 'Signature refusée.'
        : 'Cette demande de signature n’est plus ouverte.'
    )
    return response.redirect().back()
  }
}
