import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import RuleViolation from '#exceptions/rule_violation'
import Approval from '#models/approval'
import AuditLog from '#models/audit_log'
import Contract from '#models/contract'
import Membership from '#models/membership'
import type User from '#models/user'
import ApprovalService, { type Decision } from '#services/approval_service'
import ContractService from '#services/contract_service'
import type { Role } from '#services/vocabulary'
import {
  assertViolation,
  BODY,
  createContract,
  createOrganization,
  createUser,
} from '#tests/helpers'

const approvals = new ApprovalService()
const contracts = new ContractService()

/** Un contrat rédigé par le membre « rédacteur », soumis au circuit Juridique puis Direction. */
async function submittedContract() {
  const org = await createOrganization()
  const contract = await createContract(org.organization.id, org.member.id)
  await contracts.submit(org.organization.id, contract.id, org.member.id, org.workflow.id)
  const steps = await Approval.query().where('contract_id', contract.id).orderBy('position')
  const decide = (
    step: Approval,
    user: User,
    role: Role,
    decision: Decision = 'approve',
    comment: string | null = null
  ) =>
    approvals.decide({
      organizationId: org.organization.id,
      contractId: contract.id,
      approvalId: step.id,
      actor: { id: user.id, role },
      decision,
      comment,
    })
  const state = async () => ({
    contract: (await Contract.findOrFail(contract.id)).status,
    steps: (
      await Approval.query().where('contract_id', contract.id).orderBy('round').orderBy('position')
    ).map((a) => a.status),
  })
  return { ...org, contract, legalStep: steps[0], managerStep: steps[1], decide, state }
}

const actions = async (contractId: number) =>
  (
    await AuditLog.query()
      .where('subject_type', 'contract')
      .where('subject_id', contractId)
      .orderBy('id')
  ).map((log) => log.action)

