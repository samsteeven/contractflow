import { createHash } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import AuditLog from '#models/audit_log'
import Contract from '#models/contract'
import ContractDocument from '#models/contract_document'
import SignatureEvent from '#models/signature_event'
import SignatureProof from '#models/signature_proof'
import SignatureRequest from '#models/signature_request'
import ContractService from '#services/contract_service'
import {
  SandboxSignatureProvider,
  type CreatedRequest,
  type SignatureProvider,
} from '#services/signature_provider'
import SignatureService from '#services/signature_service'
import SignatureWebhookService from '#services/signature_webhook_service'
import { signWebhook, TOLERANCE_SECONDS, verifyWebhook } from '#services/webhook_signature'
import env from '#start/env'
import {
  assertViolation,
  BODY,
  createApprovedContract,
  createContract,
  createOrganization,
} from '#tests/helpers'

const provider = new SandboxSignatureProvider()
const signatures = new SignatureService(provider)
const webhooks = new SignatureWebhookService()
const contracts = new ContractService()
const secret = env.get('SIGNATURE_WEBHOOK_SECRET')

const ALICE = { name: 'Alice Martin', email: 'alice@nordwind.test' }
const BOB = { name: 'Bob Durand', email: 'bob@atelier-nova.test' }

type Org = Awaited<ReturnType<typeof createOrganization>>

/** Un contrat approuvé et envoyé à la signature de ces personnes. */
async function inSignature(org: Org, people = [ALICE]) {
  const contract = await createApprovedContract(org)
  await signatures.request(org.organization.id, contract.id, org.manager.id, people)
  const request = await SignatureRequest.query()
    .where('contract_id', contract.id)
    .preload('signers')
    .firstOrFail()
  return { contract, request }
}

/** Un événement du prestataire, tel qu'il arriverait par le webhook. */
function eventFor(
  request: SignatureRequest,
  signerIndex: number,
  type: 'signer.signed' | 'signer.declined' = 'signer.signed'
) {
  return provider.buildEvent({
    type,
    requestId: request.externalId,
    signerId: request.signers[signerIndex].externalId,
  })
}

const deliver = (event: { rawBody: string; header: string }) =>
  webhooks.handle(event.rawBody, event.header)

const statusOf = async (contract: Contract) => (await Contract.findOrFail(contract.id)).status

test.group('Signature du webhook', () => {
  const body = '{"id":"evt_1","type":"signer.signed"}'
  const now = 1_800_000_000

  test('une signature valide est acceptée', () => {
    verifyWebhook(secret, signWebhook(secret, body, now), body, now)
  })

  test('un corps modifié, un autre secret ou une signature absente sont refusés', ({ assert }) => {
    const header = signWebhook(secret, body, now)
    const bad: [string | undefined, string][] = [
      [header, body.replace('signed', 'declined')],
      [signWebhook('autre-secret', body, now), body],
      [undefined, body],
      ['n importe quoi', body],
      [`t=${now},v1=abcd`, body],
      [`t=${now}`, body],
    ]
    for (const [candidate, text] of bad) {
      try {
        verifyWebhook(secret, candidate, text, now)
        assert.fail(`aurait dû être refusé : ${candidate}`)
      } catch (error) {
        assert.equal((error as { reason?: string }).reason, 'invalid_webhook')
      }
    }
  })

  test('un message trop ancien ou venu du futur est refusé', ({ assert }) => {
    const header = signWebhook(secret, body, now)
    for (const shift of [TOLERANCE_SECONDS + 1, -(TOLERANCE_SECONDS + 1)]) {
      try {
        verifyWebhook(secret, header, body, now + shift)
        assert.fail('hors fenêtre')
      } catch (error) {
        assert.equal((error as { reason?: string }).reason, 'invalid_webhook')
      }
    }
    verifyWebhook(secret, header, body, now + TOLERANCE_SECONDS)
  })
})

