import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import AuditLog from '#models/audit_log'
import ContractTerm from '#models/contract_term'
import Obligation from '#models/obligation'
import Reminder from '#models/reminder'
import ObligationService, { parseDay } from '#services/obligation_service'
import ReminderService, {
  daysUntil,
  STALE_AFTER_MINUTES,
  stageFor,
  type ReminderQueue,
} from '#services/reminder_service'
import { BullReminderQueue, startWorker } from '#services/reminder_queue'
import {
  assertViolation,
  createApprovedContract,
  createContract,
  createOrganization,
  createSignedContract,
  createUser,
} from '#tests/helpers'

const obligations = new ObligationService()
const today = DateTime.utc(2026, 11, 17)
const day = (offset: number) => today.plus({ days: offset }).toISODate()!

type Org = Awaited<ReturnType<typeof createOrganization>>

const termInput = (org: Org, over: Partial<Parameters<ObligationService['setTerm']>[3]> = {}) => ({
  startsOn: '2026-11-01',
  endsOn: '2027-10-31',
  autoRenew: true,
  noticeDays: 60,
  renewalMonths: 12,
  assigneeId: org.manager.id,
  ...over,
})

/** Une file qui retient les identifiants au lieu de les envoyer à Redis. */
class MemoryQueue implements ReminderQueue {
  ids: number[] = []
  async enqueue(id: number) {
    this.ids.push(id)
  }
}

async function signedWithTerm(org: Org, over = {}) {
  const contract = await createSignedContract(org)
  await obligations.setTerm(org.organization.id, contract.id, org.member.id, termInput(org, over))
  return contract
}

/** Une obligation ouverte à `offset` jours d'aujourd'hui (jour simulé). */
async function dueIn(org: Org, contractId: number, offset: number, title = `À faire ${offset}`) {
  return obligations.addObligation(org.organization.id, contractId, org.member.id, {
    title,
    kind: 'payment',
    dueOn: day(offset),
    assigneeId: org.manager.id,
    notes: null,
  })
}

test.group('Paliers de rappel', () => {
  test('le palier dépend des jours restants', ({ assert }) => {
    const expected: [number, string | null][] = [
      [60, null],
      [31, null],
      [30, 'd30'],
      [8, 'd30'],
      [7, 'd7'],
      [2, 'd7'],
      [1, 'd1'],
      [0, 'd0'],
      [-1, 'overdue'],
      [-40, 'overdue'],
    ]
    for (const [days, stage] of expected) assert.equal(stageFor(days), stage, `${days} jours`)
  })

  test('les jours se comptent en jours calendaires, pas en heures', ({ assert }) => {
    const late = DateTime.fromISO('2026-11-17T23:59:00', { zone: 'utc' })
    const early = DateTime.fromISO('2026-11-17T00:01:00', { zone: 'utc' })
    const due = DateTime.fromISO('2026-11-18', { zone: 'utc' })
    assert.equal(daysUntil(due, late), 1)
    assert.equal(daysUntil(due, early), 1)
  })

  test('une date invalide est refusée', async ({ assert }) => {
    for (const bad of ['2026-13-40', '17/11/2026', '', '2026-2-3']) {
      try {
        parseDay(bad, 'test')
        assert.fail(`aurait dû être refusée : ${bad}`)
      } catch (error) {
        assert.equal((error as { reason?: string }).reason, 'invalid_term')
      }
    }
  })
})

