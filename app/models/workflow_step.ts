import { WorkflowStepSchema } from '#database/schema'
import type { ApproverRole } from '#services/vocabulary'
import { column } from '@adonisjs/lucid/orm'

export default class WorkflowStep extends WorkflowStepSchema {
  @column()
  declare approverRole: ApproverRole
}
