import { createServer, type Server, type Socket } from 'node:net'
import { createHash } from 'node:crypto'
import { crc32 } from 'node:zlib'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import AuditLog from '#models/audit_log'
import Attachment from '#models/attachment'
import AttachmentService, {
  MAX_ATTACHMENT_BYTES,
  sanitizeFilename,
} from '#services/attachment_service'
import {
  ClamAvScanner,
  ScannerUnavailable,
  type ScanResult,
  type VirusScanner,
} from '#services/virus_scanner'
import {
  assertViolation,
  createApprovedContract,
  createContract,
  createOrganization,
  createSignedContract,
} from '#tests/helpers'

/** La chaîne de test EICAR : inoffensive, reconnue par tous les antivirus comme un virus. */
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'

const pdf = (extra = 'contenu') => Buffer.from(`%PDF-1.4\n${extra}\n%%EOF`)
const png = () =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('données'),
  ])
const zip = () =>
  Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('word/document.xml')])

/** Une archive ZIP à entrées non compressées : de quoi faire un « .docx » qu'un antivirus ouvre. */
function storedZip(entries: Record<string, string>) {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name)
    const data = Buffer.from(content)
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)
    locals.push(local, nameBytes, data)
    centrals.push(central, nameBytes)
    offset += local.length + nameBytes.length + data.length
  }
  const directory = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(entries).length, 8)
  end.writeUInt16LE(Object.keys(entries).length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, directory, end])
}

/** Analyseur de test : reconnaît EICAR et note ce qu'on lui a fait analyser. */
class RecordingScanner implements VirusScanner {
  readonly name = 'test'
  calls = 0
  failWith: Error | null = null
  async scan(data: Buffer): Promise<ScanResult> {
    this.calls++
    if (this.failWith) throw this.failWith
    return data.includes(EICAR)
      ? { clean: false, signature: 'Eicar-Test-Signature' }
      : { clean: true }
  }
}

type Org = Awaited<ReturnType<typeof createOrganization>>

