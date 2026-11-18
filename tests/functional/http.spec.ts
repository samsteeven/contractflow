import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Approval from '#models/approval'
import Contract from '#models/contract'
import Membership from '#models/membership'
import Organization from '#models/organization'
import User from '#models/user'
import Workflow from '#models/workflow'
import ContractService from '#services/contract_service'
import { BODY, createContract, createOrganization, PASSWORD } from '#tests/helpers'

const contractForm = {
  title: 'Maintenance du portail client',
  counterparty: 'Nordwind SAS',
  type: 'service',
  body: BODY,
}

test.group('Parcours HTTP', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('sans session, les pages métier renvoient à la connexion', async ({ client }) => {
    for (const url of ['/dashboard', '/contracts', '/contracts/1', '/workflows', '/members']) {
      const response = await client.get(url).redirects(0)
      response.assertStatus(302)
      response.assertHeader('location', '/login')
    }
  })

  test("s'inscrire crée le compte, son organisation et le rôle de propriétaire", async ({
    client,
    assert,
  }) => {
    const response = await client.post('/signup').withCsrfToken().redirects(0).form({
      fullName: 'Samuel Nova',
      organizationName: 'Atelier Nova',
      email: 'samuel@atelier-nova.test',
      password: PASSWORD,
      passwordConfirmation: PASSWORD,
    })

    response.assertStatus(302)
    response.assertHeader('location', '/dashboard')
    const user = await User.findByOrFail('email', 'samuel@atelier-nova.test')
    const membership = await Membership.findByOrFail('user_id', user.id)
    const organization = await Organization.findOrFail(membership.organizationId)
    assert.equal(membership.role, 'owner')
    assert.equal(organization.name, 'Atelier Nova')
    assert.notEqual(user.password, PASSWORD)
  })

  test('une inscription invalide ne crée ni compte ni organisation', async ({ client, assert }) => {
    const response = await client.post('/signup').withCsrfToken().redirects(0).form({
      fullName: 'Samuel Nova',
      organizationName: 'Atelier Nova',
      email: 'samuel@atelier-nova.test',
      password: PASSWORD,
      passwordConfirmation: 'autre-mot-de-passe',
    })

    response.assertStatus(302)
    assert.lengthOf(await User.all(), 0)
    assert.lengthOf(await Organization.all(), 0)
  })

  test('du brouillon à l’approbation, chacun ne voit que ce qu’il peut faire', async ({
    client,
    assert,
  }) => {
    const { member, legal, manager, workflow } = await createOrganization()

    const created = await client
      .post('/contracts')
      .loginAs(member)
      .withCsrfToken()
      .redirects(0)
      .form(contractForm)
    created.assertStatus(302)
    const contract = await Contract.firstOrFail()
    created.assertHeader('location', `/contracts/${contract.id}`)

    const show = (user: User) => client.get(`/contracts/${contract.id}`).loginAs(user).withInertia()
    const dashboard = async (user: User) =>
      (await client.get('/dashboard').loginAs(user).withInertia()).inertiaProps.waiting.map(
        (item: { contractId: number }) => item.contractId
      )

    const draft = await show(member)
    draft.assertInertiaComponent('contracts/show')
    assert.deepEqual(draft.inertiaProps.can, {
      revise: true,
      submit: true,
      comment: true,
      attach: true,
      generateDocument: false,
      downloadDocument: false,
      requestSignature: false,
      cancelSignature: false,
      manageTracking: false,
      engageTerm: false,
      decideApprovalId: null,
    })
    assert.equal(draft.inertiaProps.organization.role, 'member')

    await client
      .post(`/contracts/${contract.id}/submissions`)
      .loginAs(member)
      .withCsrfToken()
      .redirects(0)
      .form({ workflowId: workflow.id })
    const [legalStep, managerStep] = await Approval.query()
      .where('contract_id', contract.id)
      .orderBy('position')

    // En validation : le rédacteur ne peut plus rien, seule la juriste voit l'étape active.
    assert.deepEqual((await show(member)).inertiaProps.can, {
      revise: false,
      submit: false,
      comment: true,
      attach: true,
      generateDocument: false,
      downloadDocument: false,
      requestSignature: false,
      cancelSignature: false,
      manageTracking: false,
      engageTerm: false,
      decideApprovalId: null,
    })
    assert.equal((await show(legal)).inertiaProps.can.decideApprovalId, legalStep.id)
    assert.isNull((await show(manager)).inertiaProps.can.decideApprovalId)
    assert.deepEqual(await dashboard(legal), [contract.id])
    assert.deepEqual(await dashboard(manager), [])

    const decide = (user: User, step: Approval, form: object) =>
      client
        .post(`/contracts/${contract.id}/approvals/${step.id}/decision`)
        .loginAs(user)
        .withCsrfToken()
        .redirects(0)
        .form(form)
    ;(
      await decide(legal, legalStep, { decision: 'approve', comment: 'Clauses conformes' })
    ).assertStatus(302)

    assert.deepEqual(await dashboard(legal), [])
    assert.deepEqual(await dashboard(manager), [contract.id])
    assert.equal((await show(manager)).inertiaProps.can.decideApprovalId, managerStep.id)
    ;(await decide(manager, managerStep, { decision: 'approve' })).assertStatus(302)

    const approved = await show(member)
    assert.equal(approved.inertiaProps.contract.status, 'approved')
    assert.deepEqual(
      approved.inertiaProps.approvals.map((a: { status: string; decider: string }) => [
        a.status,
        a.decider,
      ]),
      [
        ['approved', legal.fullName],
        ['approved', manager.fullName],
      ]
    )
    assert.lengthOf(approved.inertiaProps.audit, 5)
    assert.deepEqual(
      (await client.get('/dashboard').loginAs(member).withInertia()).inertiaProps.counts,
      {
        draft: 0,
        in_review: 0,
        approved: 1,
        rejected: 0,
        signing: 0,
        signed: 0,
      }
    )
  })

  test('la page d’un contrat compare la version choisie à la précédente', async ({
    client,
    assert,
  }) => {
    const { organization, member } = await createOrganization()
    const contract = await createContract(organization.id, member.id)
    await new ContractService().revise(organization.id, contract.id, member.id, {
      body: BODY.replace('douze mois', 'vingt-quatre mois'),
      changeNote: 'Durée',
    })

    const latest = await client.get(`/contracts/${contract.id}`).loginAs(member).withInertia()
    const first = await client
      .get(`/contracts/${contract.id}?version=1`)
      .loginAs(member)
      .withInertia()

    assert.equal(latest.inertiaProps.selectedVersion, 2)
    assert.deepEqual(
      latest.inertiaProps.diff.filter((line: { kind: string }) => line.kind !== 'same'),
      [
        {
          kind: 'removed',
          text: 'Le contrat est conclu pour douze mois à compter de sa signature.',
        },
        {
          kind: 'added',
          text: 'Le contrat est conclu pour vingt-quatre mois à compter de sa signature.',
        },
      ]
    )
    assert.equal(first.inertiaProps.selectedVersion, 1)
    assert.isNull(first.inertiaProps.diff)
  })

  test('une décision rejouée par HTTP est refusée avec sa raison', async ({ client, assert }) => {
    const { organization, member, legal, workflow } = await createOrganization()
    const contract = await createContract(organization.id, member.id)
    await new ContractService().submit(organization.id, contract.id, member.id, workflow.id)
    const step = await Approval.query()
      .where('contract_id', contract.id)
      .orderBy('position')
      .firstOrFail()
    const decide = () =>
      client
        .post(`/contracts/${contract.id}/approvals/${step.id}/decision`)
        .loginAs(legal)
        .withCsrfToken()
        .accept('json')
        .json({ decision: 'approve' })

    await decide()
    const replay = await decide()

    replay.assertStatus(409)
    assert.equal(replay.body().error.reason, 'already_decided')
  })
})

