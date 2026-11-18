import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type InvitationMail from '#mails/invitation_mail'
import AuditLog from '#models/audit_log'
import Invitation from '#models/invitation'
import Membership from '#models/membership'
import User from '#models/user'
import InvitationService, { hashToken, INVITATION_DAYS } from '#services/invitation_service'
import { assertViolation, createOrganization, createUser, PASSWORD } from '#tests/helpers'

const service = new InvitationService()

type Org = Awaited<ReturnType<typeof createOrganization>>

/** Envoie une invitation avec le courrier simulé et rend le jeton du lien. */
async function invite(
  org: Org,
  email = 'Nouvelle.Recrue@Exemple.test',
  role: 'member' | 'viewer' = 'member'
) {
  const mails = mail.fake()
  await service.invite(org.organization.id, { id: org.admin.id, role: 'admin' }, { email, role })
  const sent = mails.mails.sent() as InvitationMail[]
  const url = sent.at(-1)!.url
  return { token: url.split('/invitations/')[1], url, sent }
}

const accept = (
  token: string,
  password: string | null = 'un-mot-de-passe-solide',
  user: User | null = null
) => service.accept(token, { fullName: 'Nouvelle Recrue', password }, user)

test.group('Invitations : envoi', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.teardown(() => mail.restore())

  test('le lien part par e-mail, le jeton n’est jamais stocké, seule son empreinte l’est', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const { token, sent } = await invite(org)

    assert.lengthOf(sent, 1)
    assert.isAbove(token.length, 40)
    const row = await Invitation.firstOrFail()
    assert.equal(row.email, 'nouvelle.recrue@exemple.test')
    assert.equal(row.tokenHash, hashToken(token))
    // Aucune colonne ne contient le jeton lui-même.
    const dump = JSON.stringify(row.serialize())
    assert.notInclude(dump, token)
    assert.equal(row.expiresAt.diffNow('days').days > INVITATION_DAYS - 0.01, true)
    assert.lengthOf(await AuditLog.query().where('action', 'invitation.sent'), 1)
    const message = sent[0].message.nodeMailerMessage
    assert.include(String(message.text), token)
    assert.include(JSON.stringify(message.to), 'nouvelle.recrue@exemple.test')
  })

  test('le texte du courrier échappe le nom de l’organisation', async ({ assert }) => {
    const org = await createOrganization('<b>Piège</b> & Cie')
    const { sent } = await invite(org)

    const html = String(sent[0].message.nodeMailerMessage.html)
    assert.notInclude(html, '<b>Piège</b>')
    assert.include(html, '&lt;b&gt;Pi')
  })

  test('seul un propriétaire invite un administrateur ou un propriétaire', async ({ assert }) => {
    const org = await createOrganization()
    mail.fake()
    for (const role of ['admin', 'owner'] as const) {
      await assertViolation(
        assert,
        () =>
          service.invite(
            org.organization.id,
            { id: org.admin.id, role: 'admin' },
            { email: 'x@exemple.test', role }
          ),
        'role_not_grantable'
      )
    }
    await service.invite(
      org.organization.id,
      { id: org.owner.id, role: 'owner' },
      { email: 'x@exemple.test', role: 'admin' }
    )
    assert.equal((await Invitation.firstOrFail()).role, 'admin')
  })

  test('on n’invite pas un membre', async ({ assert }) => {
    const org = await createOrganization()
    mail.fake()

    await assertViolation(
      assert,
      () =>
        service.invite(
          org.organization.id,
          { id: org.admin.id, role: 'admin' },
          { email: org.member.email.toUpperCase(), role: 'viewer' }
        ),
      'already_member'
    )
    assert.lengthOf(await Invitation.all(), 0)
  })

  test('réinviter renvoie un nouveau lien et invalide l’ancien, sans doublon', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const first = await invite(org)
    const second = await invite(org, 'nouvelle.recrue@exemple.test', 'viewer')

    assert.notEqual(first.token, second.token)
    const rows = await Invitation.all()
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].role, 'viewer')
    await assertViolation(assert, () => accept(first.token), 'invitation_unknown')
    await accept(second.token)
    assert.equal(
      (await Membership.query().where('role', 'viewer').whereNot('user_id', org.viewer.id)).length,
      1
    )
  })

  test('deux invitations simultanées pour la même adresse n’en font qu’une', async ({ assert }) => {
    const org = await createOrganization()
    mail.fake()
    await Promise.all(
      [1, 2, 3].map(() =>
        service.invite(
          org.organization.id,
          { id: org.admin.id, role: 'admin' },
          { email: 'course@exemple.test', role: 'member' }
        )
      )
    )
    assert.lengthOf(await Invitation.all(), 1)
  })

  test('si l’e-mail ne part pas, l’invitation existe et se renvoie', async ({ assert }) => {
    const org = await createOrganization()
    const original = mail.send.bind(mail)
    mail.send = async () => {
      throw new Error('SMTP indisponible')
    }
    try {
      await assertViolation(
        assert,
        () =>
          service.invite(
            org.organization.id,
            { id: org.admin.id, role: 'admin' },
            { email: 'panne@exemple.test', role: 'member' }
          ),
        'mail_failed'
      )
    } finally {
      mail.send = original
    }
    assert.lengthOf(await Invitation.all(), 1)

    const { token } = await invite(org, 'panne@exemple.test')
    await accept(token)
    assert.isNotNull((await Invitation.firstOrFail()).acceptedAt)
  })

  test('retirer une invitation en coupe le lien, une autre organisation ne peut pas la retirer', async ({
    assert,
  }) => {
    const org = await createOrganization('Atelier A')
    const other = await createOrganization('Atelier B')
    const { token } = await invite(org)
    const row = await Invitation.firstOrFail()

    try {
      await service.revoke(other.organization.id, { id: other.admin.id }, row.id)
      assert.fail('aurait dû être refusé')
    } catch (error) {
      assert.equal((error as { code?: string }).code, 'E_ROW_NOT_FOUND')
    }
    assert.isNull((await Invitation.firstOrFail()).revokedAt)

    await service.revoke(org.organization.id, { id: org.admin.id }, row.id)
    await assertViolation(assert, () => accept(token), 'invitation_closed')
    await assertViolation(
      assert,
      () => service.revoke(org.organization.id, { id: org.admin.id }, row.id),
      'invitation_closed'
    )
    assert.lengthOf(await AuditLog.query().where('action', 'invitation.revoked'), 1)
  })

  test('la base refuse une adresse en majuscules et deux invitations ouvertes', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const base = {
      organization_id: org.organization.id,
      role: 'member',
      invited_by: org.admin.id,
      expires_at: DateTime.utc().plus({ days: 1 }).toSQL({ includeOffset: false }),
      created_at: DateTime.utc().toSQL({ includeOffset: false }),
    }
    await assert.rejects(() =>
      db
        .table('invitations')
        .insert({ ...base, email: 'Maj@Exemple.test', token_hash: 'a'.repeat(64) })
    )
    await db
      .table('invitations')
      .insert({ ...base, email: 'ok@exemple.test', token_hash: 'b'.repeat(64) })
    await assert.rejects(() =>
      db
        .table('invitations')
        .insert({ ...base, email: 'ok@exemple.test', token_hash: 'c'.repeat(64) })
    )
  })
})