test.group('Demande de signature', (group) => {
  group.setup(() => rm(app.makePath('tmp/storage'), { recursive: true, force: true }))
  group.each.setup(() => testUtils.db().truncate())

  test('un contrat qui n’est pas approuvé ne part pas à la signature', async ({ assert }) => {
    const org = await createOrganization()
    const draft = await createContract(org.organization.id, org.member.id)

    await assertViolation(
      assert,
      () => signatures.request(org.organization.id, draft.id, org.manager.id, [ALICE]),
      'contract_not_approved'
    )
    assert.lengthOf(await SignatureRequest.all(), 0)
  })

  test('les signataires sont contrôlés', async ({ assert }) => {
    const org = await createOrganization()
    const contract = await createApprovedContract(org)
    const bad: { name: string; email: string }[][] = [
      [],
      [{ name: 'Alice', email: 'pas-un-email' }],
      [{ name: ' ', email: 'alice@nordwind.test' }],
      [ALICE, { name: 'Autre Alice', email: 'ALICE@nordwind.test' }],
      Array.from({ length: 6 }, (_, i) => ({ name: `Signataire ${i}`, email: `s${i}@x.test` })),
    ]
    for (const signers of bad) {
      await assertViolation(
        assert,
        () => signatures.request(org.organization.id, contract.id, org.manager.id, signers),
        'invalid_signers'
      )
    }
    assert.equal(await statusOf(contract), 'approved')
  })

  test('la demande envoie le PDF, passe le contrat en signature et le verrouille', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const { contract, request } = await inSignature(org, [ALICE, BOB])

    assert.equal(await statusOf(contract), 'signing')
    assert.equal(request.status, 'pending')
    assert.equal(request.provider, 'sandbox')
    assert.deepEqual(
      request.signers.map((signer) => [signer.email, signer.status]),
      [
        ['alice@nordwind.test', 'pending'],
        ['bob@atelier-nova.test', 'pending'],
      ]
    )
    const document = await ContractDocument.findOrFail(request.documentId)
    assert.isTrue(await drive.use().exists(document.storageKey))
    assert.lengthOf(await AuditLog.query().where('action', 'signature.requested'), 1)

    await assertViolation(
      assert,
      () =>
        contracts.revise(org.organization.id, contract.id, org.member.id, {
          body: BODY.replace('douze', 'vingt-quatre'),
          changeNote: null,
        }),
      'contract_in_signature'
    )
    await assertViolation(
      assert,
      () => signatures.request(org.organization.id, contract.id, org.manager.id, [BOB]),
      'contract_not_approved'
    )
  })

  test('annuler rend le contrat à l’état approuvé, donc modifiable', async ({ assert }) => {
    const org = await createOrganization()
    const { contract, request } = await inSignature(org)

    await signatures.cancel(org.organization.id, contract.id, org.manager.id)

    assert.equal(await statusOf(contract), 'approved')
    assert.equal((await SignatureRequest.findOrFail(request.id)).status, 'cancelled')
    await contracts.revise(org.organization.id, contract.id, org.member.id, {
      body: BODY.replace('douze', 'vingt-quatre'),
      changeNote: null,
    })
    await assertViolation(
      assert,
      () => signatures.cancel(org.organization.id, contract.id, org.manager.id),
      'no_pending_signature'
    )
  })

  test('si le prestataire échoue, rien n’est enregistré', async ({ assert }) => {
    const org = await createOrganization()
    const contract = await createApprovedContract(org)
    const failing: SignatureProvider = {
      name: 'en-panne',
      createRequest: async (): Promise<CreatedRequest> => {
        throw new Error('prestataire indisponible')
      },
      cancelRequest: async () => {},
      signUrl: () => null,
    }

    try {
      await new SignatureService(failing).request(
        org.organization.id,
        contract.id,
        org.manager.id,
        [ALICE]
      )
      assert.fail('aurait dû échouer')
    } catch (error) {
      assert.equal((error as Error).message, 'prestataire indisponible')
    }
    assert.equal(await statusOf(contract), 'approved')
    assert.lengthOf(await SignatureRequest.all(), 0)
  })

  test('le contrat d’une autre organisation est introuvable', async ({ assert }) => {
    const a = await createOrganization('Atelier A')
    const b = await createOrganization('Atelier B')
    const contract = await createApprovedContract(b)

    try {
      await signatures.request(a.organization.id, contract.id, a.manager.id, [ALICE])
      assert.fail('aurait dû être refusé')
    } catch (error) {
      assert.equal((error as { code?: string }).code, 'E_ROW_NOT_FOUND')
    }
    assert.equal(await statusOf(contract), 'approved')
  })
})