test.group('Durée et obligations', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('la durée ne se fixe que sur un contrat signé', async ({ assert }) => {
    const org = await createOrganization()
    const draft = await createContract(org.organization.id, org.member.id)
    const approved = await createApprovedContract(org)

    for (const contract of [draft, approved]) {
      await assertViolation(
        assert,
        () => obligations.setTerm(org.organization.id, contract.id, org.member.id, termInput(org)),
        'contract_not_signed'
      )
    }
    assert.lengthOf(await ContractTerm.all(), 0)
  })

  test('la durée crée l’échéance de fin : fin moins préavis, avec reconduction', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const contract = await createSignedContract(org)

    await obligations.setTerm(org.organization.id, contract.id, org.member.id, termInput(org))

    const [deadline] = await Obligation.query().where('contract_id', contract.id)
    assert.equal(deadline.kind, 'renewal_notice')
    assert.equal(deadline.dueOn.toISODate(), '2027-09-01')
    assert.equal(deadline.assigneeId, org.manager.id)
    assert.equal(deadline.status, 'open')
    assert.include(deadline.title, 'Préavis de non-reconduction')
    assert.lengthOf(await AuditLog.query().where('action', 'term.set'), 1)
  })

  test('sans reconduction, l’échéance est la fin du contrat', async ({ assert }) => {
    const org = await createOrganization()
    const contract = await createSignedContract(org)

    await obligations.setTerm(
      org.organization.id,
      contract.id,
      org.member.id,
      termInput(org, { autoRenew: false, renewalMonths: null, noticeDays: 30 })
    )

    const deadline = await Obligation.query().where('contract_id', contract.id).firstOrFail()
    assert.include(deadline.title, 'Fin du contrat')
    assert.equal(deadline.dueOn.toISODate(), '2027-10-01')
  })

  test('une durée incohérente ne crée rien', async ({ assert }) => {
    const org = await createOrganization()
    const contract = await createSignedContract(org)
    const stranger = await createUser('Étranger')
    const bad = [
      termInput(org, { endsOn: '2026-11-01' }),
      termInput(org, { endsOn: '2026-10-01' }),
      termInput(org, { renewalMonths: null }),
      termInput(org, { endsOn: '2027-02-30' }),
    ]
    for (const input of bad) {
      await assertViolation(
        assert,
        () => obligations.setTerm(org.organization.id, contract.id, org.member.id, input),
        'invalid_term'
      )
    }
    await assertViolation(
      assert,
      () =>
        obligations.setTerm(
          org.organization.id,
          contract.id,
          org.member.id,
          termInput(org, { assigneeId: stranger.id })
        ),
      'unknown_assignee'
    )
    assert.lengthOf(await ContractTerm.all(), 0)
    assert.lengthOf(await Obligation.all(), 0)
  })

  test('la durée ne se définit qu’une fois', async ({ assert }) => {
    const org = await createOrganization()
    const contract = await signedWithTerm(org)

    await assertViolation(
      assert,
      () => obligations.setTerm(org.organization.id, contract.id, org.member.id, termInput(org)),
      'term_exists'
    )
    assert.lengthOf(await Obligation.all(), 1)
  })

  test('on ajoute des obligations à la main, sauf le préavis qui se déduit de la durée', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const contract = await createSignedContract(org)
    const input = {
      title: 'Payer la première échéance',
      kind: 'payment' as const,
      dueOn: '2026-12-01',
      assigneeId: org.manager.id,
      notes: ' note ',
    }

    const obligation = await obligations.addObligation(
      org.organization.id,
      contract.id,
      org.member.id,
      input
    )
    assert.equal(obligation.notes, 'note')
    assert.equal(obligation.dueOn.toISODate(), '2026-12-01')

    await assertViolation(
      assert,
      () =>
        obligations.addObligation(org.organization.id, contract.id, org.member.id, {
          ...input,
          kind: 'renewal_notice',
        }),
      'invalid_obligation'
    )
    const approved = await createApprovedContract(org)
    await assertViolation(
      assert,
      () => obligations.addObligation(org.organization.id, approved.id, org.member.id, input),
      'contract_not_signed'
    )
    const stranger = await createUser('Étranger')
    await assertViolation(
      assert,
      () =>
        obligations.addObligation(org.organization.id, contract.id, org.member.id, {
          ...input,
          assigneeId: stranger.id,
        }),
      'unknown_assignee'
    )
  })

  test('seul le responsable ou un administrateur clôt une obligation, une seule fois', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const contract = await createSignedContract(org)
    const make = () => dueIn(org, contract.id, 5)
    const first = await make()

    await assertViolation(
      assert,
      () =>
        obligations.complete(org.organization.id, contract.id, first.id, {
          id: org.legal.id,
          role: 'legal',
        }),
      'not_assignee'
    )
    await obligations.complete(org.organization.id, contract.id, first.id, {
      id: org.manager.id,
      role: 'manager',
    })
    const done = await Obligation.findOrFail(first.id)
    assert.equal(done.status, 'done')
    assert.equal(done.completedBy, org.manager.id)
    assert.isNotNull(done.completedAt)
    await assertViolation(
      assert,
      () =>
        obligations.complete(org.organization.id, contract.id, first.id, {
          id: org.manager.id,
          role: 'manager',
        }),
      'obligation_closed'
    )

    const second = await make()
    await obligations.complete(org.organization.id, contract.id, second.id, {
      id: org.admin.id,
      role: 'admin',
    })
    assert.equal((await Obligation.findOrFail(second.id)).status, 'done')
  })

  test('annuler : le créateur ou un administrateur, pas un autre membre', async ({ assert }) => {
    const org = await createOrganization()
    const contract = await createSignedContract(org)
    const obligation = await dueIn(org, contract.id, 5)

    await assertViolation(
      assert,
      () =>
        obligations.cancel(org.organization.id, contract.id, obligation.id, {
          id: org.legal.id,
          role: 'legal',
        }),
      'not_assignee'
    )
    await obligations.cancel(org.organization.id, contract.id, obligation.id, {
      id: org.member.id,
      role: 'member',
    })
    assert.equal((await Obligation.findOrFail(obligation.id)).status, 'cancelled')
    await assertViolation(
      assert,
      () =>
        obligations.cancel(org.organization.id, contract.id, obligation.id, {
          id: org.admin.id,
          role: 'admin',
        }),
      'obligation_closed'
    )
  })

  test('une obligation d’un autre contrat ou d’une autre organisation est introuvable', async ({
    assert,
  }) => {
    const a = await createOrganization('Atelier A')
    const b = await createOrganization('Atelier B')
    const mine = await createSignedContract(a)
    const theirs = await createSignedContract(b)
    const foreign = await dueIn(b, theirs.id, 5)

    for (const [orgId, contractId] of [
      [a.organization.id, mine.id],
      [a.organization.id, theirs.id],
    ]) {
      try {
        await obligations.complete(orgId, contractId, foreign.id, {
          id: a.owner.id,
          role: 'owner',
        })
        assert.fail('aurait dû être refusée')
      } catch (error) {
        assert.equal((error as { code?: string }).code, 'E_ROW_NOT_FOUND')
      }
    }
    assert.equal((await Obligation.findOrFail(foreign.id)).status, 'open')
  })
})

