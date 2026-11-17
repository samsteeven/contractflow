import Approval from '#models/approval'
import Contract from '#models/contract'
import { CONTRACT_STATUSES } from '#services/vocabulary'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class DashboardController {
  async show({ inertia, auth, organization, membership }: HttpContext) {
    const rows = await db
      .from('contracts')
      .where('organization_id', organization.id)
      .groupBy('status')
      .select('status')
      .count('* as total')
    const counts = Object.fromEntries(CONTRACT_STATUSES.map((status) => [status, 0]))
    for (const row of rows) counts[row.status] = Number(row.total)

    /**
     * « À valider par moi » : les contrats en validation dont l'étape active attend mon rôle.
     * L'étape active d'un tour est sa première étape en attente ; les versions que j'ai rédigées
     * sont exclues, je ne peux pas les valider.
     */
    const user = auth.getUserOrFail()
    const waiting = await Approval.query()
      .join('contracts', 'contracts.id', 'approvals.contract_id')
      .join('contract_versions', 'contract_versions.id', 'approvals.contract_version_id')
      .where('contracts.organization_id', organization.id)
      .where('contracts.status', 'in_review')
      .whereRaw('approvals.round = contracts.review_round')
      .where('approvals.status', 'pending')
      .where('approvals.approver_role', membership.role)
      .whereNot('contract_versions.author_id', user.id)
      .whereNotExists((earlier) =>
        earlier
          .from('approvals as earlier')
          .whereRaw('earlier.contract_id = approvals.contract_id')
          .whereRaw('earlier.round = approvals.round')
          .whereRaw('earlier.position < approvals.position')
          .where('earlier.status', 'pending')
      )
      .select('approvals.*')
      .orderBy('approvals.created_at')

    const contracts = await Contract.query().whereIn(
      'id',
      waiting.map((approval) => approval.contractId)
    )
    const titles = new Map(contracts.map((contract) => [contract.id, contract]))

    return inertia.render('dashboard', {
      counts,
      waiting: waiting.map((approval) => ({
        contractId: approval.contractId,
        title: titles.get(approval.contractId)!.title,
        counterparty: titles.get(approval.contractId)!.counterparty,
        stepName: approval.stepName,
      })),
    })
  }
}