test.group('Événements du prestataire', (group) => {
  group.setup(() => rm(app.makePath('tmp/storage'), { recursive: true, force: true }))
  group.each.setup(() => testUtils.db().truncate())

  test('le dernier signataire fige le contrat et archive la preuve', async ({ assert }) => {
    const org = await createOrganization()
    const { contract, request } = await inSignature(org, [ALICE, BOB])

    assert.equal(await deliver(eventFor(request, 0)), 'applied')
    assert.equal(await statusOf(contract), 'signing')
    assert.equal(await deliver(eventFor(request, 1)), 'applied')

    assert.equal(await statusOf(contract), 'signed')
    const done = await SignatureRequest.query()
      .where('id', request.id)
      .preload('signers')
      .firstOrFail()
    assert.equal(done.status, 'completed')
    assert.isTrue(
      done.signers.every((signer) => signer.status === 'signed' && Boolean(signer.signedAt))
    )

    const proof = await SignatureProof.firstOrFail()
    const stored = Buffer.from(await drive.use().getBytes(proof.storageKey))
    assert.equal(proof.checksum, createHash('sha256').update(stored).digest('hex'))
    const content = JSON.parse(stored.toString())
    assert.equal(content.requestId, request.externalId)
    assert.equal(content.version, 1)
    assert.deepEqual(
      content.signers.map((signer: { email: string }) => signer.email),
      [ALICE.email, BOB.email]
    )
    assert.isTrue(content.signers.every((signer: { eventId: string | null }) => signer.eventId))
    assert.lengthOf(await AuditLog.query().where('action', 'contract.signed'), 1)
    assert.lengthOf(await SignatureEvent.query().where('outcome', 'applied'), 2)
  })

  test('rejouer un événement ne change rien', async ({ assert }) => {
    const org = await createOrganization()
    const { contract, request } = await inSignature(org, [ALICE, BOB])
    const event = eventFor(request, 0)

    assert.equal(await deliver(event), 'applied')
    assert.equal(await deliver(event), 'duplicate')
    assert.equal(await deliver(event), 'duplicate')

    assert.equal(await statusOf(contract), 'signing')
    assert.lengthOf(await SignatureEvent.all(), 1)
    assert.lengthOf(await AuditLog.query().where('action', 'signature.signed'), 1)
  })

  test('une même livraison reçue trois fois en même temps n’est appliquée qu’une fois', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const { contract, request } = await inSignature(org)
    const event = eventFor(request, 0)

    const results = await Promise.all([deliver(event), deliver(event), deliver(event)])

    assert.deepEqual([...results].sort(), ['applied', 'duplicate', 'duplicate'])
    assert.equal(await statusOf(contract), 'signed')
    assert.lengthOf(await SignatureEvent.all(), 1)
    assert.lengthOf(await SignatureProof.all(), 1)
    assert.lengthOf(await AuditLog.query().where('action', 'contract.signed'), 1)
  })

  test('un refus clôt la demande et rend le contrat à l’état approuvé', async ({ assert }) => {
    const org = await createOrganization()
    const { contract, request } = await inSignature(org, [ALICE, BOB])

    assert.equal(await deliver(eventFor(request, 1, 'signer.declined')), 'applied')

    assert.equal(await statusOf(contract), 'approved')
    assert.equal((await SignatureRequest.findOrFail(request.id)).status, 'declined')
    assert.lengthOf(await SignatureProof.all(), 0)
    // Les signatures qui arrivent ensuite sont archivées mais sans effet.
    assert.equal(await deliver(eventFor(request, 0)), 'ignored')
    assert.equal(await statusOf(contract), 'approved')
    // On peut relancer une nouvelle demande.
    await signatures.request(org.organization.id, contract.id, org.manager.id, [ALICE])
    assert.equal(await statusOf(contract), 'signing')
  })

  test('un événement arrivé après l’annulation est archivé sans effet', async ({ assert }) => {
    const org = await createOrganization()
    const { contract, request } = await inSignature(org)
    await signatures.cancel(org.organization.id, contract.id, org.manager.id)

    assert.equal(await deliver(eventFor(request, 0)), 'ignored')

    assert.equal(await statusOf(contract), 'approved')
    assert.lengthOf(await SignatureProof.all(), 0)
    const event = await SignatureEvent.firstOrFail()
    assert.equal(event.outcome, 'ignored')
  })

  test('un signataire qui a déjà signé ne signe pas deux fois', async ({ assert }) => {
    const org = await createOrganization()
    const { request } = await inSignature(org, [ALICE, BOB])

    assert.equal(await deliver(eventFor(request, 0)), 'applied')
    assert.equal(await deliver(eventFor(request, 0)), 'ignored')

    assert.lengthOf(await AuditLog.query().where('action', 'signature.signed'), 1)
  })

  test('un événement mal signé est refusé sans aucun effet', async ({ assert }) => {
    const org = await createOrganization()
    const { contract, request } = await inSignature(org)
    const event = eventFor(request, 0)

    for (const header of [
      signWebhook('mauvais-secret', event.rawBody, Math.floor(Date.now() / 1000)),
      event.header.replace(/.$/, (c) => (c === '0' ? '1' : '0')),
    ]) {
      await assertViolation(assert, () => webhooks.handle(event.rawBody, header), 'invalid_webhook')
    }
    await assertViolation(
      assert,
      () =>
        webhooks.handle(event.rawBody.replace('signer.signed', 'signer.declined'), event.header),
      'invalid_webhook'
    )

    assert.equal(await statusOf(contract), 'signing')
    assert.lengthOf(await SignatureEvent.all(), 0)
  })

  test('un événement bien signé mais incomplet ou inconnu est refusé', async ({ assert }) => {
    const sign = (body: string) => ({
      rawBody: body,
      header: signWebhook(secret, body, Math.floor(Date.now() / 1000)),
    })
    await assertViolation(assert, () => deliver(sign('pas du json')), 'invalid_webhook')
    await assertViolation(
      assert,
      () => deliver(sign(JSON.stringify({ id: 'e1', type: 'signer.exploded' }))),
      'invalid_webhook'
    )
    try {
      await deliver(
        sign(
          JSON.stringify({
            id: 'e2',
            type: 'signer.signed',
            requestId: 'inconnue',
            signerId: 'x',
            occurredAt: new Date().toISOString(),
          })
        )
      )
      assert.fail('demande inconnue')
    } catch (error) {
      assert.equal((error as { code?: string }).code, 'E_ROW_NOT_FOUND')
    }
  })

  test('un contrat signé est figé, même contre un accès direct à la base', async ({ assert }) => {
    const org = await createOrganization()
    const { contract, request } = await inSignature(org)
    await deliver(eventFor(request, 0))

    await assertViolation(
      assert,
      () =>
        contracts.revise(org.organization.id, contract.id, org.member.id, {
          body: BODY.replace('douze', 'vingt-quatre'),
          changeNote: null,
        }),
      'contract_signed'
    )
    for (const sql of [
      `update contracts set title = 'Réécrit' where id = ${contract.id}`,
      `update contracts set status = 'draft' where id = ${contract.id}`,
      `delete from contracts where id = ${contract.id}`,
      `update signature_events set outcome = 'ignored'`,
      `delete from signature_events`,
      `update signature_proofs set checksum = repeat('0', 64)`,
      `delete from signature_proofs`,
    ]) {
      try {
        await db.rawQuery(sql)
        assert.fail(`la base aurait dû refuser : ${sql}`)
      } catch (error) {
        assert.match((error as Error).message, /immuable/)
      }
    }
    assert.equal(await statusOf(contract), 'signed')
  })
})