test.group('Reconduction et fin', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('reconduire recule la fin, clôt l’échéance en cours et en crée une nouvelle', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const contract = await signedWithTerm(org)

    const term = await obligations.renew(org.organization.id, contract.id, org.manager.id)

    assert.equal(term.endsOn.toISODate(), '2028-10-31')
    const all = await Obligation.query().where('contract_id', contract.id).orderBy('id')
    assert.deepEqual(
      all.map((o) => [o.status, o.dueOn.toISODate()]),
      [
        ['done', '2027-09-01'],
        ['open', '2028-09-01'],
      ]
    )
    assert.equal(all[1].assigneeId, org.manager.id)
    assert.lengthOf(await AuditLog.query().where('action', 'term.renewed'), 1)
  })

  test('deux reconductions simultanées s’appliquent l’une après l’autre, sans échéance en double', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const contract = await signedWithTerm(org)

    await Promise.all([
      obligations.renew(org.organization.id, contract.id, org.manager.id),
      obligations.renew(org.organization.id, contract.id, org.manager.id),
    ])

    const term = await ContractTerm.firstOrFail()
    assert.equal(term.endsOn.toISODate(), '2029-10-31')
    assert.lengthOf(await Obligation.query().where('status', 'open'), 1)
  })

  test('sans durée de reconduction, on ne reconduit pas', async ({ assert }) => {
    const org = await createOrganization()
    const contract = await signedWithTerm(org, { autoRenew: false, renewalMonths: null })

    await assertViolation(
      assert,
      () => obligations.renew(org.organization.id, contract.id, org.manager.id),
      'no_renewal_term'
    )
  })

  test('mettre fin annule l’échéance, puis plus rien ne se reconduit', async ({ assert }) => {
    const org = await createOrganization()
    const contract = await signedWithTerm(org)

    await obligations.terminate(org.organization.id, contract.id, org.manager.id)

    assert.equal((await ContractTerm.firstOrFail()).status, 'terminated')
    assert.equal((await Obligation.firstOrFail()).status, 'cancelled')
    await assertViolation(
      assert,
      () => obligations.renew(org.organization.id, contract.id, org.manager.id),
      'term_terminated'
    )
    await assertViolation(
      assert,
      () => obligations.terminate(org.organization.id, contract.id, org.manager.id),
      'term_terminated'
    )
  })

  test('renouveler sans durée définie est refusé', async ({ assert }) => {
    const org = await createOrganization()
    const contract = await createSignedContract(org)

    await assertViolation(
      assert,
      () => obligations.renew(org.organization.id, contract.id, org.manager.id),
      'no_term'
    )
  })
})