test.group('Analyseur ClamAV : protocole', (group) => {
  let server: Server | null = null
  const sockets: Socket[] = []
  group.each.teardown(async () => {
    sockets.forEach((socket) => socket.destroy())
    sockets.length = 0
    if (server) await new Promise((resolve) => server!.close(resolve))
    server = null
  })

  /** Un faux clamd : lit la commande et les blocs, vérifie le cadrage, répond avec `answer`. */
  function fakeClamd(answer: (received: Buffer) => string | null) {
    const received: Buffer[] = []
    const state = { command: '', blocks: 0, finished: false }
    return new Promise<{ port: number; state: typeof state; received: Buffer[] }>((resolve) => {
      server = createServer((socket) => {
        sockets.push(socket)
        let buffer = Buffer.alloc(0)
        let commandRead = false
        socket.on('data', (chunk: Buffer) => {
          buffer = Buffer.concat([buffer, chunk])
          if (!commandRead) {
            const end = buffer.indexOf(0)
            if (end === -1) return
            state.command = buffer.subarray(0, end).toString()
            buffer = buffer.subarray(end + 1)
            commandRead = true
          }
          while (buffer.length >= 4 && !state.finished) {
            const size = buffer.readUInt32BE(0)
            if (size === 0) {
              state.finished = true
              const reply = answer(Buffer.concat(received))
              if (reply !== null) socket.end(reply + '\0')
              return
            }
            if (buffer.length < 4 + size) return
            received.push(buffer.subarray(4, 4 + size))
            state.blocks++
            buffer = buffer.subarray(4 + size)
          }
        })
      }).listen(0, '127.0.0.1', () => {
        resolve({ port: (server!.address() as { port: number }).port, state, received })
      })
    })
  }

  test('un fichier sain, plus grand qu’un bloc, arrive entier et reçoit « OK »', async ({
    assert,
  }) => {
    const data = Buffer.alloc(200_000, 'a')
    const fake = await fakeClamd(() => 'stream: OK')

    const result = await new ClamAvScanner('127.0.0.1', fake.port).scan(data)

    assert.deepEqual(result, { clean: true })
    assert.equal(fake.state.command, 'zINSTREAM')
    assert.isAbove(fake.state.blocks, 1)
    assert.isTrue(fake.state.finished)
    assert.equal(
      createHash('sha256').update(Buffer.concat(fake.received)).digest('hex'),
      createHash('sha256').update(data).digest('hex')
    )
  })

  test('une réponse « FOUND » donne la signature', async ({ assert }) => {
    const fake = await fakeClamd((data) =>
      data.includes(EICAR) ? 'stream: Win.Test.EICAR_HDB-1 FOUND' : 'stream: OK'
    )

    const result = await new ClamAvScanner('127.0.0.1', fake.port).scan(Buffer.from(EICAR))

    assert.deepEqual(result, { clean: false, signature: 'Win.Test.EICAR_HDB-1' })
  })

  test('une panne ne vaut jamais un « sain » : réponse inattendue, erreur du démon, silence, refus', async ({
    assert,
  }) => {
    for (const reply of [
      'hello',
      'INSTREAM size limit exceeded. ERROR',
      'stream: OK extra FOUND?',
    ]) {
      const fake = await fakeClamd(() => reply)
      await assert.rejects(
        () => new ClamAvScanner('127.0.0.1', fake.port).scan(Buffer.from('x')),
        /Analyse antivirus impossible/
      )
      sockets.forEach((socket) => socket.destroy())
      await new Promise((resolve) => server!.close(resolve))
      server = null
    }

    const silent = await fakeClamd(() => null)
    try {
      await new ClamAvScanner('127.0.0.1', silent.port, 300).scan(Buffer.from('x'))
      assert.fail('aurait dû échouer')
    } catch (error) {
      assert.instanceOf(error, ScannerUnavailable)
      assert.include((error as Error).message, 'délai dépassé')
    }

    // Port fermé : on réserve un port libre puis on le libère.
    const probe = createServer()
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve))
    const closed = (probe.address() as { port: number }).port
    await new Promise((resolve) => probe.close(resolve))
    await assert.rejects(
      () => new ClamAvScanner('127.0.0.1', closed).scan(Buffer.from('x')),
      /Analyse antivirus impossible/
    )
  })

  test('un vrai clamd reconnaît EICAR et laisse passer un PDF sain', async ({ assert }) => {
    const scanner = new ClamAvScanner(process.env.CLAMAV_TEST_HOST!, 3310)

    const clean = await scanner.scan(pdf())
    const infected = await scanner.scan(Buffer.from(EICAR))

    assert.deepEqual(clean, { clean: true })
    assert.isFalse(infected.clean)
    assert.match((infected as { signature: string }).signature, /eicar/i)
  }).skip(!process.env.CLAMAV_TEST_HOST, 'CLAMAV_TEST_HOST absent : pas de clamd réel')

  test('un vrai clamd ouvre une archive : EICAR dans un .docx est trouvé', async ({ assert }) => {
    const scanner = new ClamAvScanner(process.env.CLAMAV_TEST_HOST!, 3310)
    const infected = storedZip({ 'word/document.xml': '<w:document/>', 'eicar.com': EICAR })
    const clean = storedZip({ 'word/document.xml': '<w:document/>' })

    assert.isFalse((await scanner.scan(infected)).clean)
    assert.isTrue((await scanner.scan(clean)).clean)
  }).skip(!process.env.CLAMAV_TEST_HOST, 'CLAMAV_TEST_HOST absent : pas de clamd réel')
})

