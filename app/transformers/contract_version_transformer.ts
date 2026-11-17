import type ContractVersion from '#models/contract_version'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class ContractVersionTransformer extends BaseTransformer<ContractVersion> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'number', 'body', 'changeNote', 'checksum', 'createdAt']),
      author: this.resource.author.fullName ?? this.resource.author.email,
    }
  }
}