test.group('Parcours des rappels', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('chaque obligation proche reçoit le palier atteint, les lointaines et les closes rien', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const contract = await createSignedContract(org)
    const expected: Record<string, string | null> = {}
    for (const [offset, stage] of [
      [45, null],
      [31, null],
      [30, 'd30'],
      [8, 'd30'],
      [7, 'd7'],
      [1, 'd1'],
      [0, 'd0'],
      [-3, 'overdue'],
    ] as const) {
      expected[(await dueIn(org, contract.id, offset)).id] = stage
    }
    const closed = await dueIn(org, contract.id, 2, 'Déjà faite')
    await obligations.complete(org.organization.id, contract.id, closed.id, {
      id: org.manager.id,
      role: 'manager',
    })

    const queue = new MemoryQueue()
    const result = await new ReminderService(queue).scan(today)

    assert.deepEqual(result, { created: 6, requeued: 0 })
    const reminders = await Reminder.query().orderBy('obligation_id')
    assert.deepEqual(
      Object.fromEntries(reminders.map((r) => [r.obligationId, r.stage])),
      Object.fromEntries(Object.entries(expected).filter(([, stage]) => stage))
    )
    assert.isTrue(reminders.every((r) => r.status === 'queued' && r.recipientId === org.manager.id))
    assert.sameMembers(
      queue.ids,
      reminders.map((r) => r.id)
    )
  })

  test('relancer le parcours ne double rien, un nouveau palier crée un nouveau rappel', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const contract = await createSignedContract(org)
    await dueIn(org, contract.id, 8)
    const queue = new MemoryQueue()
    const service = new ReminderService(queue)

    assert.deepEqual(await service.scan(today), { created: 1, requeued: 0 })
    assert.deepEqual(await service.scan(today), { created: 0, requeued: 0 })
    assert.deepEqual(await service.scan(today.plus({ days: 0 })), { created: 0, requeued: 0 })
    // Le lendemain, l'échéance est à 7 jours : palier suivant.
    assert.deepEqual(await service.scan(today.plus({ days: 1 })), { created: 1, requeued: 0 })

    assert.deepEqual(
      (await Reminder.query().orderBy('id')).map((r) => r.stage),
      ['d30', 'd7']
    )
  })

  test('après une interruption, seul le palier à jour est envoyé', async ({ assert }) => {
    const org = await createOrganization()
    const contract = await createSignedContract(org)
    await dueIn(org, contract.id, 3)

    await new ReminderService(new MemoryQueue()).scan(today)

    assert.deepEqual(
      (await Reminder.all()).map((r) => r.stage),
      ['d7']
    )
  })

  test('un rappel resté trop longtemps à envoyer est remis dans la file, pas un récent', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const contract = await createSignedContract(org)
    await dueIn(org, contract.id, 5)
    const queue = new MemoryQueue()
    const service = new ReminderService(queue)
    const now = DateTime.utc()
    await service.scan(today, now)
    const reminder = await Reminder.firstOrFail()

    queue.ids = []
    assert.deepEqual(await service.scan(today, now.plus({ minutes: STALE_AFTER_MINUTES - 5 })), {
      created: 0,
      requeued: 0,
    })
    assert.deepEqual(await service.scan(today, now.plus({ minutes: STALE_AFTER_MINUTES + 5 })), {
      created: 0,
      requeued: 1,
    })
    assert.deepEqual(queue.ids, [reminder.id])
  })
})

