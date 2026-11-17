import ApprovalService from '#services/approval_service'
import { decisionValidator } from '#validators/contract'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class ApprovalsController {
  constructor(protected approvals: ApprovalService) {}

  /** Toutes les règles (étape active, rôle, rejeu, auteur) sont vérifiées dans le service, sous verrou. */
  async decide({
    request,
    response,
    session,
    params,
    auth,
    organization,
    membership,
  }: HttpContext) {
    const { decision, comment } = await request.validateUsing(decisionValidator)
    const { contract } = await this.approvals.decide({
      organizationId: organization.id,
      contractId: Number(params.id),
      approvalId: Number(params.approvalId),
      actor: { id: auth.getUserOrFail().id, role: membership.role },
      decision,
      comment: comment ?? null,
    })

    const messages = {
      approved: 'Étape validée : le contrat est approuvé.',
      rejected: 'Contrat rejeté : il repart chez son rédacteur.',
      in_review: "Étape validée : le contrat passe à l'étape suivante.",
      draft: 'Décision enregistrée.',
    }
    session.flash('success', messages[contract.status])
    return response.redirect().toRoute('contracts.show', { id: params.id })
  }
}
