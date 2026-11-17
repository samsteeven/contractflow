import RuleViolation from '#exceptions/rule_violation'
import SignatureWebhookService from '#services/signature_webhook_service'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Réception des événements du prestataire de signature. Route publique, sans session ni CSRF :
 * l'authenticité vient uniquement de la signature HMAC du corps brut. Les réponses sont
 * toujours en JSON, un prestataire n'a pas de page où rediriger.
 */
@inject()
export default class WebhooksController {
  constructor(protected webhooks: SignatureWebhookService) {}

  async signature({ request, response }: HttpContext) {
    try {
      const result = await this.webhooks.handle(
        request.raw() ?? '',
        request.header('x-contractflow-signature')
      )
      return response.status(200).send({ result })
    } catch (error) {
      if (error instanceof RuleViolation) {
        return response.status(error.status).send({ error: { reason: error.reason } })
      }
      if ((error as { code?: string }).code === 'E_ROW_NOT_FOUND') {
        return response.status(404).send({ error: { reason: 'unknown_request' } })
      }
      throw error
    }
  }
}
