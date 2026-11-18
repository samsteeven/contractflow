import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Invitation from '#models/invitation'
import { createOrganization } from '#tests/helpers'

const directive = (policy: string, name: string) =>
  policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `) || part === name)

test.group('En-têtes de sécurité', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('la politique de contenu n’autorise que l’application et des scripts à jeton', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/login')
    const policy = response.header('content-security-policy') as string

    assert.isString(policy)
    assert.equal(directive(policy, 'default-src'), "default-src 'self'")
    const scripts = directive(policy, 'script-src')!
    assert.match(scripts, /'nonce-[A-Za-z0-9+/=_-]{8,}'/)
    assert.notInclude(scripts, 'unsafe-inline')
    assert.notInclude(scripts, 'unsafe-eval')
    assert.notInclude(policy, '*')
    assert.equal(directive(policy, 'object-src'), "object-src 'none'")
    assert.equal(directive(policy, 'frame-ancestors'), "frame-ancestors 'none'")
    assert.equal(directive(policy, 'base-uri'), "base-uri 'self'")
    assert.equal(directive(policy, 'form-action'), "form-action 'self'")
  })

  test('chaque script exécutable porte le jeton de la réponse, et ce jeton change à chaque requête', async ({
    client,
    assert,
  }) => {
    const nonceOf = (policy: string) => /'nonce-([^']+)'/.exec(policy)![1]
    const first = await client.get('/login')
    const second = await client.get('/login')
    const nonce = nonceOf(first.header('content-security-policy') as string)

    assert.notEqual(nonce, nonceOf(second.header('content-security-policy') as string))
    const scripts = [...first.text().matchAll(/<script\b([^>]*)>/g)]
      .map((match) => match[1])
      .filter((attributes) => !/type="application\/json"/.test(attributes))
    assert.isAbove(scripts.length, 0)
    for (const attributes of scripts) {
      assert.include(attributes, `nonce="${nonce}"`)
    }
  })

  test('les autres en-têtes : cadre, type, origine, API du navigateur', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/login')

    assert.equal(response.header('x-frame-options'), 'DENY')
    assert.equal(response.header('x-content-type-options'), 'nosniff')
    assert.equal(response.header('referrer-policy'), 'same-origin')
    assert.include(response.header('permissions-policy') as string, 'camera=()')
    assert.equal(response.header('cross-origin-opener-policy'), 'same-origin')
  })

  test('les pages connectées et les erreurs portent aussi les en-têtes', async ({
    client,
    assert,
  }) => {
    const org = await createOrganization()
    const page = await client.get('/dashboard').loginAs(org.member)
    const missing = await client.get('/contracts/999999').loginAs(org.member).accept('json')

    for (const response of [page, missing]) {
      assert.include(response.header('content-security-policy') as string, 'script-src')
      assert.equal(response.header('referrer-policy'), 'same-origin')
    }
  })

  test('une requête sans jeton CSRF est refusée : rien n’est enregistré', async ({
    client,
    assert,
  }) => {
    const org = await createOrganization()
    const response = await client
      .post('/invitations')
      .loginAs(org.admin)
      .accept('json')
      .redirects(0)
      .form({ email: 'x@exemple.test', role: 'member' })

    assert.notEqual(response.status(), 200)
    assert.lengthOf(await Invitation.all(), 0)
  })
})
