import type Contract from '#models/contract'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class ContractTransformer extends BaseTransformer<Contract> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'title',
      'counterparty',
      'type',
      'status',
      'reviewRound',
      'createdAt',
      'updatedAt',
    ])
  }
}
