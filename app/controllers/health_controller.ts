import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Sonde de santé du répartiteur de charge et d'ECS. Publique, sans session, et elle ne révèle
 * rien : seulement « ok » ou « indisponible ». Elle vérifie la base, sans quoi l'application
 * serait déclarée saine alors qu'elle ne peut rien servir.
 */
export default class HealthController {
  async handle({ response }: HttpContext) {
    try {
      await db.rawQuery('select 1')
      return response.ok({ status: 'ok' })
    } catch {
      return response.serviceUnavailable({ status: 'indisponible' })
    }
  }
}
