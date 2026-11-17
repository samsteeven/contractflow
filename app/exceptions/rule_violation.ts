import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'

export type RuleViolationReason =
  | 'contract_in_review'
  | 'contract_not_draft'
  | 'no_change'
  | 'workflow_without_steps'
  | 'already_decided'
  | 'step_not_active'
  | 'wrong_role'
  | 'self_approval'
  | 'comment_required'
  | 'unknown_user'
  | 'already_member'
  | 'role_not_grantable'
  | 'missing_variable'
  | 'invalid_template'
  | 'template_name_taken'
  | 'contract_not_approved'
  | 'contract_in_signature'
  | 'contract_signed'
  | 'signature_pending'
  | 'invalid_signers'
  | 'invalid_webhook'
  | 'no_pending_signature'

/**
 * Une règle métier refuse l'action. `reason` identifie la règle (les tests s'appuient dessus),
 * le message s'adresse à l'utilisateur. 409 par défaut : la demande est valide, l'état ne la permet pas.
 */
export default class RuleViolation extends Exception {
  static code = 'E_RULE_VIOLATION'

  constructor(
    public reason: RuleViolationReason,
    message: string,
    status: 401 | 403 | 409 | 422 = 409
  ) {
    super(message, { status, code: RuleViolation.code })
  }

  /**
   * Depuis une page (Inertia ou formulaire), l'utilisateur revient où il était avec le message.
   * Un client qui demande du JSON reçoit le statut et la raison.
   */
  async handle(error: this, ctx: HttpContext) {
    if (ctx.request.accepts(['html', 'json']) === 'json' && !ctx.request.header('x-inertia')) {
      return ctx.response
        .status(error.status)
        .send({ error: { reason: error.reason, message: error.message } })
    }
    ctx.session.flash('error', error.message)
    return ctx.response.redirect().back()
  }
}