test.group('Pièces jointes : service', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  const add = (
    org: Org,
    contractId: number,
    scanner: VirusScanner | null,
    name: string,
    data: Buffer
  ) =>
    new AttachmentService(scanner).add(org.organization.id, contractId, org.member.id, {
      name,
      data,
    })

  test('un fichier sain est analysé, stocké sous un nom aléatoire, et tracé', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const contract = await createContract(org.organization.id, org.member.id)
    const scanner = new RecordingScanner()
    const data = pdf('annexe tarifaire')

    const attachment = await add(org, contract.id, scanner, 'Annexe tarifaire.pdf', data)

    assert.equal(scanner.calls, 1)
    assert.equal(attachment.filename, 'Annexe tarifaire.pdf')
    assert.equal(attachment.contentType, 'application/pdf')
    assert.equal(attachment.sizeBytes, data.length)
    assert.equal(attachment.checksum, createHash('sha256').update(data).digest('hex'))
    assert.equal(attachment.scanner, 'test')
    assert.notInclude(attachment.storageKey, 'Annexe')
    assert.isTrue(await drive.use().exists(attachment.storageKey))
    assert.equal(
      Buffer.from(await drive.use().getBytes(attachment.storageKey)).toString(),
      data.toString()
    )
    assert.lengthOf(await AuditLog.query().where('action', 'attachment.added'), 1)
  })

  test('un fichier infecté n’est jamais stocké, et le refus est tracé avec la signature', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const contract = await createContract(org.organization.id, org.member.id)

    await assertViolation(
      assert,
      () => add(org, contract.id, new RecordingScanner(), 'facture.pdf', pdf(EICAR)),
      'file_infected'
    )

    assert.lengthOf(await Attachment.all(), 0)
    const [entry] = await AuditLog.query().where('action', 'attachment.rejected')
    assert.equal(entry.metadata.signature, 'Eicar-Test-Signature')
    assert.equal(entry.metadata.filename, 'facture.pdf')
    assert.lengthOf(await AuditLog.query().where('action', 'attachment.added'), 0)
  })

  test('un analyseur en panne ou absent refuse le fichier : on n’accepte jamais sans analyse', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const contract = await createContract(org.organization.id, org.member.id)
    const broken = new RecordingScanner()
    broken.failWith = new ScannerUnavailable('hors service')

    await assertViolation(
      assert,
      () => add(org, contract.id, broken, 'a.pdf', pdf()),
      'scanner_unavailable'
    )
    await assertViolation(
      assert,
      () => add(org, contract.id, null, 'a.pdf', pdf()),
      'scanner_unavailable'
    )

    assert.lengthOf(await Attachment.all(), 0)
  })

  test('seuls les types prévus passent, et le contenu doit correspondre à l’extension', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const contract = await createContract(org.organization.id, org.member.id)
    const scanner = new RecordingScanner()
    const refused: [string, Buffer][] = [
      ['programme.exe', Buffer.from('MZ\x90\x00')],
      ['page.html', Buffer.from('<script>alert(1)</script>')],
      ['faux.pdf', png()],
      ['faux.png', pdf()],
      ['sans-extension', pdf()],
      ['double.pdf.exe', pdf()],
      ['image.jpg', pdf()],
      ['faux.docx', pdf()],
    ]
    for (const [name, data] of refused) {
      await assertViolation(
        assert,
        () => add(org, contract.id, scanner, name, data),
        'file_type_not_allowed'
      )
    }
    assert.equal(scanner.calls, 0, 'rien n’est analysé tant que le type est refusé')

    for (const [name, data, type] of [
      ['a.PDF', pdf(), 'application/pdf'],
      ['b.png', png(), 'image/png'],
      ['c.docx', zip(), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      ['d.xlsx', zip(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ] as const) {
      assert.equal((await add(org, contract.id, scanner, name, data)).contentType, type)
    }
  })

  test('un fichier vide ou trop gros est refusé avant l’analyse', async ({ assert }) => {
    const org = await createOrganization()
    const contract = await createContract(org.organization.id, org.member.id)
    const scanner = new RecordingScanner()

    await assertViolation(
      assert,
      () => add(org, contract.id, scanner, 'a.pdf', Buffer.alloc(0)),
      'file_empty'
    )
    await assertViolation(
      assert,
      () => add(org, contract.id, scanner, 'a.pdf', Buffer.alloc(MAX_ATTACHMENT_BYTES + 1)),
      'file_too_large'
    )
    assert.equal(scanner.calls, 0)
  })

  test('le nom est nettoyé : pas de chemin, de guillemet ni de caractère de contrôle', async ({
    assert,
  }) => {
    assert.equal(sanitizeFilename('../../etc/passwd.pdf'), 'passwd.pdf')
    assert.equal(sanitizeFilename('C:\\Users\\moi\\annexe.pdf'), 'annexe.pdf')
    assert.equal(sanitizeFilename('a"b\u0000c\r\n.pdf'), 'abc.pdf')
    assert.equal(sanitizeFilename('   '), 'fichier')
    assert.isAtMost(sanitizeFilename('x'.repeat(500) + '.pdf').length, 200)
  })

  test('un contrat en signature ou signé n’accepte plus de pièce, sans même analyser', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const scanner = new RecordingScanner()
    const signed = await createSignedContract(org)
    const approved = await createApprovedContract(org)
    await db.from('contracts').where('id', approved.id).update({ status: 'signing' })

    await assertViolation(
      assert,
      () => add(org, signed.id, scanner, 'a.pdf', pdf()),
      'contract_signed'
    )
    await assertViolation(
      assert,
      () => add(org, approved.id, scanner, 'a.pdf', pdf()),
      'contract_in_signature'
    )

    assert.equal(scanner.calls, 0)
    assert.lengthOf(await Attachment.all(), 0)
  })

  test('le contrat d’une autre organisation est introuvable', async ({ assert }) => {
    const a = await createOrganization('Atelier A')
    const b = await createOrganization('Atelier B')
    const theirs = await createContract(b.organization.id, b.member.id)
    const scanner = new RecordingScanner()

    try {
      await add(a, theirs.id, scanner, 'a.pdf', pdf())
      assert.fail('aurait dû être refusé')
    } catch (error) {
      assert.equal((error as { code?: string }).code, 'E_ROW_NOT_FOUND')
    }
    assert.equal(scanner.calls, 0)
    assert.lengthOf(await Attachment.all(), 0)
  })

  test('une pièce jointe ne se modifie ni ne se supprime : la base refuse', async ({ assert }) => {
    const org = await createOrganization()
    const contract = await createContract(org.organization.id, org.member.id)
    const attachment = await add(org, contract.id, new RecordingScanner(), 'a.pdf', pdf())

    await assert.rejects(() =>
      db.from('attachments').where('id', attachment.id).update({ filename: 'autre.pdf' })
    )
    await assert.rejects(() => db.from('attachments').where('id', attachment.id).delete())
  })
})

