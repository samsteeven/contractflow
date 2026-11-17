import CommentService from '#services/comment_service'
import { commentValidator } from '#validators/contract'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class CommentsController {
  constructor(protected comments: CommentService) {}

  async store({
    request,
    response,
    params,
    session,
    bouncer,
    auth,
    organization,
    membership,
  }: HttpContext) {
    await bouncer.with('ContractPolicy').authorize('write', membership)
    const { body } = await request.validateUsing(commentValidator)
    await this.comments.add(organization.id, Number(params.id), auth.getUserOrFail().id, body)

    session.flash('success', 'Commentaire ajouté.')
    return response.redirect().toRoute('contracts.show', { id: params.id })
  }
}
