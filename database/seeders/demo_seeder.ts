import Approval from '#models/approval'
import SignatureRequest from '#models/signature_request'
import Membership from '#models/membership'
import User from '#models/user'
import ApprovalService from '#services/approval_service'
import CommentService from '#services/comment_service'
import ContractService from '#services/contract_service'
import DocumentService from '#services/document_service'
import OrganizationService from '#services/organization_service'
import type { Role } from '#services/vocabulary'
import { SandboxSignatureProvider } from '#services/signature_provider'
import SignatureService from '#services/signature_service'
import SignatureWebhookService from '#services/signature_webhook_service'
import TemplateService from '#services/template_service'
import WorkflowService from '#services/workflow_service'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

/**
 * Organisation de démonstration « Atelier Nova » : un compte par rôle (mot de passe commun,
 * voir README), deux circuits et des contrats dans chaque état.
 * Lancement : node ace db:seed --files database/seeders/demo_seeder.ts
 */
export const DEMO_PASSWORD = 'contractflow-demo'

const SERVICE = [
  'Article 1 - Objet',
  'Le prestataire assure la maintenance applicative du portail client.',
  'Article 2 - Durée',
  'Le contrat est conclu pour douze mois à compter de sa signature.',
  'Article 3 - Prix',
  'Le prix forfaitaire est de 48 000 euros hors taxes, payable par trimestre.',
  'Article 4 - Niveau de service',
  'Les incidents bloquants sont pris en charge sous quatre heures ouvrées.',
].join('\n')

const NDA = [
  'Article 1 - Informations confidentielles',
  'Toute information technique ou commerciale échangée dans le cadre du projet.',
  'Article 2 - Durée',
  'Les obligations de confidentialité courent cinq ans après la fin des échanges.',
].join('\n')

const SUPPLY = [
  'Article 1 - Objet',
  'Fourniture de 400 postes de travail reconditionnés.',
  'Article 2 - Livraison',
  'Livraison en deux lots, sous trente jours après commande.',
  'Article 3 - Garantie',
  'Garantie de douze mois sur pièces et main-d’œuvre.',
].join('\n')

