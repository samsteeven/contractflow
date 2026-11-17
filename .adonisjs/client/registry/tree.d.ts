/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  drive: {
    fs: {
      serve: typeof routes['drive.fs.serve']
    }
  }
  home: typeof routes['home']
  newAccount: {
    create: typeof routes['new_account.create']
    store: typeof routes['new_account.store']
  }
  session: {
    create: typeof routes['session.create']
    store: typeof routes['session.store']
    destroy: typeof routes['session.destroy']
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
  documents: {
    store: typeof routes['documents.store']
    show: typeof routes['documents.show']
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
