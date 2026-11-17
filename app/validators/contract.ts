import { APPROVER_ROLES, CONTRACT_TYPES, ROLES } from '#services/vocabulary'
import vine from '@vinejs/vine'

const body = () => vine.string().minLength(20).maxLength(200_000)

export const createContractValidator = vine.create({
  title: vine.string().trim().minLength(3).maxLength(200),
  counterparty: vine.string().trim().minLength(2).maxLength(200),
  type: vine.enum(CONTRACT_TYPES),
  body: body(),
})

export const reviseContractValidator = vine.create({
  body: body(),
  changeNote: vine.string().trim().maxLength(500).nullable().optional(),
})

export const submitContractValidator = vine.create({
  workflowId: vine.number().positive().withoutDecimals(),
})

export const decisionValidator = vine.create({
  decision: vine.enum(['approve', 'reject'] as const),
  comment: vine.string().trim().maxLength(2000).nullable().optional(),
})

export const createWorkflowValidator = vine.create({
  name: vine.string().trim().minLength(3).maxLength(200),
  steps: vine
    .array(
      vine.object({
        name: vine.string().trim().minLength(2).maxLength(200),
        approverRole: vine.enum(APPROVER_ROLES),
      })
    )
    .minLength(1)
    .maxLength(10),
})

export const addMemberValidator = vine.create({
  email: vine.string().email().maxLength(254),
  role: vine.enum(ROLES),
})

export const createFromTemplateValidator = vine.create({
  templateId: vine.number().positive().withoutDecimals(),
  title: vine.string().trim().minLength(3).maxLength(200),
  counterparty: vine.string().trim().minLength(2).maxLength(200),
  values: vine.record(vine.string().maxLength(2000)).optional(),
})

export const createTemplateValidator = vine.create({
  name: vine.string().trim().minLength(3).maxLength(200),
  type: vine.enum(CONTRACT_TYPES),
  body: body(),
})

export const requestSignatureValidator = vine.create({
  signers: vine
    .array(
      vine.object({
        name: vine.string().trim().minLength(2).maxLength(200),
        email: vine.string().trim().email().maxLength(254),
      })
    )
    .minLength(1)
    .maxLength(5),
})

export const commentValidator = vine.create({
  body: vine.string().trim().minLength(1).maxLength(2000),
})
