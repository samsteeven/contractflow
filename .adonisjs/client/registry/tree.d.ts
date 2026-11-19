/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  drive: {
    fs: {
      serve: typeof routes['drive.fs.serve']
    }
  }
  home: typeof routes['home']
  health: typeof routes['health']
  newAccount: {
    create: typeof routes['new_account.create']
    store: typeof routes['new_account.store']
  }
  session: {
    create: typeof routes['session.create']
    store: typeof routes['session.store']
    destroy: typeof routes['session.destroy']
  }
  webhooks: {
    signature: typeof routes['webhooks.signature']
  }
  sandbox: {
    show: typeof routes['sandbox.show']
    decide: typeof routes['sandbox.decide']
  }
  invitations: {
    show: typeof routes['invitations.show']
    accept: typeof routes['invitations.accept']
    store: typeof routes['invitations.store']
    revoke: typeof routes['invitations.revoke']
  }
  dashboard: typeof routes['dashboard']
  contracts: {
    index: typeof routes['contracts.index']
    create: typeof routes['contracts.create']
    store: typeof routes['contracts.store']
    show: typeof routes['contracts.show']
    revise: typeof routes['contracts.revise']
    submit: typeof routes['contracts.submit']
  }
  approvals: {
    decide: typeof routes['approvals.decide']
  }
  comments: {
    store: typeof routes['comments.store']
  }
  attachments: {
    store: typeof routes['attachments.store']
    show: typeof routes['attachments.show']
  }
  documents: {
    store: typeof routes['documents.store']
    show: typeof routes['documents.show']
  }
  signatures: {
    store: typeof routes['signatures.store']
    cancel: typeof routes['signatures.cancel']
    proof: typeof routes['signatures.proof']
  }
  terms: {
    store: typeof routes['terms.store']
    renew: typeof routes['terms.renew']
    terminate: typeof routes['terms.terminate']
  }
  obligations: {
    store: typeof routes['obligations.store']
    complete: typeof routes['obligations.complete']
    cancel: typeof routes['obligations.cancel']
  }
  deadlines: {
    index: typeof routes['deadlines.index']
  }
  templates: {
    index: typeof routes['templates.index']
    create: typeof routes['templates.create']
    store: typeof routes['templates.store']
  }
  workflows: {
    index: typeof routes['workflows.index']
    store: typeof routes['workflows.store']
  }
  members: {
    index: typeof routes['members.index']
    store: typeof routes['members.store']
  }
}