test.group('Signature par HTTP', (group) => {
  group.setup(() => rm(app.makePath('tmp/storage'), { recursive: true, force: true }))
  group.each.setup(() => testUtils.db().truncate())

  const form = (signers: { name: string; email: string }[]) =>
    Object.fromEntries(
      signers.flatMap((signer, index) => [
        [`signers[${index}][name]`, signer.name],
        [`signers[${index}][email]`, signer.email],
      ])
    )

  test('la direction demande la signature, le rédacteur et le lecteur sont refusés', async ({
    client,
    assert,
  }) => {
    const org = await createOrganization()
    const contract = await createApprovedContract(org)
    const post = (user: typeof org.manager) =>
      client
        .post(`/contracts/${contract.id}/signature`)
        .loginAs(user)
        .withCsrfToken()
        .accept('json')
        .redirects(0)
        .form(form([ALICE]))

    ;(await post(org.member)).assertStatus(403)
    ;(await post(org.viewer)).assertStatus(403)
    ;(await post(org.legal)).assertStatus(403)
    assert.equal(await statusOf(contract), 'approved')

    const page = await client.get(`/contracts/${contract.id}`).loginAs(org.manager).withInertia()
    assert.isTrue(page.inertiaProps.can.requestSignature)
    const memberPage = await client
      .get(`/contracts/${contract.id}`)
      .loginAs(org.member)
      .withInertia()
    assert.isFalse(memberPage.inertiaProps.can.requestSignature)

    ;(await post(org.manager)).assertStatus(302)
    assert.equal(await statusOf(contract), 'signing')

    const signing = await client.get(`/contracts/${contract.id}`).loginAs(org.manager).withInertia()
    assert.isFalse(signing.inertiaProps.can.revise)
    assert.isTrue(signing.inertiaProps.can.cancelSignature)
    assert.equal(signing.inertiaProps.signature.status, 'pending')
    assert.match(signing.inertiaProps.signature.signers[0].signUrl, /\/sandbox\/sign\/sbx_sig_/)
  })

  test('une saisie invalide est refusée avec les erreurs de champs', async ({ client, assert }) => {
    const org = await createOrganization()
    const contract = await createApprovedContract(org)

    const response = await client
      .post(`/contracts/${contract.id}/signature`)
      .loginAs(org.manager)
      .withCsrfToken()
      .accept('json')
      .form(form([{ name: 'Alice', email: 'pas-un-email' }]))

    response.assertStatus(422)
    assert.equal(await statusOf(contract), 'approved')
  })

  test('le webhook public accepte un événement signé, sans session ni jeton CSRF', async ({
    client,
    assert,
  }) => {
    const org = await createOrganization()
    const { contract, request } = await inSignature(org)
    const event = eventFor(request, 0)

    const response = await client
      .post('/webhooks/signature')
      .header('content-type', 'application/json')
      .header('x-contractflow-signature', event.header)
      .json(JSON.parse(event.rawBody))
    response.assertStatus(200)
    response.assertBodyContains({ result: 'applied' })
    assert.equal(await statusOf(contract), 'signed')

    const replay = await client
      .post('/webhooks/signature')
      .header('content-type', 'application/json')
      .header('x-contractflow-signature', event.header)
      .json(JSON.parse(event.rawBody))
    replay.assertStatus(200)
    replay.assertBodyContains({ result: 'duplicate' })
  })

  test('le webhook répond en JSON : 401 signature, 422 corps, 404 demande inconnue', async ({
    client,
    assert,
  }) => {
    const org = await createOrganization()
    const { contract, request } = await inSignature(org)
    const event = eventFor(request, 0)
    const send = (rawBody: string, header?: string) =>
      client
        .post('/webhooks/signature')
        .header('content-type', 'application/json')
        .header('x-contractflow-signature', header ?? '')
        .json(JSON.parse(rawBody))
    const signed = (rawBody: string) => signWebhook(secret, rawBody, Math.floor(Date.now() / 1000))

    const forged = await send(event.rawBody, 'nope')
    forged.assertStatus(401)
    forged.assertBodyContains({ error: { reason: 'invalid_webhook' } })
    ;(await send(event.rawBody.replace('signed', 'declined'), event.header)).assertStatus(401)
    const garbage = '{"id":"e","type":"signer.signed"}'
    ;(await send(garbage, signed(garbage))).assertStatus(422)
    const unknown = JSON.stringify({
      id: 'e9',
      type: 'signer.signed',
      requestId: 'inconnue',
      signerId: 'x',
      occurredAt: new Date().toISOString(),
    })
    ;(await send(unknown, signed(unknown))).assertStatus(404)

    assert.equal(await statusOf(contract), 'signing')
  })

  test('la page du bac à sable fait signer, puis la preuve se télécharge', async ({
    client,
    assert,
  }) => {
    const org = await createOrganization()
    const { contract, request } = await inSignature(org)
    const signerId = request.signers[0].externalId

    const page = await client.get(`/sandbox/sign/${signerId}`).withInertia()
    page.assertStatus(200)
    assert.equal(page.inertiaProps.signer.status, 'pending')
    assert.include(page.inertiaProps.version.body, 'Article 1 - Objet')
    ;(await client.get('/sandbox/sign/sbx_sig_inconnu').withInertia()).assertStatus(404)

    // Pas de preuve avant la fin.
    ;(
      await client
        .get(`/contracts/${contract.id}/signature/proof`)
        .loginAs(org.manager)
        .redirects(0)
    ).assertStatus(404)

    const signed = await client
      .post(`/sandbox/sign/${signerId}`)
      .withCsrfToken()
      .redirects(0)
      .form({ decision: 'sign' })
    signed.assertStatus(302)
    assert.equal(await statusOf(contract), 'signed')

    const after = await client.get(`/sandbox/sign/${signerId}`).withInertia()
    assert.equal(after.inertiaProps.signer.status, 'signed')
    assert.equal(after.inertiaProps.requestStatus, 'completed')

    const detail = await client.get(`/contracts/${contract.id}`).loginAs(org.viewer).withInertia()
    assert.equal(detail.inertiaProps.contract.status, 'signed')
    assert.isTrue(detail.inertiaProps.signature.hasProof)
    assert.isFalse(detail.inertiaProps.can.revise)
    assert.isNull(detail.inertiaProps.signature.signers[0].signUrl)

    const proof = await client
      .get(`/contracts/${contract.id}/signature/proof`)
      .loginAs(org.viewer)
      .redirects(0)
    proof.assertStatus(302)
    assert.match(proof.header('location') as string, /signature=/i)
  })

  test('refuser sur la page du bac à sable clôt la demande', async ({ client, assert }) => {
    const org = await createOrganization()
    const { contract, request } = await inSignature(org)

    ;(
      await client
        .post(`/sandbox/sign/${request.signers[0].externalId}`)
        .withCsrfToken()
        .redirects(0)
        .form({ decision: 'decline' })
    ).assertStatus(302)

    assert.equal(await statusOf(contract), 'approved')
    assert.equal((await SignatureRequest.findOrFail(request.id)).status, 'declined')
  })

  test('la preuve d’une autre organisation est introuvable', async ({ client }) => {
    const a = await createOrganization('Atelier A')
    const b = await createOrganization('Atelier B')
    const { contract, request } = await inSignature(b)
    await deliver(eventFor(request, 0))

    ;(
      await client.get(`/contracts/${contract.id}/signature/proof`).loginAs(a.owner).redirects(0)
    ).assertStatus(404)
  })
})
