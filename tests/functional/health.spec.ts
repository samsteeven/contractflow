import { test } from '@japa/runner'

test.group('Sonde de santé', () => {
  test('répond ok sans session, avec la base joignable', async ({ client, assert }) => {
    const response = await client.get('/health')
    response.assertStatus(200)
    assert.deepEqual(response.body(), { status: 'ok' })
  })

  test('ne révèle aucune information sur l’installation', async ({ client, assert }) => {
    const response = await client.get('/health')
    assert.deepEqual(Object.keys(response.body()), ['status'])
  })
})
