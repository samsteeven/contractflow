import { createHash } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import drive from '@adonisjs/drive/services/main'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import AuditLog from '#models/audit_log'
import Comment from '#models/comment'
import Contract from '#models/contract'
import ContractDocument from '#models/contract_document'
import ContractTemplate from '#models/contract_template'
import CommentService from '#services/comment_service'
import ContractService from '#services/contract_service'
import DocumentService from '#services/document_service'
import TemplateService, { extractVariables, renderTemplate } from '#services/template_service'
import {
  assertViolation,
  BODY,
  createApprovedContract,
  createContract,
  createOrganization,
} from '#tests/helpers'

const TEMPLATE_BODY = [
  'Entre {{client}} et {{prestataire}},',
  'le prestataire intervient pour {{montant}} euros, à partir du {{date_debut}}.',
  '{{client}} règle sous trente jours.',
].join('\n')

const templates = new TemplateService()
const contracts = new ContractService()
const documents = new DocumentService()
const comments = new CommentService()

test.group('Modèles : variables', () => {
  test('les variables sont repérées dans l’ordre, une seule fois', ({ assert }) => {
    assert.deepEqual(extractVariables(TEMPLATE_BODY), [
      'client',
      'prestataire',
      'montant',
      'date_debut',
    ])
    assert.deepEqual(extractVariables('{{ client }} et {{client}}'), ['client'])
    assert.deepEqual(extractVariables('aucune variable ici'), [])
  })

  test('le rendu remplit chaque occurrence', ({ assert }) => {
    const text = renderTemplate(TEMPLATE_BODY, {
      client: 'Atelier Nova',
      prestataire: 'Nordwind SAS',
      montant: '48 000',
      date_debut: '1er janvier',
    })
    assert.include(text, 'Entre Atelier Nova et Nordwind SAS,')
    assert.include(text, 'Atelier Nova règle sous trente jours.')
    assert.notInclude(text, '{{')
  })

  test('une valeur qui ressemble à une variable est insérée telle quelle', ({ assert }) => {
    const text = renderTemplate('Pour {{client}} seulement.', { client: '{{montant}}' })
    assert.equal(text, 'Pour {{montant}} seulement.')
  })

  test('une variable sans valeur refuse le rendu et la nomme', async ({ assert }) => {
    await assertViolation(
      assert,
      async () => renderTemplate(TEMPLATE_BODY, { client: 'A', prestataire: ' ', montant: '1' }),
      'missing_variable'
    )
    try {
      renderTemplate(TEMPLATE_BODY, { client: 'A', prestataire: ' ', montant: '1' })
    } catch (error) {
      assert.include((error as Error).message, 'prestataire, date_debut')
    }
  })
})

