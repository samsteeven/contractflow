import Workflow from '#models/workflow'
import WorkflowStep from '#models/workflow_step'
import { recordAudit } from '#services/audit'
import type { ApproverRole } from '#services/vocabulary'
import db from '@adonisjs/lucid/services/db'

export default class WorkflowService {
  /** Les étapes reçoivent leur position dans l'ordre fourni : 1, 2, 3… */
  async create(
    organizationId: number,
    actorId: number,
    input: { name: string; steps: { name: string; approverRole: ApproverRole }[] }
  ) {
    return db.transaction(async (trx) => {
      const workflow = await Workflow.create({ organizationId, name: input.name }, { client: trx })
      await WorkflowStep.createMany(
        input.steps.map((step, index) => ({
          workflowId: workflow.id,
          position: index + 1,
          name: step.name,
          approverRole: step.approverRole,
        })),
        { client: trx }
      )
      await recordAudit(trx, {
        organizationId,
        actorId,
        action: 'workflow.created',
        subject: { type: 'workflow', id: workflow.id },
        metadata: { name: input.name, steps: input.steps.length },
      })
      return workflow
    })
  }
}
