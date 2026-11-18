import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * En-têtes que Shield ne pose pas : l'adresse d'une page ne part pas vers un autre site
 * (le lien d'invitation contient un jeton), et l'application n'a besoin d'aucune API du
 * navigateur sensible.
 */
export default class SecurityHeadersMiddleware {
  async handle({ response }: HttpContext, next: NextFn) {
    response.header('Referrer-Policy', 'same-origin')
    response.header(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
    )
    response.header('Cross-Origin-Opener-Policy', 'same-origin')
    return next()
  }
}
