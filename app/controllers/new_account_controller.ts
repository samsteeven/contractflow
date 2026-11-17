import User from '#models/user'
import OrganizationService from '#services/organization_service'
import { signupValidator } from '#validators/user'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

@inject()
export default class NewAccountController {
  constructor(protected organizations: OrganizationService) {}

  async create({ inertia }: HttpContext) {
    return inertia.render('auth/signup', {})
  }

  /** Le compte et son organisation naissent ensemble : un utilisateur n'existe jamais sans organisation. */
  async store({ request, response, auth }: HttpContext) {
    const { fullName, email, password, organizationName } =
      await request.validateUsing(signupValidator)

    const user = await db.transaction(async (trx) => {
      const created = await User.create({ fullName, email, password }, { client: trx })
      await this.organizations.createWithOwner(trx, created, organizationName)
      return created
    })

    await auth.use('web').login(user)
    response.redirect().toRoute('dashboard')
  }
}