test.group('Circuit de validation', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('chaque étape validée fait avancer le contrat, la dernière l’approuve', async ({
    assert,
  }) => {
    const { contract, legal, manager, legalStep, managerStep, decide, state } =
      await submittedContract()

    await decide(legalStep, legal, 'legal', 'approve', 'Clauses conformes')
    assert.deepEqual(await state(), { contract: 'in_review', steps: ['approved', 'pending'] })

    await decide(managerStep, manager, 'manager')
    assert.deepEqual(await state(), { contract: 'approved', steps: ['approved', 'approved'] })

    const decided = await Approval.findOrFail(legalStep.id)
    assert.equal(decided.decidedBy, legal.id)
    assert.equal(decided.comment, 'Clauses conformes')
    assert.isNotNull(decided.decidedAt)
    assert.deepEqual(await actions(contract.id), [
      'contract.created',
      'contract.submitted',
      'approval.approved',
      'approval.approved',
      'contract.approved',
    ])
  })

  test("un approbateur n'agit pas avant que son étape soit active", async ({ assert }) => {
    const { manager, managerStep, decide, state } = await submittedContract()

    await assertViolation(assert, () => decide(managerStep, manager, 'manager'), 'step_not_active')

    assert.deepEqual(await state(), { contract: 'in_review', steps: ['pending', 'pending'] })
  })

  test("une étape n'accepte que le rôle qu'elle attend", async ({ assert }) => {
    const { owner, manager, viewer, legalStep, decide, state } = await submittedContract()

    for (const [user, role] of [
      [manager, 'manager'],
      [owner, 'owner'],
      [viewer, 'viewer'],
    ] as const) {
      await assertViolation(assert, () => decide(legalStep, user, role), 'wrong_role')
    }
    assert.deepEqual(await state(), { contract: 'in_review', steps: ['pending', 'pending'] })
  })

  test('une décision déjà prise ne se rejoue pas', async ({ assert }) => {
    const { contract, legal, legalStep, decide, state } = await submittedContract()
    await decide(legalStep, legal, 'legal')

    await assertViolation(assert, () => decide(legalStep, legal, 'legal'), 'already_decided')
    await assertViolation(
      assert,
      () => decide(legalStep, legal, 'legal', 'reject', 'Finalement non'),
      'already_decided'
    )

    assert.deepEqual(await state(), { contract: 'in_review', steps: ['approved', 'pending'] })
    assert.lengthOf(
      (await actions(contract.id)).filter((action) => action.startsWith('approval.')),
      1
    )
  })

  test('deux décisions simultanées sur la même étape : une seule est retenue', async ({
    assert,
  }) => {
    const { organization, contract, legal, legalStep, decide, state } = await submittedContract()
    const secondLegal = await createUser('Lucie Juriste')
    await Membership.create({
      organizationId: organization.id,
      userId: secondLegal.id,
      role: 'legal',
    })
    // Quatre connexions ouvertes d'avance : sinon le pool les crée une à une, la première décision
    // se termine souvent avant que les autres commencent, et le test passerait même sans verrou.
    await Promise.all(
      Array.from({ length: 4 }, () => db.transaction((trx) => trx.rawQuery('select pg_sleep(0.2)')))
    )

    const results = await Promise.allSettled([
      decide(legalStep, legal, 'legal', 'approve'),
      decide(legalStep, secondLegal, 'legal', 'reject', 'Clause de résiliation à revoir'),
      decide(legalStep, legal, 'legal', 'approve'),
      decide(legalStep, secondLegal, 'legal', 'reject', 'Clause de résiliation à revoir'),
    ])

    const refused = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
    assert.lengthOf(
      results.filter((r) => r.status === 'fulfilled'),
      1
    )
    assert.isTrue(
      refused.every(
        (r) => r.reason instanceof RuleViolation && r.reason.reason === 'already_decided'
      )
    )
    // L'état final correspond à la seule décision retenue, jamais à un mélange des deux.
    const final = await state()
    const winner = await Approval.findOrFail(legalStep.id)
    assert.deepEqual(
      final,
      winner.status === 'approved'
        ? { contract: 'in_review', steps: ['approved', 'pending'] }
        : { contract: 'rejected', steps: ['rejected', 'skipped'] }
    )
    assert.lengthOf(
      (await actions(contract.id)).filter((action) => action.startsWith('approval.')),
      1
    )
  })

  test("on ne valide pas un texte qu'on a rédigé", async ({ assert }) => {
    const { organization, legal, workflow } = await createOrganization()
    const contract = await createContract(organization.id, legal.id)
    await contracts.submit(organization.id, contract.id, legal.id, workflow.id)
    const step = await Approval.query()
      .where('contract_id', contract.id)
      .orderBy('position')
      .firstOrFail()

    await assertViolation(
      assert,
      () =>
        approvals.decide({
          organizationId: organization.id,
          contractId: contract.id,
          approvalId: step.id,
          actor: { id: legal.id, role: 'legal' },
          decision: 'approve',
          comment: null,
        }),
      'self_approval'
    )
    assert.equal((await Approval.findOrFail(step.id)).status, 'pending')
  })

  test('un rejet doit être motivé', async ({ assert }) => {
    const { legal, legalStep, decide, state } = await submittedContract()

    await assertViolation(
      assert,
      () => decide(legalStep, legal, 'legal', 'reject', '   '),
      'comment_required'
    )

    assert.deepEqual(await state(), { contract: 'in_review', steps: ['pending', 'pending'] })
  })

  test('un rejet clôt le tour ; après révision, un nouveau tour repart de la première étape', async ({
    assert,
  }) => {
    const {
      organization,
      contract,
      member,
      legal,
      manager,
      workflow,
      legalStep,
      managerStep,
      decide,
      state,
    } = await submittedContract()

    await decide(legalStep, legal, 'legal', 'reject', 'Clause de résiliation à revoir')
    assert.deepEqual(await state(), { contract: 'rejected', steps: ['rejected', 'skipped'] })
    // L'étape suivante n'aura pas lieu dans ce tour, même pour le bon rôle.
    await assertViolation(assert, () => decide(managerStep, manager, 'manager'), 'already_decided')

    await contracts.revise(organization.id, contract.id, member.id, {
      body: BODY + '\nArticle 4 - Résiliation\nPréavis de trois mois.',
      changeNote: 'Clause de résiliation ajoutée',
    })
    await contracts.submit(organization.id, contract.id, member.id, workflow.id)
    assert.deepEqual(await state(), {
      contract: 'in_review',
      steps: ['rejected', 'skipped', 'pending', 'pending'],
    })

    // Une étape du tour précédent ne peut plus rien décider.
    await assertViolation(assert, () => decide(legalStep, legal, 'legal'), 'already_decided')
    const round2 = await Approval.query()
      .where('contract_id', contract.id)
      .where('round', 2)
      .orderBy('position')
    await decide(round2[0], legal, 'legal')
    await decide(round2[1], manager, 'manager')
    assert.equal((await state()).contract, 'approved')
  })

  test("une étape d'une autre organisation est introuvable", async ({ assert }) => {
    const { legalStep, contract } = await submittedContract()
    const other = await createOrganization('Autre Maison')

    await assert.rejects(
      () =>
        approvals.decide({
          organizationId: other.organization.id,
          contractId: contract.id,
          approvalId: legalStep.id,
          actor: { id: other.legal.id, role: 'legal' },
          decision: 'approve',
          comment: null,
        }),
      /Row not found/
    )
    assert.equal((await Approval.findOrFail(legalStep.id)).status, 'pending')
  })
})
