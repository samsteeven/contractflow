import Obligation from '#models/obligation'
import { daysUntil } from '#services/reminder_service'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

export default class DeadlinesController {
  /** Toutes les obligations ouvertes de l'organisation, la plus proche d'abord ; en retard en tête. */
  async index({ inertia, request, auth, organization }: HttpContext) {
    const mine = request.input('mine') === '1'
    const user = auth.getUserOrFail()
    const today = DateTime.utc()

    const obligations = await Obligation.query()
      .where('organization_id', organization.id)
      .where('status', 'open')
      .if(mine, (query) => query.where('assignee_id', user.id))
      .preload('assignee')
      .preload('contract')
      .orderBy('due_on')
      .limit(300)

    return inertia.render('deadlines/index', {
      mine,
      deadlines: obligations.map((obligation) => ({
        id: obligation.id,
        title: obligation.title,
        kind: obligation.kind,
        dueOn: obligation.dueOn.toISODate()!,
        daysLeft: daysUntil(obligation.dueOn, today),
        assignee: obligation.assignee.fullName ?? obligation.assignee.email,
        contractId: obligation.contractId,
        contractTitle: obligation.contract.title,
        counterparty: obligation.contract.counterparty,
      })),
    })
  }
}