test.group('Pièces jointes : vrai clamd', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('de bout en bout avec un vrai clamd : le .docx infecté n’est ni stocké ni listé', async ({
    assert,
  }) => {
    const org = await createOrganization()
    const contract = await createContract(org.organization.id, org.member.id)
    const service = new AttachmentService(new ClamAvScanner(process.env.CLAMAV_TEST_HOST!, 3310))
    const infected = storedZip({ 'word/document.xml': '<w:document/>', 'eicar.com': EICAR })

    await assertViolation(
      assert,
      () =>
        service.add(org.organization.id, contract.id, org.member.id, {
          name: 'contrat.docx',
          data: infected,
        }),
      'file_infected'
    )
    const saved = await service.add(org.organization.id, contract.id, org.member.id, {
      name: 'sain.docx',
      data: storedZip({ 'word/document.xml': '<w:document/>' }),
    })

    assert.equal(saved.scanner, 'clamav')
    assert.lengthOf(await Attachment.all(), 1)
    const [rejected] = await AuditLog.query().where('action', 'attachment.rejected')
    assert.match(String(rejected.metadata.signature), /eicar/i)
  }).skip(!process.env.CLAMAV_TEST_HOST, 'CLAMAV_TEST_HOST absent : pas de clamd réel')
})

test.group('Pièces jointes : HTTP', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  const scanner = new RecordingScanner()
  group.each.setup(() => {
    scanner.calls = 0
    scanner.failWith = null
    app.container.swap(AttachmentService, () => new AttachmentService(scanner))
    return () => app.container.restore(AttachmentService)
  })

  test('un rédacteur ajoute un fichier, la page le liste, le téléchargement est pré-signé', async ({
    client,
    assert,
  }) => {
    const org = await createOrganization()
    const contract = await createContract(org.organization.id, org.member.id)

    const response = await client
      .post(`/contracts/${contract.id}/attachments`)
      .loginAs(org.member)
      .withCsrfToken()
      .redirects(0)
      .file('file', pdf('via http'), { filename: 'annexe.pdf' })
    response.assertStatus(302)

    const page = await client.get(`/contracts/${contract.id}`).loginAs(org.viewer).withInertia()
    assert.deepEqual(
      page.inertiaProps.attachments.map((a: { filename: string }) => a.filename),
      ['annexe.pdf']
    )
    assert.isFalse(page.inertiaProps.can.attach)
    const writer = await client.get(`/contracts/${contract.id}`).loginAs(org.member).withInertia()
    assert.isTrue(writer.inertiaProps.can.attach)

    const attachment = await Attachment.firstOrFail()
    const download = await client
      .get(`/contracts/${contract.id}/attachments/${attachment.id}`)
      .loginAs(org.viewer)
      .redirects(0)
    download.assertStatus(302)
    assert.match(download.header('location') as string, /signature=/i)
  })

  test('un vrai .docx passe par le formulaire : le serveur ne se fie pas à l’extension détectée', async ({
    client,
    assert,
  }) => {
    const org = await createOrganization()
    const contract = await createContract(org.organization.id, org.member.id)

    const response = await client
      .post(`/contracts/${contract.id}/attachments`)
      .loginAs(org.member)
      .withCsrfToken()
      .accept('json')
      .redirects(0)
      .file('file', storedZip({ 'word/document.xml': '<w:document/>' }), {
        filename: 'contrat.docx',
      })

    response.assertStatus(302)
    assert.equal((await Attachment.firstOrFail()).filename, 'contrat.docx')
  })

  test('refus : lecteur, fichier infecté, type interdit, absence de fichier', async ({
    client,
    assert,
  }) => {
    const org = await createOrganization()
    const contract = await createContract(org.organization.id, org.member.id)
    const upload = (user: typeof org.member, data: Buffer | null, filename = 'a.pdf') => {
      const request = client
        .post(`/contracts/${contract.id}/attachments`)
        .loginAs(user)
        .withCsrfToken()
        .accept('json')
        .redirects(0)
      return data ? request.file('file', data, { filename }) : request.form({})
    }

    ;(await upload(org.viewer, pdf())).assertStatus(403)
    ;(await upload(org.member, pdf(EICAR))).assertStatus(422)
    ;(await upload(org.member, Buffer.from('MZ'), 'x.exe')).assertStatus(422)
    ;(await upload(org.member, null)).assertStatus(422)
    scanner.failWith = new ScannerUnavailable('hors service')
    ;(await upload(org.member, pdf())).assertStatus(503)

    assert.lengthOf(await Attachment.all(), 0)
  })

  test('le téléchargement d’une pièce d’une autre organisation répond 404', async ({
    client,
    assert,
  }) => {
    const a = await createOrganization('Atelier A')
    const b = await createOrganization('Atelier B')
    const contract = await createContract(b.organization.id, b.member.id)
    const attachment = await new AttachmentService(scanner).add(
      b.organization.id,
      contract.id,
      b.member.id,
      { name: 'secret.pdf', data: pdf() }
    )

    const response = await client
      .get(`/contracts/${contract.id}/attachments/${attachment.id}`)
      .loginAs(a.owner)
      .accept('json')
      .redirects(0)

    response.assertStatus(404)
    assert.isUndefined(response.header('location'))
  })
})
