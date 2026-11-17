import ContractTemplate from '#models/contract_template'
import TemplateService from '#services/template_service'
import { AUTHOR_ROLES } from '#services/vocabulary'
import ContractTemplateTransformer from '#transformers/contract_template_transformer'
import { createTemplateValidator } from '#validators/contract'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class TemplatesController {
  constructor(protected templates: TemplateService) {}

  async index({ inertia, organization, membership }: HttpContext) {
    const templates = await ContractTemplate.query()
      .where('organization_id', organization.id)
      .orderBy('name')
    return inertia.render('templates/index', {
      templates: ContractTemplateTransformer.transform(templates),
      canWrite: AUTHOR_ROLES.includes(membership.role),
    })
  }

  async create({ inertia, bouncer, membership }: HttpContext) {
    await bouncer.with('ContractPolicy').authorize('write', membership)
    return inertia.render('templates/create', {})
  }

  async store({
    request,
    response,
    session,
    bouncer,
    auth,
    organization,
    membership,
  }: HttpContext) {
    await bouncer.with('ContractPolicy').authorize('write', membership)
    const input = await request.validateUsing(createTemplateValidator)
    await this.templates.create(organization.id, auth.getUserOrFail().id, input)

    session.flash('success', 'Modèle enregistré.')
    return response.redirect().toRoute('templates.index')
  }
}
