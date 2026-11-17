import type Comment from '#models/comment'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class CommentTransformer extends BaseTransformer<Comment> {
  toObject() {
    const author = this.resource.author
    return {
      ...this.pick(this.resource, ['id', 'body', 'contractVersionId', 'createdAt']),
      author: author ? (author.fullName ?? author.email) : null,
    }
  }
}