export default class extends BaseSeeder {
  async run() {
    const people: Record<Role, User> = {} as Record<Role, User>
    const names: Record<Role, string> = {
      owner: 'Olivia Martin',
      admin: 'Adrien Petit',
      legal: 'Léa Moreau',
      manager: 'Marc Lefèvre',
      member: 'Rémi Garnier',
      viewer: 'Vera Lambert',
    }
    for (const [role, fullName] of Object.entries(names) as [Role, string][]) {
      const email = `${fullName.split(' ')[0].normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()}@atelier-nova.test`
      people[role] = await User.updateOrCreate({ email }, { fullName, password: DEMO_PASSWORD })
    }
    if (await Membership.findBy('user_id', people.owner.id)) return // déjà en place

    const organization = await db.transaction((trx) =>
      new OrganizationService().createWithOwner(trx, people.owner, 'Atelier Nova')
    )
    for (const role of ['admin', 'legal', 'manager', 'member', 'viewer'] as const) {
      await Membership.create({ organizationId: organization.id, userId: people[role].id, role })
    }

    const workflows = new WorkflowService()
    const standard = await workflows.create(organization.id, people.owner.id, {
      name: 'Juridique puis direction',
      steps: [
        { name: 'Revue juridique', approverRole: 'legal' },
        { name: 'Accord de la direction', approverRole: 'manager' },
      ],
    })
    await workflows.create(organization.id, people.owner.id, {
      name: 'Engagement important',
      steps: [
        { name: 'Revue juridique', approverRole: 'legal' },
        { name: 'Accord de la direction', approverRole: 'manager' },
        { name: 'Signature du propriétaire', approverRole: 'owner' },
      ],
    })

    const contracts = new ContractService()
    const approvals = new ApprovalService()
    const org = organization.id
    const decide = async (
      contractId: number,
      role: Role,
      decision: 'approve' | 'reject',
      comment: string | null = null
    ) => {
      const step = await Approval.query()
        .where('contract_id', contractId)
        .where('status', 'pending')
        .orderBy('round', 'desc')
        .orderBy('position')
        .firstOrFail()
      await approvals.decide({
        organizationId: org,
        contractId,
        approvalId: step.id,
        actor: { id: people[role].id, role },
        decision,
        comment,
      })
    }

    // Approuvé, après une révision demandée par le juridique.
    const maintenance = await contracts.create(org, people.member.id, {
      title: 'Maintenance du portail client',
      counterparty: 'Nordwind SAS',
      type: 'service',
      body: SERVICE,
    })
    await contracts.submit(org, maintenance.id, people.member.id, standard.id)
    await decide(maintenance.id, 'legal', 'reject', 'La durée doit couvrir deux exercices.')
    await contracts.revise(org, maintenance.id, people.member.id, {
      body: SERVICE.replace('douze mois', 'vingt-quatre mois'),
      changeNote: 'Durée portée à vingt-quatre mois',
    })
    await contracts.submit(org, maintenance.id, people.member.id, standard.id)
    await decide(maintenance.id, 'legal', 'approve', 'Clauses conformes.')
    await decide(maintenance.id, 'manager', 'approve')

    // En validation : le juridique a validé, la direction doit se prononcer.
    const supply = await contracts.create(org, people.member.id, {
      title: 'Fourniture de postes de travail',
      counterparty: 'Recyclo Pro',
      type: 'supplier',
      body: SUPPLY,
    })
    await contracts.submit(org, supply.id, people.member.id, standard.id)
    await decide(supply.id, 'legal', 'approve', 'Garantie conforme à notre politique achats.')

    // En validation, en attente du juridique.
    const nda = await contracts.create(org, people.member.id, {
      title: 'Accord de confidentialité, projet Orion',
      counterparty: 'Helio Labs',
      type: 'nda',
      body: NDA,
    })
    await contracts.submit(org, nda.id, people.member.id, standard.id)

    // Commentaires et PDF archivé du contrat approuvé.
    const comments = new CommentService()
    await comments.add(
      org,
      supply.id,
      people.legal.id,
      'Garantie de 24 mois : conforme à la politique achats.'
    )
    await comments.add(
      org,
      nda.id,
      people.member.id,
      'Helio Labs demande de ramener la durée à trois ans.'
    )
    await new DocumentService().generate(org, maintenance.id, people.member.id)

    // Signature en cours : deux signataires, Alice a signé, Bob n'a pas encore répondu.
    const provider = new SandboxSignatureProvider()
    await new SignatureService(provider).request(org, maintenance.id, people.manager.id, [
      { name: 'Alice Martin', email: 'alice.martin@nordwind.test' },
      { name: 'Bob Durand', email: 'bob.durand@atelier-nova.test' },
    ])
    const request = await SignatureRequest.query()
      .where('contract_id', maintenance.id)
      .preload('signers')
      .firstOrFail()
    const { rawBody, header } = provider.buildEvent({
      type: 'signer.signed',
      requestId: request.externalId,
      signerId: request.signers[0].externalId,
    })
    await new SignatureWebhookService().handle(rawBody, header)

    // Modèles : deux textes à variables, dont l'un sert à créer un brouillon.
    const templates = new TemplateService()
    const service = await templates.create(org, people.admin.id, {
      name: 'Prestation de services standard',
      type: 'service',
      body: [
        'Article 1 - Objet',
        '{{prestataire}} réalise pour {{client}} la mission suivante : {{mission}}.',
        'Article 2 - Prix',
        'Le prix est de {{montant}} euros hors taxes.',
        'Article 3 - Durée',
        'Le contrat débute le {{date_debut}} pour une durée de {{duree}}.',
      ].join('\n'),
    })
    await templates.create(org, people.admin.id, {
      name: 'Confidentialité réciproque',
      type: 'nda',
      body: [
        'Article 1 - Objet',
        '{{partie_a}} et {{partie_b}} gardent confidentielles les informations échangées pendant {{duree}}.',
      ].join('\n'),
    })
    await contracts.createFromTemplate(org, people.member.id, {
      templateId: service.id,
      title: 'Refonte du site vitrine',
      counterparty: 'Studio Pixel',
      values: {
        prestataire: 'Studio Pixel',
        client: 'Atelier Nova',
        mission: 'la refonte du site vitrine',
        montant: '18 500',
        date_debut: '1er février',
        duree: 'six mois',
      },
    })

    // Brouillon.
    await contracts.create(org, people.member.id, {
      title: 'Partenariat de distribution',
      counterparty: 'Vela Retail',
      type: 'partnership',
      body: 'Article 1 - Objet\nDistribution des offres d’Atelier Nova sur le réseau Vela Retail.',
    })
  }
}
