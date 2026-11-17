import Comment from '#models/comment'
import { recordAudit } from '#services/audit'
import { latestVersion, lockContract } from '#services/contract_service'
import db from '@adonisjs/lucid/services/db'

export default class CommentService {
  /** Le commentaire se rapporte à la version courante, celle que l'auteur a sous les yeux. */
  async add(organizationId: number, contractId: number, authorId: number, body: string) {
    return db.transaction(async (trx) => {
      const contract = await lockContract(trx, organizationId, contractId)
      const version = await latestVersion(trx, contract.id)
      const comment = await Comment.create(
        { contractId: contract.id, contractVersionId: version.id, authorId, body: body.trim() },
        { client: trx }
      )
      await recordAudit(trx, {
        organizationId,
        actorId: authorId,
        action: 'comment.added',
        subject: { type: 'contract', id: contract.id },
        metadata: { version: version.number },
      })
      return comment
    })
  }
}
