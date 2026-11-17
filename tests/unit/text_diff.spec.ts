import { test } from '@japa/runner'
import { diffLines } from '#services/text_diff'
import { checksumOf, normalizeBody } from '#services/contract_service'

test.group('Différence entre deux versions', () => {
  test('une ligne modifiée apparaît retirée puis ajoutée, le reste inchangé', ({ assert }) => {
    const before = 'Article 1\nDurée : 12 mois\nArticle 2'
    const after = 'Article 1\nDurée : 24 mois\nArticle 2'

    assert.deepEqual(diffLines(before, after), [
      { kind: 'same', text: 'Article 1' },
      { kind: 'removed', text: 'Durée : 12 mois' },
      { kind: 'added', text: 'Durée : 24 mois' },
      { kind: 'same', text: 'Article 2' },
    ])
  })

  test('ajout en fin, suppression au début', ({ assert }) => {
    assert.deepEqual(diffLines('a\nb', 'b\nc'), [
      { kind: 'removed', text: 'a' },
      { kind: 'same', text: 'b' },
      { kind: 'added', text: 'c' },
    ])
  })

  test('textes identiques ou vides', ({ assert }) => {
    assert.deepEqual(diffLines('a', 'a'), [{ kind: 'same', text: 'a' }])
    assert.deepEqual(diffLines('', 'a'), [{ kind: 'added', text: 'a' }])
    assert.deepEqual(diffLines('', ''), [])
  })

  test('appliquer la différence redonne chaque texte', ({ assert }) => {
    const before = 'un\ndeux\ntrois\nquatre\ncinq'
    const after = 'zéro\nun\ntrois\nquatre bis\ncinq\nsix'
    const diff = diffLines(before, after)

    const rebuilt = (kept: 'removed' | 'added') =>
      diff
        .filter((line) => line.kind === 'same' || line.kind === kept)
        .map((line) => line.text)
        .join('\n')
    assert.equal(rebuilt('removed'), before)
    assert.equal(rebuilt('added'), after)
  })
})

test.group('Empreinte du texte', () => {
  test('fins de ligne et espaces finaux ne changent pas le texte', ({ assert }) => {
    assert.equal(normalizeBody('a\r\nb\r\n  \n'), 'a\nb')
    assert.equal(checksumOf('a\r\nb\n\n'), checksumOf('a\nb'))
    assert.notEqual(checksumOf('a\nb'), checksumOf('a\nB'))
    assert.lengthOf(checksumOf('a'), 64)
  })
})
