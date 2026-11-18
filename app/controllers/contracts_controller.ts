import Approval from '#models/approval'
import AuditLog from '#models/audit_log'
import Comment from '#models/comment'
import Contract from '#models/contract'
import SignatureRequest from '#models/signature_request'
import SignatureProof from '#models/signature_proof'
import Attachment from '#models/attachment'
import ContractDocument from '#models/contract_document'
import ContractTerm from '#models/contract_term'
import Membership from '#models/membership'
import Obligation from '#models/obligation'
import ContractTemplate from '#models/contract_template'
import Workflow from '#models/workflow'
import { activeStep } from '#services/approval_service'
import ContractService from '#services/contract_service'
import { diffLines } from '#services/text_diff'
import { daysUntil } from '#services/reminder_service'
import { ADMIN_ROLES } from '#services/vocabulary'
import { signatureProvider } from '#services/signature_provider'
import {
  AUTHOR_ROLES,
  CONTRACT_STATUSES,
  SIGNATURE_ROLES,
  type ContractStatus,
} from '#services/vocabulary'
import ApprovalTransformer from '#transformers/approval_transformer'
import AuditLogTransformer from '#transformers/audit_log_transformer'
import CommentTransformer from '#transformers/comment_transformer'
import ContractTemplateTransformer from '#transformers/contract_template_transformer'
import ContractTransformer from '#transformers/contract_transformer'
import ContractVersionTransformer from '#transformers/contract_version_transformer'
import {
  createContractValidator,
  createFromTemplateValidator,
  reviseContractValidator,
  submitContractValidator,
} from '#validators/contract'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

@inject()
export default class ContractsController {
  constructor(protected contracts: ContractService) {}

  async index({ inertia, organization, membership, request }: HttpContext) {
    const requested = request.input('status')
    const status: ContractStatus | null = CONTRACT_STATUSES.includes(requested) ? requested : null

    const contracts = await Contract.query()
      .where('organization_id', organization.id)
      .if(status, (query) => query.where('status', status!))
      .orderBy('updated_at', 'desc')
      .limit(200)

    return inertia.render('contracts/index', {
      contracts: ContractTransformer.transform(contracts),
      status,
      canWrite: AUTHOR_ROLES.includes(membership.role),
    })
  }

  async create({ inertia, bouncer, membership, organization, request }: HttpContext) {
    await bouncer.with('ContractPolicy').authorize('write', membership)
    const templates = await ContractTemplate.query()
      .where('organization_id', organization.id)
      .orderBy('name')
    // Un modèle d'une autre organisation n'existe pas : on l'ignore, sans erreur.
    const selected = templates.find((template) => template.id === Number(request.input('template')))
    return inertia.render('contracts/create', {
      templates: ContractTemplateTransformer.transform(templates),
      selectedTemplateId: selected?.id ?? null,
    })
  }

  async store({
    request,
    response,
    session,
    bouncer,
    auth,
    organization,
    membership,
  }: HttpContext) {
    await bouncer.with('ContractPolicy').authorize('write', membership)
    const actorId = auth.getUserOrFail().id
    let contract
    if (request.input('templateId')) {
      const input = await request.validateUsing(createFromTemplateValidator)
      contract = await this.contracts.createFromTemplate(organization.id, actorId, {
        ...input,
        values: input.values ?? {},
      })
    } else {
      const input = await request.validateUsing(createContractValidator)
      contract = await this.contracts.create(organization.id, actorId, input)
    }

    session.flash('success', 'Contrat créé en brouillon.')
    return response.redirect().toRoute('contracts.show', { id: contract.id })
  }

