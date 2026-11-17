import Workflow from '#models/workflow'
import { ADMIN_ROLES } from '#services/vocabulary'
import WorkflowService from '#services/workflow_service'
import { createWorkflowValidator } from '#validators/contract'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class WorkflowsController {
  constructor(protected workflows: WorkflowService) {}

  async index({ inertia, organization, membership }: HttpContext) {
    const workflows = await Workflow.query()
      .where('organization_id', organization.id)
      .preload('steps')
      .orderBy('name')

    return inertia.render('workflows/index', {
      workflows: workflows.map((workflow) => ({
        id: workflow.id,
        name: workflow.name,
        steps: workflow.steps.map((step) => ({
          position: step.position,
          name: step.name,
          approverRole: step.approverRole,
        })),
      })),
      canManage: ADMIN_ROLES.includes(membership.role),
    })
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
    await bouncer.with('OrganizationPolicy').authorize('manage', membership)
    const input = await request.validateUsing(createWorkflowValidator)
    await this.workflows.create(organization.id, auth.getUserOrFail().id, input)

    session.flash('success', 'Circuit de validation créé.')
    return response.redirect().toRoute('workflows.index')
  }
}
