import type { Assert } from '@japa/assert'
import RuleViolation, { type RuleViolationReason } from '#exceptions/rule_violation'
import Membership from '#models/membership'
import User from '#models/user'
import ContractService from '#services/contract_service'
import OrganizationService from '#services/organization_service'
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
