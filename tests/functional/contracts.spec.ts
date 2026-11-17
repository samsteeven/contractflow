import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Approval from '#models/approval'
import AuditLog from '#models/audit_log'
import Contract from '#models/contract'
import ContractVersion from '#models/contract_version'
import WorkflowStep from '#models/workflow_step'
import ApprovalService from '#services/approval_service'
import ContractService, { checksumOf } from '#services/contract_service'
import { assertViolation, BODY, createContract, createOrganization } from '#tests/helpers'

const contracts = new ContractService()

test.group('Contrats et versions', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('un contrat naît en brouillon avec sa version 1 et une trace', async ({ assert }) => {
    const { organization, member } = await createOrganization()

    const contract = await createContract(organization.id, member.id)

    assert.equal(contract.status, 'draft')
    const versions = await ContractVersion.query().where('contract_id', contract.id)
    assert.lengthOf(versions, 1)
    assert.equal(versions[0].number, 1)
    assert.equal(versions[0].authorId, member.id)
    assert.equal(versions[0].checksum, checksumOf(BODY))
    const trace = await AuditLog.query().where('subject_type', 'contract').firstOrFail()
    assert.equal(trace.action, 'contract.created')
    assert.equal(trace.actorId, member.id)
    assert.equal(trace.organizationId, organization.id)
  })

  test('réviser ajoute une version et laisse la précédente intacte', async ({ assert }) => {
    const { organization, member, legal } = await createOrganization()
    const contract = await createContract(organization.id, member.id)

    const version = await contracts.revise(organization.id, contract.id, legal.id, {
      body: BODY.replace('douze mois', 'vingt-quatre mois'),
      changeNote: 'Durée portée à deux ans',
    })

    assert.equal(version.number, 2)
    const versions = await ContractVersion.query()
      .where('contract_id', contract.id)
      .orderBy('number')
    assert.deepEqual(
      versions.map((v) => [v.number, v.authorId, v.body.includes('douze mois')]),
      [
        [1, member.id, true],
        [2, legal.id, false],
      ]
    )
    assert.equal(versions[1].changeNote, 'Durée portée à deux ans')
  })

  test('un texte identique ne crée pas de version', async ({ assert }) => {
    const { organization, member } = await createOrganization()
    const contract = await createContract(organization.id, member.id)

    await assertViolation(
      assert,
      () =>
        contracts.revise(organization.id, contract.id, member.id, {
          body: BODY.replace(/\n/g, '\r\n') + '\n\n',
          changeNote: null,
        }),
      'no_change'
    )
    assert.lengthOf(await ContractVersion.query().where('contract_id', contract.id), 1)
  })

  test('la base refuse de modifier ou de supprimer une version et une trace', async ({
    assert,
  }) => {
    const { organization, member } = await createOrganization()
    const contract = await createContract(organization.id, member.id)

    for (const statement of [
      `UPDATE contract_versions SET body = 'falsifié' WHERE contract_id = ${contract.id}`,
      `DELETE FROM contract_versions WHERE contract_id = ${contract.id}`,
      `UPDATE audit_logs SET action = 'falsifié'`,
      `DELETE FROM audit_logs`,
    ]) {
      await assert.rejects(() => db.rawQuery(statement), /immuables/)
    }
    assert.equal((await ContractVersion.findByOrFail('contract_id', contract.id)).body, BODY)
  })

  test('un contrat en validation ne peut pas être modifié', async ({ assert }) => {
    const { organization, member, workflow } = await createOrganization()
    const contract = await createContract(organization.id, member.id)
    await contracts.submit(organization.id, contract.id, member.id, workflow.id)

    await assertViolation(
      assert,
      () =>
        contracts.revise(organization.id, contract.id, member.id, {
          body: BODY + '\nArticle 4 - Ajout',
          changeNote: null,
        }),
      'contract_in_review'
    )
    assert.lengthOf(await ContractVersion.query().where('contract_id', contract.id), 1)
  })

  test('soumettre copie les étapes du circuit, attachées à la version soumise', async ({
    assert,
  }) => {
    const { organization, member, workflow } = await createOrganization()
    const contract = await createContract(organization.id, member.id)

    const submitted = await contracts.submit(organization.id, contract.id, member.id, workflow.id)
    // Le circuit change après la soumission : la validation en cours ne bouge pas.
    await WorkflowStep.create({
      workflowId: workflow.id,
      position: 3,
      name: 'Visa du propriétaire',
      approverRole: 'owner',
    })

    assert.equal(submitted.status, 'in_review')
    assert.equal(submitted.reviewRound, 1)
    const version = await ContractVersion.findByOrFail('contract_id', contract.id)
    const approvals = await Approval.query().where('contract_id', contract.id).orderBy('position')
    assert.deepEqual(
      approvals.map((a) => [a.round, a.position, a.stepName, a.approverRole, a.status]),
      [
        [1, 1, 'Revue juridique', 'legal', 'pending'],
        [1, 2, 'Accord de la direction', 'manager', 'pending'],
      ]
    )
    assert.isTrue(approvals.every((a) => a.contractVersionId === version.id))
  })

  test("seul un brouillon se soumet, et seulement à un circuit de l'organisation", async ({
    assert,
  }) => {
    const { organization, member, workflow } = await createOrganization()
    const other = await createOrganization('Autre Maison')
    const contract = await createContract(organization.id, member.id)

    await assert.rejects(
      () => contracts.submit(organization.id, contract.id, member.id, other.workflow.id),
      /Row not found/
    )
    await contracts.submit(organization.id, contract.id, member.id, workflow.id)
    await assertViolation(
      assert,
      () => contracts.submit(organization.id, contract.id, member.id, workflow.id),
      'contract_not_draft'
    )
    assert.lengthOf(await Approval.query().where('contract_id', contract.id), 2)
  })

  test('réviser un contrat approuvé le remet en brouillon : il faut le revalider', async ({
    assert,
  }) => {
    const { organization, member, legal, manager, workflow } = await createOrganization()
    const approvals = new ApprovalService()
    const contract = await createContract(organization.id, member.id)
    await contracts.submit(organization.id, contract.id, member.id, workflow.id)
    for (const [position, user, role] of [
      [1, legal, 'legal'],
      [2, manager, 'manager'],
    ] as const) {
      const step = await Approval.query()
        .where('contract_id', contract.id)
        .where('position', position)
        .firstOrFail()
      await approvals.decide({
        organizationId: organization.id,
        contractId: contract.id,
        approvalId: step.id,
        actor: { id: user.id, role },
        decision: 'approve',
        comment: null,
      })
    }
    assert.equal((await Contract.findOrFail(contract.id)).status, 'approved')

    await contracts.revise(organization.id, contract.id, member.id, {
      body: BODY.replace('48 000', '52 000'),
      changeNote: 'Nouveau prix',
    })
    const reopened = await Contract.findOrFail(contract.id)
    assert.equal(reopened.status, 'draft')

    await contracts.submit(organization.id, contract.id, member.id, workflow.id)
    const v2 = await ContractVersion.query()
      .where('contract_id', contract.id)
      .where('number', 2)
      .firstOrFail()
    const rounds = await Approval.query()
      .where('contract_id', contract.id)
      .orderBy('round')
      .orderBy('position')
    assert.deepEqual(
      rounds.map((a) => [a.round, a.status, a.contractVersionId === v2.id]),
      [
        [1, 'approved', false],
        [1, 'approved', false],
        [2, 'pending', true],
        [2, 'pending', true],
      ]
    )
  })
})