test.group('Invitations : acceptation', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.teardown(() => mail.restore())

  test('une adresse sans compte crée son compte et rejoint l’organisation, une seule fois', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const { token } = await invite(org, 'nouvelle@exemple.test', 'viewer')

    const { user, organizationId } = await accept(token)

    assert.equal(user.email, 'nouvelle@exemple.test')
    assert.equal(organizationId, org.organization.id)
    const membership = await Membership.query().where('user_id', user.id).firstOrFail()
    assert.equal(membership.role, 'viewer')
    const row = await Invitation.firstOrFail()
    assert.isNotNull(row.acceptedAt)
    assert.equal(row.acceptedBy, user.id)
    assert.equal(
      (await AuditLog.query().where('action', 'member.added').where('actor_id', user.id)).length,
      1
    )
    assert.isTrue(
      await (
        await import('@adonisjs/core/services/hash')
      ).default.verify(user.password, 'un-mot-de-passe-solide')
    )

    await assertViolation(assert, () => accept(token), 'invitation_closed')
    assert.lengthOf(await User.query().where('email', 'nouvelle@exemple.test'), 1)
  })

  test('un compte nouveau exige un mot de passe, et rien n’est créé sans', async ({ assert }) => {
    const org = await createOrganization()
    const { token } = await invite(org, 'sans.mot@exemple.test')
    const before = (await User.all()).length

    await assertViolation(assert, () => accept(token, null), 'invitation_closed')

    assert.lengthOf(await User.all(), before)
    assert.isNull((await Invitation.firstOrFail()).acceptedAt)
  })

  test('deux acceptations simultanées : une retenue, une refusée, un seul compte', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const { token } = await invite(org, 'double@exemple.test')

    const results = await Promise.allSettled([accept(token), accept(token), accept(token)])

    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
    assert.lengthOf(await User.query().where('email', 'double@exemple.test'), 1)
    assert.lengthOf(
      await Membership.query()
        .whereNot('user_id', org.owner.id)
        .where('role', 'member')
        .where('organization_id', org.organization.id),
      2
    )
  })

  test('une invitation expirée ou inconnue ne donne rien', async ({ assert }) => {
    const org = await createOrganization()
    const { token } = await invite(org, 'tard@exemple.test')

    await assertViolation(
      assert,
      () =>
        service.accept(
          token,
          { fullName: null, password: 'un-mot-de-passe-solide' },
          null,
          DateTime.utc().plus({ days: INVITATION_DAYS + 1 })
        ),
      'invitation_closed'
    )
    await assertViolation(assert, () => accept('jeton-qui-n-existe-pas'), 'invitation_unknown')
    assert.lengthOf(await User.query().where('email', 'tard@exemple.test'), 0)
  })

  test('une adresse qui a déjà un compte doit se connecter : le mot de passe n’est pas écrasé', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const existing = await createUser('Déjà Inscrit')
    const { token } = await invite(org, existing.email)

    await assertViolation(assert, () => accept(token), 'account_exists')

    const reloaded = await User.findOrFail(existing.id)
    assert.equal(reloaded.password, existing.password)
    assert.lengthOf(await Membership.query().where('user_id', existing.id), 0)

    const result = await accept(token, null, existing)
    assert.equal(result.user.id, existing.id)
    assert.lengthOf(await Membership.query().where('user_id', existing.id), 1)
  })

  test('une personne connectée avec une autre adresse ne peut pas utiliser le lien', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const stranger = await createUser('Autre Personne')
    const { token } = await invite(org, 'visee@exemple.test')

    await assertViolation(assert, () => accept(token, null, stranger), 'invitation_wrong_account')

    assert.lengthOf(await Membership.query().where('user_id', stranger.id), 0)
    assert.isNull((await Invitation.firstOrFail()).acceptedAt)
  })

  test('l’aperçu d’un lien dit l’état sans rien révéler d’autre', async ({ assert }) => {
    const org = await createOrganization('Atelier Aperçu')
    const { token } = await invite(org, 'apercu@exemple.test', 'viewer')

    const open = await service.preview(token)
    assert.deepEqual(open, {
      state: 'open',
      email: 'apercu@exemple.test',
      role: 'viewer',
      organizationName: 'Atelier Aperçu',
      accountExists: false,
    })
    await accept(token)
    assert.equal((await service.preview(token)).state, 'accepted')
    await assertViolation(assert, () => service.preview('inconnu'), 'invitation_unknown')
  })
})