test.group('Modèles : création', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('un modèle est enregistré avec sa trace', async ({ assert }) => {
    const { organization, member } = await createOrganization()

    const template = await templates.create(organization.id, member.id, {
      name: 'Prestation standard',
      type: 'service',
      body: TEMPLATE_BODY,
    })

    assert.equal(template.name, 'Prestation standard')
    const trace = await AuditLog.query().where('action', 'template.created').firstOrFail()
    assert.equal(trace.subjectId, template.id)
    assert.equal(trace.metadata.variables, 4)
  })

  test('une variable mal écrite est refusée', async ({ assert }) => {
    const { organization, member } = await createOrganization()

    for (const body of ['Pour {{ Client }} seulement', 'Date {{date-debut}}', 'Reste {{ ouverte']) {
      await assertViolation(
        assert,
        () => templates.create(organization.id, member.id, { name: 'Faute', type: 'nda', body }),
        'invalid_template'
      )
    }
    assert.lengthOf(await ContractTemplate.all(), 0)
  })

  test('deux modèles ne portent pas le même nom dans une organisation, mais deux organisations le peuvent', async ({
    assert,
  }) => {
    const a = await createOrganization('Atelier A')
    const b = await createOrganization('Atelier B')
    const input = { name: 'Standard', type: 'nda' as const, body: 'Texte {{partie}} confidentiel.' }

    await templates.create(a.organization.id, a.member.id, input)
    await assertViolation(
      assert,
      () => templates.create(a.organization.id, a.member.id, input),
      'template_name_taken'
    )
    await templates.create(b.organization.id, b.member.id, input)
  })

  test('un contrat créé depuis un modèle reprend son type et son texte rempli', async ({
    assert,
  }) => {
    const { organization, member } = await createOrganization()
    const template = await templates.create(organization.id, member.id, {
      name: 'Sous-traitance',
      type: 'subcontracting',
      body: TEMPLATE_BODY,
    })

    const contract = await contracts.createFromTemplate(organization.id, member.id, {
      templateId: template.id,
      title: 'Portail client',
      counterparty: 'Nordwind SAS',
      values: {
        client: 'Atelier Nova',
        prestataire: 'Nordwind SAS',
        montant: '48 000',
        date_debut: '1er janvier',
      },
    })

    assert.equal(contract.type, 'subcontracting')
    assert.equal(contract.templateId, template.id)
    const version = await contract.related('versions').query().firstOrFail()
    assert.include(version.body, 'pour 48 000 euros, à partir du 1er janvier.')
    assert.notInclude(version.body, '{{')
  })

  test('un modèle modifié ensuite ne change pas les contrats déjà créés', async ({ assert }) => {
    const { organization, member } = await createOrganization()
    const template = await templates.create(organization.id, member.id, {
      name: 'NDA',
      type: 'nda',
      body: 'Les parties {{partie}} gardent le secret.',
    })
    const contract = await contracts.createFromTemplate(organization.id, member.id, {
      templateId: template.id,
      title: 'NDA Nordwind',
      counterparty: 'Nordwind SAS',
      values: { partie: 'A et B' },
    })

    template.body = 'Texte entièrement différent {{partie}}.'
    await template.save()

    const version = await contract.related('versions').query().firstOrFail()
    assert.equal(version.body, 'Les parties A et B gardent le secret.')
  })

  test('le modèle d’une autre organisation est introuvable', async ({ assert }) => {
    const a = await createOrganization('Atelier A')
    const b = await createOrganization('Atelier B')
    const foreign = await templates.create(b.organization.id, b.member.id, {
      name: 'Secret',
      type: 'nda',
      body: 'Texte {{partie}} confidentiel.',
    })

    try {
      await contracts.createFromTemplate(a.organization.id, a.member.id, {
        templateId: foreign.id,
        title: 'Intrusion',
        counterparty: 'X',
        values: { partie: 'A' },
      })
      assert.fail('le modèle étranger aurait dû être refusé')
    } catch (error) {
      assert.equal((error as { code?: string }).code, 'E_ROW_NOT_FOUND')
    }
    assert.lengthOf(await Contract.all(), 0)
  })

  test('des valeurs manquantes ne laissent aucun contrat à moitié créé', async ({ assert }) => {
    const { organization, member } = await createOrganization()
    const template = await templates.create(organization.id, member.id, {
      name: 'Standard',
      type: 'service',
      body: TEMPLATE_BODY,
    })

    await assertViolation(
      assert,
      () =>
        contracts.createFromTemplate(organization.id, member.id, {
          templateId: template.id,
          title: 'Incomplet',
          counterparty: 'X',
          values: { client: 'A' },
        }),
      'missing_variable'
    )
    assert.lengthOf(await Contract.all(), 0)
  })
})

