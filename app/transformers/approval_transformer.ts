import type Approval from '#models/approval'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class ApprovalTransformer extends BaseTransformer<Approval> {
  toObject() {
    const decider = this.resource.decider
    return {
      ...this.pick(this.resource, [
        'id',
        'round',
        'position',
        'stepName',
        'approverRole',
        'status',
        'comment',
        'decidedAt',
      ]),
      decider: decider ? (decider.fullName ?? decider.email) : null,
    }
  }
}