  async show({ inertia, params, request, auth, organization, membership }: HttpContext) {
    const contract = await Contract.query()
      .where('id', params.id)
      .where('organization_id', organization.id)
      .preload('versions', (query) => query.preload('author'))
      .firstOrFail()

    const approvals = await Approval.query()
      .where('contract_id', contract.id)
      .preload('decider')
      .orderBy('round')
      .orderBy('position')
    const audit = await AuditLog.query()
      .where('organization_id', organization.id)
      .where('subject_type', 'contract')
      .where('subject_id', contract.id)
      .preload('actor')
      .orderBy('id', 'desc')
    const comments = await Comment.query()
      .where('contract_id', contract.id)
      .preload('author')
      .orderBy('id', 'desc')
    const document = await ContractDocument.query()
      .where('contract_id', contract.id)
      .orderBy('id', 'desc')
      .first()
    const attachments = await Attachment.query()
      .where('contract_id', contract.id)
      .preload('uploader')
      .orderBy('id')
    const signatureRequest = await SignatureRequest.query()
      .where('contract_id', contract.id)
      .preload('signers')
      .orderBy('id', 'desc')
      .first()
    const proof = signatureRequest
      ? await SignatureProof.query().where('signature_request_id', signatureRequest.id).first()
      : null
    const signed = contract.status === 'signed'
    const term = signed
      ? await ContractTerm.query().where('contract_id', contract.id).first()
      : null
    const obligations = signed
      ? await Obligation.query()
          .where('contract_id', contract.id)
          .preload('assignee')
          .orderByRaw("case status when 'open' then 0 else 1 end")
          .orderBy('due_on')
      : []
    const members = signed
      ? await Membership.query().where('organization_id', organization.id).preload('user')
      : []
    const today = DateTime.utc()
    const workflows = await Workflow.query()
      .where('organization_id', organization.id)
      .preload('steps')
      .orderBy('name')

    // Version affichée : la dernière par défaut, comparée à celle qui la précède.
    const latest = contract.versions[0]
    const selected =
      contract.versions.find((version) => version.number === Number(request.input('version'))) ??
      latest
    const previous = contract.versions.find((version) => version.number === selected.number - 1)

    const currentRound = approvals.filter((approval) => approval.round === contract.reviewRound)
    const active = contract.status === 'in_review' ? activeStep(currentRound) : null
    const user = auth.getUserOrFail()
    const canWrite = AUTHOR_ROLES.includes(membership.role)

    return inertia.render('contracts/show', {
      contract: ContractTransformer.transform(contract),
      versions: ContractVersionTransformer.transform(contract.versions),
      selectedVersion: selected.number,
      diff: previous ? diffLines(previous.body, selected.body) : null,
      approvals: ApprovalTransformer.transform(approvals),
      audit: AuditLogTransformer.transform(audit),
      comments: CommentTransformer.transform(comments),
      tracking: signed
        ? {
            term: term
              ? {
                  startsOn: term.startsOn.toISODate()!,
                  endsOn: term.endsOn.toISODate()!,
                  autoRenew: term.autoRenew,
                  noticeDays: term.noticeDays,
                  renewalMonths: term.renewalMonths,
                  status: term.status,
                }
              : null,
            obligations: obligations.map((obligation) => ({
              id: obligation.id,
              title: obligation.title,
              kind: obligation.kind,
              status: obligation.status,
              dueOn: obligation.dueOn.toISODate()!,
              daysLeft: daysUntil(obligation.dueOn, today),
              assignee: obligation.assignee.fullName ?? obligation.assignee.email,
              notes: obligation.notes,
              canComplete:
                obligation.status === 'open' &&
                (obligation.assigneeId === user.id || ADMIN_ROLES.includes(membership.role)),
              canCancel:
                obligation.status === 'open' &&
                (obligation.createdBy === user.id || ADMIN_ROLES.includes(membership.role)),
            })),
            members: members.map((member) => ({
              id: member.userId,
              name: member.user.fullName ?? member.user.email,
            })),
          }
        : null,
      signature: signatureRequest
        ? {
            status: signatureRequest.status,
            signers: signatureRequest.signers.map((signer) => ({
              id: signer.id,
              name: signer.name,
              email: signer.email,
              status: signer.status,
              signedAt: signer.signedAt?.toISO() ?? null,
              // Le bac à sable fournit une adresse de signature ; un prestataire réel l'enverrait par e-mail.
              signUrl:
                signatureRequest.status === 'pending' && signer.status === 'pending'
                  ? signatureProvider().signUrl(signer.externalId)
                  : null,
            })),
            hasProof: proof !== null,
          }
        : null,
      attachments: attachments.map((attachment) => ({
        id: attachment.id,
        filename: attachment.filename,
        sizeBytes: attachment.sizeBytes,
        uploader: attachment.uploader.fullName ?? attachment.uploader.email,
        createdAt: attachment.createdAt.toISO()!,
      })),
      document: document
        ? { versionId: document.contractVersionId, sizeBytes: document.sizeBytes }
        : null,
      workflows: workflows.map((workflow) => ({
        id: workflow.id,
        name: workflow.name,
        steps: workflow.steps.map((step) => `${step.name} (${step.approverRole})`),
      })),
      can: {
        revise: canWrite && !['in_review', 'signing', 'signed'].includes(contract.status),
        submit: canWrite && contract.status === 'draft',
        comment: canWrite,
        attach: canWrite && !['signing', 'signed'].includes(contract.status),
        manageTracking: canWrite && signed,
        engageTerm:
          SIGNATURE_ROLES.includes(membership.role) && signed && term?.status === 'active',
        requestSignature:
          SIGNATURE_ROLES.includes(membership.role) && contract.status === 'approved',
        cancelSignature: SIGNATURE_ROLES.includes(membership.role) && contract.status === 'signing',
        generateDocument:
          canWrite && contract.status === 'approved' && document?.contractVersionId !== latest.id,
        downloadDocument: document !== null,
        // L'étape que l'utilisateur peut traiter maintenant, s'il y en a une.
        decideApprovalId:
          active && active.approverRole === membership.role && latest.authorId !== user.id
            ? active.id
            : null,
      },
    })
  }

  async revise({
    request,
    response,
    session,
    params,
    bouncer,
    auth,
    organization,
    membership,
  }: HttpContext) {
    await bouncer.with('ContractPolicy').authorize('write', membership)
    const input = await request.validateUsing(reviseContractValidator)
    const version = await this.contracts.revise(
      organization.id,
      Number(params.id),
      auth.getUserOrFail().id,
      { body: input.body, changeNote: input.changeNote ?? null }
    )

    session.flash('success', `Version ${version.number} enregistrée.`)
    return response.redirect().toRoute('contracts.show', { id: params.id })
  }

  async submit({
    request,
    response,
    session,
    params,
    bouncer,
    auth,
    organization,
    membership,
  }: HttpContext) {
    await bouncer.with('ContractPolicy').authorize('write', membership)
    const { workflowId } = await request.validateUsing(submitContractValidator)
    await this.contracts.submit(
      organization.id,
      Number(params.id),
      auth.getUserOrFail().id,
      workflowId
    )

    session.flash('success', 'Contrat soumis à validation.')
    return response.redirect().toRoute('contracts.show', { id: params.id })
  }
}
