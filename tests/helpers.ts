import type { Assert } from '@japa/assert'
import RuleViolation, { type RuleViolationReason } from '#exceptions/rule_violation'
import Approval from '#models/approval'
import Membership from '#models/membership'
import User from '#models/user'
import SignatureRequest from '#models/signature_request'
import ApprovalService from '#services/approval_service'
import ContractService from '#services/contract_service'
import OrganizationService from '#services/organization_service'
import { SandboxSignatureProvider } from '#services/signature_provider'
import SignatureService from '#services/signature_service'
import SignatureWebhookService from '#services/signature_webhook_service'
import type { ApproverRole, Role } from '#services/vocabulary'
import WorkflowService from '#services/workflow_service'
import db from '@adonisjs/lucid/services/db'

export const PASSWORD = 'mot-de-passe-de-test'

export const BODY = [
  'Article 1 - Objet',
  'Le prestataire réalise la maintenance applicative du portail client.',
  'Article 2 - Durée',
  'Le contrat est conclu pour douze mois à compter de sa signature.',
  'Article 3 - Prix',
  'Le prix forfaitaire est de 48 000 euros hors taxes.',
].join('\n')

let sequence = 0

export async function createUser(name: string) {
  sequence++
  return User.create({
    fullName: name,
    email: `${name.toLowerCase().replace(/\W+/g, '.')}.${sequence}@exemple.test`,
    password: PASSWORD,
  })
}

/** Une organisation avec un membre par rôle, et un circuit « Juridique puis Direction ». */
export async function createOrganization(name = 'Atelier Nova') {
  const owner = await createUser(`Olivia ${name}`)
  const organization = await db.transaction((trx) =>
    new OrganizationService().createWithOwner(trx, owner, name)
  )

  const people: Record<Exclude<Role, 'owner'>, User> = {
    admin: await createUser(`Adrien ${name}`),
    legal: await createUser(`Léa ${name}`),
    manager: await createUser(`Marc ${name}`),
    member: await createUser(`Rémi ${name}`),
    viewer: await createUser(`Vera ${name}`),
  }
  for (const [role, user] of Object.entries(people)) {
    await Membership.create({
      organizationId: organization.id,
      userId: user.id,
      role: role as Role,
    })
  }

  const workflow = await createWorkflow(organization.id, owner.id, [
    ['Revue juridique', 'legal'],
    ['Accord de la direction', 'manager'],
  ])
  return { organization, owner, ...people, workflow }
}

export function createWorkflow(
  organizationId: number,
  actorId: number,
  steps: [name: string, approverRole: ApproverRole][],
  name = 'Juridique puis direction'
) {
  return new WorkflowService().create(organizationId, actorId, {
    name,
    steps: steps.map(([stepName, approverRole]) => ({ name: stepName, approverRole })),
  })
}

export function createContract(organizationId: number, authorId: number, body = BODY) {
  return new ContractService().create(organizationId, authorId, {
    title: 'Maintenance du portail client',
    counterparty: 'Nordwind SAS',
    type: 'service',
    body,
  })
}

/** L'action doit être refusée par la règle attendue, pas par une autre erreur. */
export async function assertViolation(
  assert: Assert,
  action: () => Promise<unknown>,
  reason: RuleViolationReason
) {
  try {
    await action()
  } catch (error) {
    assert.instanceOf(error, RuleViolation)
    assert.equal((error as RuleViolation).reason, reason)
    return
  }
  assert.fail(`aucun refus, « ${reason} » attendu`)
}

/** Un contrat soumis au circuit Juridique puis Direction, puis approuvé par les deux étapes. */
export async function createApprovedContract(
  org: Awaited<ReturnType<typeof createOrganization>>,
  body = BODY
) {
  const contract = await createContract(org.organization.id, org.member.id, body)
  await new ContractService().submit(
    org.organization.id,
    contract.id,
    org.member.id,
    org.workflow.id
  )
  const steps = await Approval.query().where('contract_id', contract.id).orderBy('position')
  const approvals = new ApprovalService()
  const decide = (step: Approval, actor: User, role: Role) =>
    approvals.decide({
      organizationId: org.organization.id,
      contractId: contract.id,
      approvalId: step.id,
      actor: { id: actor.id, role },
      decision: 'approve',
      comment: step === steps[0] ? 'Clauses conformes' : null,
    })
  await decide(steps[0], org.legal, 'legal')
  await decide(steps[1], org.manager, 'manager')
  return contract
}

/** Un contrat approuvé, envoyé à la signature d'une personne qui signe : il est figé. */
export async function createSignedContract(org: Awaited<ReturnType<typeof createOrganization>>) {
  const contract = await createApprovedContract(org)
  const provider = new SandboxSignatureProvider()
  await new SignatureService(provider).request(org.organization.id, contract.id, org.manager.id, [
    { name: 'Alice Martin', email: 'alice@nordwind.test' },
  ])
  const request = await SignatureRequest.query()
    .where('contract_id', contract.id)
    .preload('signers')
    .firstOrFail()
  const { rawBody, header } = provider.buildEvent({
    type: 'signer.signed',
    requestId: request.externalId,
    signerId: request.signers[0].externalId,
  })
  await new SignatureWebhookService().handle(rawBody, header)
  return contract
}