test.group('Envoi des rappels', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.teardown(() => mail.restore())

  async function queued(org: Org, title = 'Payer la facture', offset = 7) {
    const contract = await createSignedContract(org)
    await dueIn(org, contract.id, offset, title)
    await new ReminderService(new MemoryQueue()).scan(today)
    return { contract, reminder: await Reminder.firstOrFail() }
  }

  test('le responsable reçoit un e-mail, une seule fois', async ({ assert }) => {
    const org = await createOrganization()
    const { reminder } = await queued(org)
    const mails = mail.fake()
    const service = new ReminderService(new MemoryQueue())

    assert.equal(await service.send(reminder.id, today), 'sent')
    assert.equal(await service.send(reminder.id, today), 'already_handled')

    const sent = mails.mails.sent().map((m) => m.message)
    assert.lengthOf(sent, 1)
    const message = sent[0].nodeMailerMessage
    assert.include(JSON.stringify(message.to), org.manager.email)
    assert.include(String(message.subject), 'Payer la facture')
    assert.include(String(message.subject), 'dans 7 jours')
    assert.include(String(message.text), day(7))
    assert.include(String(message.text), '/contracts/')
    const saved = await Reminder.findOrFail(reminder.id)
    assert.equal(saved.status, 'sent')
    assert.equal(saved.attempts, 1)
    assert.isNotNull(saved.sentAt)
  })

  test('le texte du rappel est échappé dans la version HTML', async ({ assert }) => {
    const org = await createOrganization()
    const { reminder } = await queued(org, '<script>alert(1)</script>')
    const mails = mail.fake()

    await new ReminderService(new MemoryQueue()).send(reminder.id, today)

    const html = String(mails.mails.sent().map((m) => m.message)[0].nodeMailerMessage.html)
    assert.notInclude(html, '<script>')
    assert.include(html, '&lt;script&gt;')
  })

  test('une obligation close entre-temps n’envoie rien', async ({ assert }) => {
    const org = await createOrganization()
    const { contract, reminder } = await queued(org)
    const obligation = await Obligation.firstOrFail()
    await obligations.complete(org.organization.id, contract.id, obligation.id, {
      id: org.manager.id,
      role: 'manager',
    })
    const mails = mail.fake()
    const service = new ReminderService(new MemoryQueue())

    assert.equal(await service.send(reminder.id, today), 'skipped')
    assert.equal(await service.send(reminder.id, today), 'already_handled')

    assert.lengthOf(
      mails.mails.sent().map((m) => m.message),
      0
    )
    assert.equal((await Reminder.findOrFail(reminder.id)).status, 'skipped')
  })

  test('une panne d’envoi est notée et relancée, le rappel reste à envoyer', async ({ assert }) => {
    const org = await createOrganization()
    const { reminder } = await queued(org)
    const original = mail.send.bind(mail)
    mail.send = async () => {
      throw new Error('SMTP indisponible')
    }
    try {
      try {
        await new ReminderService(new MemoryQueue()).send(reminder.id, today)
        assert.fail('aurait dû échouer')
      } catch (error) {
        assert.equal((error as Error).message, 'SMTP indisponible')
      }
    } finally {
      mail.send = original
    }

    const saved = await Reminder.findOrFail(reminder.id)
    assert.equal(saved.status, 'queued')
    assert.equal(saved.attempts, 1)
    assert.equal(saved.lastError, 'SMTP indisponible')

    // La relance suivante aboutit.
    const mails = mail.fake()
    assert.equal(await new ReminderService(new MemoryQueue()).send(reminder.id, today), 'sent')
    assert.lengthOf(
      mails.mails.sent().map((m) => m.message),
      1
    )
    const done = await Reminder.findOrFail(reminder.id)
    assert.equal(done.attempts, 2)
    assert.isNull(done.lastError)
  })

  test('rappel en retard : le sujet le dit', async ({ assert }) => {
    const org = await createOrganization()
    const { reminder } = await queued(org, 'Livrer le rapport', -3)
    const mails = mail.fake()

    await new ReminderService(new MemoryQueue()).send(reminder.id, today)

    assert.include(
      String(mails.mails.sent().map((m) => m.message)[0].nodeMailerMessage.subject),
      '[En retard]'
    )
  })
})