test.group('Invitations : HTTP', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.teardown(() => mail.restore())

  test('un administrateur invite, un lecteur et un rédacteur ne peuvent pas', async ({
    client,
    assert,
  }) => {
    const org = await createOrganization()
    mail.fake()
    const post = (user: User, body: object) =>
      client
        .post('/invitations')
        .loginAs(user)
        .withCsrfToken()
        .accept('json')
        .redirects(0)
        .form(body)

    ;(await post(org.viewer, { email: 'a@exemple.test', role: 'member' })).assertStatus(403)
    ;(await post(org.member, { email: 'a@exemple.test', role: 'member' })).assertStatus(403)
    ;(await post(org.admin, { email: 'pas-un-email', role: 'member' })).assertStatus(422)
    ;(await post(org.admin, { email: 'a@exemple.test', role: 'admin' })).assertStatus(403)
    assert.lengthOf(await Invitation.all(), 0)
    ;(await post(org.admin, { email: 'a@exemple.test', role: 'member' })).assertStatus(302)
    assert.lengthOf(await Invitation.all(), 1)
  })

  test('le lien s’ouvre sans session, un jeton inconnu répond 404', async ({ client, assert }) => {
    const org = await createOrganization()
    const { token } = await invite(org, 'page@exemple.test')

    const page = await client.get(`/invitations/${token}`).withInertia()
    page.assertStatus(200)
    page.assertInertiaComponent('invitations/show')
    assert.equal(page.inertiaProps.invitation.state, 'open')
    assert.equal(page.inertiaProps.invitation.email, 'page@exemple.test')

    const unknown = await client.get('/invitations/inconnu').accept('json')
    unknown.assertStatus(404)
  })

  test('accepter par le formulaire crée le compte, connecte et mène au tableau de bord', async ({
    client,
    assert,
  }) => {
    const org = await createOrganization()
    const { token } = await invite(org, 'forme@exemple.test')

    const bad = await client
      .post(`/invitations/${token}`)
      .withCsrfToken()
      .accept('json')
      .redirects(0)
      .form({ password: 'court', passwordConfirmation: 'court' })
    bad.assertStatus(422)
    assert.lengthOf(await User.query().where('email', 'forme@exemple.test'), 0)

    const mismatch = await client
      .post(`/invitations/${token}`)
      .withCsrfToken()
      .accept('json')
      .redirects(0)
      .form({ password: PASSWORD + '-un', passwordConfirmation: PASSWORD + '-deux' })
    mismatch.assertStatus(422)

    const ok = await client
      .post(`/invitations/${token}`)
      .withCsrfToken()
      .redirects(0)
      .form({
        fullName: 'Forme Test',
        password: PASSWORD + '-ok',
        passwordConfirmation: PASSWORD + '-ok',
      })
    ok.assertStatus(302)
    ok.assertHeader('location', '/dashboard')
    const user = await User.findByOrFail('email', 'forme@exemple.test')
    assert.equal(user.fullName, 'Forme Test')
    assert.lengthOf(await Membership.query().where('user_id', user.id), 1)
  })

  test('le formulaire d’acceptation ne laisse pas choisir l’adresse', async ({
    client,
    assert,
  }) => {
    const org = await createOrganization()
    const { token } = await invite(org, 'imposee@exemple.test')

    await client
      .post(`/invitations/${token}`)
      .withCsrfToken()
      .redirects(0)
      .form({
        email: 'pirate@exemple.test',
        fullName: 'X',
        password: PASSWORD + '-ok',
        passwordConfirmation: PASSWORD + '-ok',
      })

    assert.lengthOf(await User.query().where('email', 'pirate@exemple.test'), 0)
    assert.lengthOf(await User.query().where('email', 'imposee@exemple.test'), 1)
  })

  test('la page de l’équipe liste les invitations en attente pour un administrateur seulement', async ({
    client,
    assert,
  }) => {
    const org = await createOrganization()
    await invite(org, 'attente@exemple.test')

    const admin = await client.get('/members').loginAs(org.admin).withInertia()
    assert.deepEqual(
      admin.inertiaProps.invitations.map((i: { email: string }) => i.email),
      ['attente@exemple.test']
    )
    const viewer = await client.get('/members').loginAs(org.viewer).withInertia()
    assert.deepEqual(viewer.inertiaProps.invitations, [])
  })

  test('retirer par HTTP : réservé aux administrateurs de l’organisation', async ({
    client,
    assert,
  }) => {
    const a = await createOrganization('Atelier A')
    const b = await createOrganization('Atelier B')
    await invite(a, 'retrait@exemple.test')
    const row = await Invitation.firstOrFail()
    const revoke = (user: User) =>
      client
        .post(`/invitations/${row.id}/revoke`)
        .loginAs(user)
        .withCsrfToken()
        .accept('json')
        .redirects(0)

    ;(await revoke(a.member)).assertStatus(403)
    ;(await revoke(b.admin)).assertStatus(404)
    assert.isNull((await Invitation.firstOrFail()).revokedAt)
    ;(await revoke(a.admin)).assertStatus(302)
    assert.isNotNull((await Invitation.firstOrFail()).revokedAt)
  })
})
