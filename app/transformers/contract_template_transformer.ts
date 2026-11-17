import type ContractTemplate from '#models/contract_template'
import { extractVariables } from '#services/template_service'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class ContractTemplateTransformer extends BaseTransformer<ContractTemplate> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'name', 'type', 'body', 'createdAt']),
      variables: extractVariables(this.resource.body),
    }
  }
}