test.group('File de tâches (Redis)', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.teardown(() => mail.restore())

  test('le parcours met un rappel dans la file, le worker l’envoie, une fois', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const contract = await createSignedContract(org)
    await dueIn(org, contract.id, 7)
    const mails = mail.fake()
    const name = `reminders-test-${Date.now()}`
    const queue = new BullReminderQueue(name)
    const worker = startWorker(queue, name, 2)

    try {
      await new ReminderService(queue).scan(today)
      const reminder = await Reminder.firstOrFail()
      // Remettre deux fois le même rappel dans la file ne crée qu'une tâche.
      await queue.enqueue(reminder.id)
      await queue.enqueue(reminder.id)

      for (let i = 0; i < 100; i++) {
        if ((await Reminder.findOrFail(reminder.id)).status === 'sent') break
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      assert.equal((await Reminder.findOrFail(reminder.id)).status, 'sent')
      assert.lengthOf(
        mails.mails.sent().map((m) => m.message),
        1
      )
    } finally {
      await worker.close()
      await queue.queue.obliterate({ force: true })
      await queue.close()
    }
  })
})

test.group('Suivi par HTTP', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  const form = (org: Org, over: Record<string, string> = {}) => ({
    startsOn: '2026-11-01',
    endsOn: '2027-10-31',
    autoRenew: 'true',
    noticeDays: '60',
    renewalMonths: '12',
    assigneeId: String(org.manager.id),
    ...over,
  })

  test('un rédacteur définit la durée, le lecteur est refusé, la page montre le suivi', async ({
    client,
    assert,
  }) => {
    const org = await createOrganization()
    const contract = await createSignedContract(org)
    const post = (user: typeof org.member, body: object) =>
      client
        .post(`/contracts/${contract.id}/term`)
        .loginAs(user)
        .withCsrfToken()
        .accept('json')
        .redirects(0)
        .form(body)

    ;(await post(org.viewer, form(org))).assertStatus(403)
    ;(await post(org.member, form(org, { endsOn: '2026-10-01' }))).assertStatus(422)
    ;(await post(org.member, form(org, { noticeDays: '900' }))).assertStatus(422)
    assert.lengthOf(await ContractTerm.all(), 0)
    ;(await post(org.member, form(org))).assertStatus(302)

    const page = await client.get(`/contracts/${contract.id}`).loginAs(org.member).withInertia()
    assert.equal(page.inertiaProps.tracking.term.endsOn, '2027-10-31')
    assert.lengthOf(page.inertiaProps.tracking.obligations, 1)
    assert.isTrue(page.inertiaProps.can.manageTracking)
    assert.isFalse(page.inertiaProps.can.engageTerm)
    const manager = await client.get(`/contracts/${contract.id}`).loginAs(org.manager).withInertia()
    assert.isTrue(manager.inertiaProps.can.engageTerm)
    assert.isTrue(manager.inertiaProps.tracking.obligations[0].canComplete)
    assert.isFalse(page.inertiaProps.tracking.obligations[0].canComplete)
  })

  test('reconduire et terminer sont réservés à la direction', async ({ client, assert }) => {
    const org = await createOrganization()
    const contract = await signedWithTerm(org)
    const post = (user: typeof org.member, action: string) =>
      client
        .post(`/contracts/${contract.id}/term/${action}`)
        .loginAs(user)
        .withCsrfToken()
        .accept('json')
        .redirects(0)

    ;(await post(org.member, 'renew')).assertStatus(403)
    ;(await post(org.legal, 'terminate')).assertStatus(403)
    ;(await post(org.manager, 'renew')).assertStatus(302)
    assert.equal((await ContractTerm.firstOrFail()).endsOn.toISODate(), '2028-10-31')
    ;(await post(org.manager, 'terminate')).assertStatus(302)
    ;(await post(org.manager, 'renew')).assertStatus(409)
  })

  test('ajouter, clore et annuler une obligation par formulaire', async ({ client, assert }) => {
    const org = await createOrganization()
    const contract = await createSignedContract(org)
    const post = (user: typeof org.member, url: string, body: object = {}) =>
      client
        .post(`/contracts/${contract.id}${url}`)
        .loginAs(user)
        .withCsrfToken()
        .accept('json')
        .redirects(0)
        .form(body)

    ;(
      await post(org.member, '/obligations', {
        title: 'Payer le premier trimestre',
        kind: 'payment',
        dueOn: '2027-01-15',
        assigneeId: String(org.manager.id),
      })
    ).assertStatus(302)
    ;(
      await post(org.member, '/obligations', {
        title: 'Préavis forcé',
        kind: 'renewal_notice',
        dueOn: '2027-01-15',
        assigneeId: String(org.manager.id),
      })
    ).assertStatus(422)
    const obligation = await Obligation.firstOrFail()

    ;(await post(org.legal, `/obligations/${obligation.id}/complete`)).assertStatus(403)
    ;(await post(org.manager, `/obligations/${obligation.id}/complete`)).assertStatus(302)
    ;(await post(org.manager, `/obligations/${obligation.id}/complete`)).assertStatus(409)
    assert.equal((await Obligation.findOrFail(obligation.id)).status, 'done')
  })

  test('la page des échéances ne montre que les obligations ouvertes de l’organisation', async ({
    client,
    assert,
  }) => {
    const a = await createOrganization('Atelier A')
    const b = await createOrganization('Atelier B')
    const mine = await createSignedContract(a)
    const theirs = await createSignedContract(b)
    await dueIn(a, mine.id, 20, 'Ma livraison')
    await dueIn(a, mine.id, 3, 'Mon paiement')
    const closed = await dueIn(a, mine.id, 1, 'Déjà fait')
    await obligations.complete(a.organization.id, mine.id, closed.id, {
      id: a.manager.id,
      role: 'manager',
    })
    await dueIn(b, theirs.id, 2, 'Chez les autres')
    const titles = (page: { inertiaProps: Record<string, any> }) =>
      (page.inertiaProps.deadlines as { title: string }[]).map((d) => d.title)

    const all = await client.get('/deadlines').loginAs(a.member).withInertia()
    assert.deepEqual(titles(all), ['Mon paiement', 'Ma livraison'])
    assert.equal(all.inertiaProps.deadlines[0].daysLeft >= 0, true)

    const mineOnly = await client.get('/deadlines?mine=1').loginAs(a.member).withInertia()
    assert.deepEqual(titles(mineOnly), [])
    const manager = await client.get('/deadlines?mine=1').loginAs(a.manager).withInertia()
    assert.deepEqual(titles(manager), ['Mon paiement', 'Ma livraison'])

    // Hors session : renvoi à la connexion.
    ;(await client.get('/deadlines').redirects(0)).assertStatus(302)
    // Accès direct à une obligation d'une autre organisation : introuvable.
    const foreign = await Obligation.query().where('title', 'Chez les autres').firstOrFail()
    ;(
      await client
        .post(`/contracts/${mine.id}/obligations/${foreign.id}/complete`)
        .loginAs(a.manager)
        .withCsrfToken()
        .accept('json')
        .redirects(0)
    ).assertStatus(404)
    assert.equal((await Obligation.findOrFail(foreign.id)).status, 'open')
  })

  test('les contraintes de la base refusent les valeurs hors liste', async ({ assert }) => {
    const org = await createOrganization()
    const contract = await signedWithTerm(org)
    for (const sql of [
      `update obligations set status = 'perdue' where contract_id = ${contract.id}`,
      `update obligations set kind = 'autre-chose' where contract_id = ${contract.id}`,
      `update contract_terms set ends_on = starts_on where contract_id = ${contract.id}`,
      `update contract_terms set notice_days = 999 where contract_id = ${contract.id}`,
    ]) {
      try {
        await db.rawQuery(sql)
        assert.fail(`la base aurait dû refuser : ${sql}`)
      } catch (error) {
        assert.match((error as Error).message, /check|violates/i)
      }
    }
  })
})