test.group('Modèles : pages', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('un rédacteur crée un modèle puis un contrat depuis ce modèle', async ({
    client,
    assert,
  }) => {
    const { member, organization } = await createOrganization()

    const created = await client
      .post('/templates')
      .loginAs(member)
      .withCsrfToken()
      .redirects(0)
      .form({ name: 'Prestation', type: 'service', body: TEMPLATE_BODY })
    created.assertStatus(302)
    const template = await ContractTemplate.query()
      .where('organization_id', organization.id)
      .firstOrFail()

    const form = await client
      .get(`/contracts/new?template=${template.id}`)
      .loginAs(member)
      .withInertia()
    assert.equal(form.inertiaProps.selectedTemplateId, template.id)
    assert.deepEqual(form.inertiaProps.templates[0].variables, [
      'client',
      'prestataire',
      'montant',
      'date_debut',
    ])

    const stored = await client
      .post('/contracts')
      .loginAs(member)
      .withCsrfToken()
      .redirects(0)
      .form({
        'templateId': template.id,
        'title': 'Portail client',
        'counterparty': 'Nordwind SAS',
        'values[client]': 'Atelier Nova',
        'values[prestataire]': 'Nordwind SAS',
        'values[montant]': '48 000',
        'values[date_debut]': '1er janvier',
      })
    stored.assertStatus(302)
    const contract = await Contract.firstOrFail()
    assert.equal(contract.templateId, template.id)
    const version = await contract.related('versions').query().firstOrFail()
    assert.include(version.body, 'Entre Atelier Nova et Nordwind SAS,')
  })

  test('le lecteur voit les modèles mais n’en crée pas', async ({ client }) => {
    const { viewer } = await createOrganization()

    ;(await client.get('/templates').loginAs(viewer)).assertStatus(200)
    ;(await client.get('/templates/new').loginAs(viewer).accept('json')).assertStatus(403)
    ;(
      await client
        .post('/templates')
        .loginAs(viewer)
        .withCsrfToken()
        .accept('json')
        .form({ name: 'Intrus', type: 'nda', body: 'Texte {{partie}} confidentiel.' })
    ).assertStatus(403)
  })

  test('la liste des modèles ne montre pas ceux d’une autre organisation', async ({
    client,
    assert,
  }) => {
    const a = await createOrganization('Atelier A')
    const b = await createOrganization('Atelier B')
    await templates.create(b.organization.id, b.member.id, {
      name: 'Secret B',
      type: 'nda',
      body: 'Texte {{partie}} confidentiel.',
    })

    const page = await client.get('/templates').loginAs(a.member).withInertia()
    assert.lengthOf(page.inertiaProps.templates, 0)
  })
})

test.group('Commentaires', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('un commentaire se rapporte à la version courante et laisse une trace', async ({
    assert,
  }) => {
    const { organization, member, legal } = await createOrganization()
    const contract = await createContract(organization.id, member.id)
    await contracts.revise(organization.id, contract.id, member.id, {
      body: BODY.replace('douze', 'vingt-quatre'),
      changeNote: null,
    })

    const comment = await comments.add(
      organization.id,
      contract.id,
      legal.id,
      '  Durée trop longue '
    )

    const latest = await contract.related('versions').query().firstOrFail()
    assert.equal(comment.contractVersionId, latest.id)
    assert.equal(comment.body, 'Durée trop longue')
    const trace = await AuditLog.query().where('action', 'comment.added').firstOrFail()
    assert.equal(trace.actorId, legal.id)
  })

  test('on ne commente pas le contrat d’une autre organisation', async ({ assert }) => {
    const a = await createOrganization('Atelier A')
    const b = await createOrganization('Atelier B')
    const contract = await createContract(b.organization.id, b.member.id)

    try {
      await comments.add(a.organization.id, contract.id, a.member.id, 'Bonjour')
      assert.fail('le commentaire aurait dû être refusé')
    } catch (error) {
      assert.equal((error as { code?: string }).code, 'E_ROW_NOT_FOUND')
    }
    assert.lengthOf(await Comment.all(), 0)
  })

  test('la base refuse de modifier ou de supprimer un commentaire', async ({ assert }) => {
    const { organization, member } = await createOrganization()
    const contract = await createContract(organization.id, member.id)
    const comment = await comments.add(organization.id, contract.id, member.id, 'À garder')

    for (const sql of [
      `update comments set body = 'réécrit' where id = ${comment.id}`,
      `delete from comments where id = ${comment.id}`,
    ]) {
      try {
        await db.rawQuery(sql)
        assert.fail('la base aurait dû refuser')
      } catch (error) {
        assert.include((error as Error).message, 'immuable')
      }
    }
  })

  test('par HTTP : le rédacteur commente, le lecteur est refusé, la page liste les commentaires', async ({
    client,
    assert,
  }) => {
    const { organization, member, viewer } = await createOrganization()
    const contract = await createContract(organization.id, member.id)

    const posted = await client
      .post(`/contracts/${contract.id}/comments`)
      .loginAs(member)
      .withCsrfToken()
      .redirects(0)
      .form({ body: 'Pouvez-vous préciser l’article 2 ?' })
    posted.assertStatus(302)
    ;(
      await client
        .post(`/contracts/${contract.id}/comments`)
        .loginAs(viewer)
        .withCsrfToken()
        .accept('json')
        .form({ body: 'Intrusion' })
    ).assertStatus(403)
    ;(
      await client
        .post(`/contracts/${contract.id}/comments`)
        .loginAs(member)
        .withCsrfToken()
        .accept('json')
        .form({ body: '   ' })
    ).assertStatus(422)

    const page = await client.get(`/contracts/${contract.id}`).loginAs(viewer).withInertia()
    assert.deepEqual(
      page.inertiaProps.comments.map((c: { body: string }) => c.body),
      ['Pouvez-vous préciser l’article 2 ?']
    )
    assert.isFalse(page.inertiaProps.can.comment)
  })
})

