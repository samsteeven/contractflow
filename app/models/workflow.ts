import { WorkflowSchema } from '#database/schema'
import WorkflowStep from '#models/workflow_step'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'

export default class Workflow extends WorkflowSchema {
  @hasMany(() => WorkflowStep, { onQuery: (query) => query.orderBy('position') })
  declare steps: HasMany<typeof WorkflowStep>
}