test.group('Isolation et rôles', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test("les données d'une organisation sont introuvables pour une autre", async ({
    client,
    assert,
  }) => {
    const nova = await createOrganization('Atelier Nova')
    const other = await createOrganization('Autre Maison')
    const contract = await createContract(nova.organization.id, nova.member.id)
    await new ContractService().submit(
      nova.organization.id,
      contract.id,
      nova.member.id,
      nova.workflow.id
    )
    const step = await Approval.query()
      .where('contract_id', contract.id)
      .orderBy('position')
      .firstOrFail()
    const intruder = other.legal

    const page = await client.get(`/contracts/${contract.id}`).loginAs(intruder)
    page.assertStatus(404)
    const list = await client.get('/contracts').loginAs(intruder).withInertia()
    assert.deepEqual(list.inertiaProps.contracts, [])
    const workflows = await client.get('/workflows').loginAs(intruder).withInertia()
    assert.deepEqual(
      workflows.inertiaProps.workflows.map((w: { id: number }) => w.id),
      [other.workflow.id]
    )
    const members = await client.get('/members').loginAs(intruder).withInertia()
    assert.isTrue(
      members.inertiaProps.members.every((m: { email: string }) => m.email.includes('autre.maison'))
    )

    const writes: [string, object][] = [
      [`/contracts/${contract.id}/versions`, { body: BODY + '\nArticle 4 - Ajout hostile' }],
      [`/contracts/${contract.id}/submissions`, { workflowId: other.workflow.id }],
      [`/contracts/${contract.id}/approvals/${step.id}/decision`, { decision: 'approve' }],
    ]
    for (const [url, form] of writes) {
      const response = await client
        .post(url)
        .loginAs(intruder)
        .withCsrfToken()
        .redirects(0)
        .form(form)
      response.assertStatus(404)
    }
    assert.equal((await Approval.findOrFail(step.id)).status, 'pending')
  })

  test("un lecteur consulte mais n'écrit pas", async ({ client, assert }) => {
    const { organization, member, viewer } = await createOrganization()
    const contract = await createContract(organization.id, member.id)

    const page = await client.get(`/contracts/${contract.id}`).loginAs(viewer).withInertia()
    page.assertStatus(200)
    assert.deepEqual(page.inertiaProps.can, {
      revise: false,
      submit: false,
      comment: false,
      attach: false,
      generateDocument: false,
      downloadDocument: false,
      requestSignature: false,
      cancelSignature: false,
      manageTracking: false,
      engageTerm: false,
      decideApprovalId: null,
    })
    assert.isFalse(
      (await client.get('/contracts').loginAs(viewer).withInertia()).inertiaProps.canWrite
    )

    const attempts: [string, object][] = [
      ['/contracts', contractForm],
      [`/contracts/${contract.id}/versions`, { body: BODY + '\nArticle 4 - Ajout' }],
      [`/contracts/${contract.id}/submissions`, { workflowId: 1 }],
    ]
    for (const [url, form] of attempts) {
      const response = await client
        .post(url)
        .loginAs(viewer)
        .withCsrfToken()
        .accept('json')
        .redirects(0)
        .form(form)
      response.assertStatus(403)
    }
    assert.lengthOf(await Contract.all(), 1)
  })

  test('seuls propriétaire et administrateur gèrent circuits et membres', async ({
    client,
    assert,
  }) => {
    const { organization, admin, legal, viewer } = await createOrganization()
    const workflow = {
      name: 'Direction seule',
      steps: [{ name: 'Accord', approverRole: 'manager' }],
    }
    const newcomer = await User.create({
      fullName: 'Nina',
      email: 'nina@exemple.test',
      password: PASSWORD,
    })

    const refused = await client
      .post('/workflows')
      .loginAs(legal)
      .withCsrfToken()
      .accept('json')
      .redirects(0)
      .json(workflow)
    refused.assertStatus(403)
    const refusedMember = await client
      .post('/members')
      .loginAs(viewer)
      .withCsrfToken()
      .accept('json')
      .redirects(0)
      .form({ email: newcomer.email, role: 'member' })
    refusedMember.assertStatus(403)

    const created = await client
      .post('/workflows')
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
      .json(workflow)
    created.assertStatus(302)
    const added = await client
      .post('/members')
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
      .form({ email: newcomer.email, role: 'legal' })
    added.assertStatus(302)

    const stored = await Workflow.query()
      .where('name', 'Direction seule')
      .preload('steps')
      .firstOrFail()
    assert.equal(stored.organizationId, organization.id)
    assert.deepEqual(
      stored.steps.map((step) => [step.position, step.approverRole]),
      [[1, 'manager']]
    )
    assert.equal((await Membership.findByOrFail('user_id', newcomer.id)).role, 'legal')
  })

  test('un administrateur ne peut pas nommer un propriétaire', async ({ client, assert }) => {
    const { admin } = await createOrganization()
    const newcomer = await User.create({
      fullName: 'Nina',
      email: 'nina@exemple.test',
      password: PASSWORD,
    })

    const response = await client
      .post('/members')
      .loginAs(admin)
      .withCsrfToken()
      .accept('json')
      .json({ email: newcomer.email, role: 'owner' })

    response.assertStatus(403)
    assert.equal(response.body().error.reason, 'role_not_grantable')
    assert.isNull(await Membership.findBy('user_id', newcomer.id))
  })

  test('une étape de circuit ne peut pas être confiée à un rédacteur', async ({
    client,
    assert,
  }) => {
    const { admin } = await createOrganization()

    const response = await client
      .post('/workflows')
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
      .json({ name: 'Circuit invalide', steps: [{ name: 'Accord', approverRole: 'member' }] })

    assert.notEqual(response.status(), 200)
    assert.isNull(await Workflow.findBy('name', 'Circuit invalide'))
  })
})
