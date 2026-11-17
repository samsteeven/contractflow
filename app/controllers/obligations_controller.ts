import ObligationService from '#services/obligation_service'
import { addObligationValidator, setTermValidator } from '#validators/contract'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

/** Suivi d'un contrat signé : durée, obligations, reconduction. Aucune règle ici : tout est dans le service. */
@inject()
export default class ObligationsController {
  constructor(protected obligations: ObligationService) {}

  async setTerm({
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
    const input = await request.validateUsing(setTermValidator)
    await this.obligations.setTerm(organization.id, Number(params.id), auth.getUserOrFail().id, {
      ...input,
      autoRenew: input.autoRenew ?? false,
      renewalMonths: input.renewalMonths ?? null,
    })

    session.flash('success', 'Durée du contrat enregistrée.')
    return response.redirect().toRoute('contracts.show', { id: params.id })
  }

  async renew({ response, session, params, bouncer, auth, organization, membership }: HttpContext) {
    await bouncer.with('ContractPolicy').authorize('engage', membership)
    const term = await this.obligations.renew(
      organization.id,
      Number(params.id),
      auth.getUserOrFail().id
    )

    session.flash('success', `Contrat reconduit jusqu’au ${term.endsOn.toISODate()}.`)
    return response.redirect().toRoute('contracts.show', { id: params.id })
  }

  async terminate({
    response,
    session,
    params,
    bouncer,
    auth,
    organization,
    membership,
  }: HttpContext) {
    await bouncer.with('ContractPolicy').authorize('engage', membership)
    await this.obligations.terminate(organization.id, Number(params.id), auth.getUserOrFail().id)

    session.flash('success', 'Contrat terminé.')
    return response.redirect().toRoute('contracts.show', { id: params.id })
  }

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
    const input = await request.validateUsing(addObligationValidator)
    await this.obligations.addObligation(
      organization.id,
      Number(params.id),
      auth.getUserOrFail().id,
      { ...input, notes: input.notes ?? null }
    )

    session.flash('success', 'Obligation ajoutée.')
    return response.redirect().toRoute('contracts.show', { id: params.id })
  }

  async complete({ response, session, params, auth, organization, membership }: HttpContext) {
    await this.obligations.complete(
      organization.id,
      Number(params.id),
      Number(params.obligationId),
      { id: auth.getUserOrFail().id, role: membership.role }
    )

    session.flash('success', 'Obligation close.')
    return response.redirect().toRoute('contracts.show', { id: params.id })
  }

  async cancel({ response, session, params, auth, organization, membership }: HttpContext) {
    await this.obligations.cancel(organization.id, Number(params.id), Number(params.obligationId), {
      id: auth.getUserOrFail().id,
      role: membership.role,
    })

    session.flash('success', 'Obligation annulée.')
    return response.redirect().toRoute('contracts.show', { id: params.id })
  }
}