test.group('Documents PDF', (group) => {
  group.setup(() => rm(app.makePath('tmp/storage'), { recursive: true, force: true }))
  group.each.setup(() => testUtils.db().truncate())

  test('un contrat qui n’est pas approuvé n’a pas de PDF', async ({ assert }) => {
    const org = await createOrganization()
    const contract = await createContract(org.organization.id, org.member.id)

    await assertViolation(
      assert,
      () => documents.generate(org.organization.id, contract.id, org.member.id),
      'contract_not_approved'
    )
    assert.lengthOf(await ContractDocument.all(), 0)
  })

  test('le PDF d’un contrat approuvé est archivé avec son empreinte', async ({ assert }) => {
    const org = await createOrganization()
    const contract = await createApprovedContract(org)

    const document = await documents.generate(org.organization.id, contract.id, org.member.id)

    const stored = Buffer.from(await drive.use().getBytes(document.storageKey))
    assert.equal(stored.subarray(0, 5).toString(), '%PDF-')
    assert.equal(document.sizeBytes, stored.length)
    assert.equal(document.checksum, createHash('sha256').update(stored).digest('hex'))
    assert.equal(document.contentType, 'application/pdf')
    const version = await contract.related('versions').query().firstOrFail()
    assert.equal(document.contractVersionId, version.id)
    assert.include(document.storageKey, `organizations/${org.organization.id}/contracts/`)
    const trace = await AuditLog.query().where('action', 'document.generated').firstOrFail()
    assert.equal(trace.metadata.version, 1)
  })

  test('générer deux fois renvoie le même document, simultanément aussi', async ({ assert }) => {
    const org = await createOrganization()
    const contract = await createApprovedContract(org)

    const results = await Promise.all([
      documents.generate(org.organization.id, contract.id, org.member.id),
      documents.generate(org.organization.id, contract.id, org.member.id),
      documents.generate(org.organization.id, contract.id, org.member.id),
    ])
    const again = await documents.generate(org.organization.id, contract.id, org.member.id)

    assert.lengthOf(await ContractDocument.all(), 1)
    assert.isTrue(results.every((r) => r.id === again.id))
    assert.lengthOf(await AuditLog.query().where('action', 'document.generated'), 1)
  })

  test('réviser un contrat approuvé retire le droit au PDF jusqu’à une nouvelle approbation, l’ancien reste', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const contract = await createApprovedContract(org)
    const first = await documents.generate(org.organization.id, contract.id, org.member.id)

    await contracts.revise(org.organization.id, contract.id, org.member.id, {
      body: BODY.replace('douze', 'vingt-quatre'),
      changeNote: null,
    })
    await assertViolation(
      assert,
      () => documents.generate(org.organization.id, contract.id, org.member.id),
      'contract_not_approved'
    )

    assert.isTrue(await drive.use().exists(first.storageKey))
    assert.lengthOf(await ContractDocument.all(), 1)
  })

  test('le PDF d’une autre organisation est introuvable', async ({ assert }) => {
    const a = await createOrganization('Atelier A')
    const b = await createOrganization('Atelier B')
    const contract = await createApprovedContract(b)

    try {
      await documents.generate(a.organization.id, contract.id, a.member.id)
      assert.fail('la génération aurait dû être refusée')
    } catch (error) {
      assert.equal((error as { code?: string }).code, 'E_ROW_NOT_FOUND')
    }
    assert.lengthOf(await ContractDocument.all(), 0)
  })

  test('la base refuse de modifier ou de supprimer un document', async ({ assert }) => {
    const org = await createOrganization()
    const contract = await createApprovedContract(org)
    const document = await documents.generate(org.organization.id, contract.id, org.member.id)

    for (const sql of [
      `update contract_documents set checksum = repeat('0', 64) where id = ${document.id}`,
      `delete from contract_documents where id = ${document.id}`,
    ]) {
      try {
        await db.rawQuery(sql)
        assert.fail('la base aurait dû refuser')
      } catch (error) {
        assert.include((error as Error).message, 'immuable')
      }
    }
  })

  test('par HTTP : archiver, puis télécharger par une URL pré-signée qui sert le PDF', async ({
    client,
    assert,
  }) => {
    const org = await createOrganization()
    const contract = await createApprovedContract(org)

    const page = await client.get(`/contracts/${contract.id}`).loginAs(org.member).withInertia()
    assert.isTrue(page.inertiaProps.can.generateDocument)
    assert.isFalse(page.inertiaProps.can.downloadDocument)
    ;(
      await client.get(`/contracts/${contract.id}/document`).loginAs(org.member).redirects(0)
    ).assertStatus(404)

    ;(
      await client
        .post(`/contracts/${contract.id}/document`)
        .loginAs(org.viewer)
        .withCsrfToken()
        .accept('json')
    ).assertStatus(403)
    ;(
      await client
        .post(`/contracts/${contract.id}/document`)
        .loginAs(org.member)
        .withCsrfToken()
        .redirects(0)
    ).assertStatus(302)

    const after = await client.get(`/contracts/${contract.id}`).loginAs(org.viewer).withInertia()
    assert.isFalse(after.inertiaProps.can.generateDocument)
    assert.isTrue(after.inertiaProps.can.downloadDocument)

    const redirect = await client
      .get(`/contracts/${contract.id}/document`)
      .loginAs(org.viewer)
      .redirects(0)
    redirect.assertStatus(302)
    const location = redirect.header('location') as string
    assert.match(location, /signature=/i)

    const file = await client.get(location)
    file.assertStatus(200)
    assert.equal(file.header('content-type'), 'application/pdf')
    assert.include(
      file.header('content-disposition') as string,
      'attachment; filename="maintenance-du-portail-client-v1.pdf"'
    )
    const archived = await ContractDocument.firstOrFail()
    assert.equal(Number(file.header('content-length')), archived.sizeBytes)

    // Sans signature valide, le fichier ne se sert pas. S3Mock (local) ne vérifie pas les
    // signatures, AWS le fait : on ne contrôle donc ce refus que sur le disque local.
    if (env.get('DRIVE_DISK') === 'fs') {
      const unsigned = await client.get(location.split('?')[0])
      assert.isAtLeast(unsigned.status(), 400)
    }
  })

  test('un membre d’une autre organisation ne télécharge pas le PDF', async ({ client }) => {
    const a = await createOrganization('Atelier A')
    const b = await createOrganization('Atelier B')
    const contract = await createApprovedContract(b)
    await documents.generate(b.organization.id, contract.id, b.member.id)

    ;(
      await client.get(`/contracts/${contract.id}/document`).loginAs(a.owner).redirects(0)
    ).assertStatus(404)
  })
})
