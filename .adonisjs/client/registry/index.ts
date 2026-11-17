/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

export type { Route, Path } from './schema.d.ts'

const placeholder: any = {}

const routes = {
  'drive.fs.serve': {
    methods: ["GET","HEAD"],
    pattern: '/storage/*',
    tokens: [[0,"storage"],[2,"*"]],
    types: placeholder as Registry['drive.fs.serve']['types'],
  },
  'home': {
    methods: ["GET","HEAD"],
    pattern: '/',
    tokens: [[0,"/"]],
    types: placeholder as Registry['home']['types'],
  },
  'new_account.create': {
    methods: ["GET","HEAD"],
    pattern: '/signup',
    tokens: [[0,"signup"]],
    types: placeholder as Registry['new_account.create']['types'],
  },
  'new_account.store': {
    methods: ["POST"],
    pattern: '/signup',
    tokens: [[0,"signup"]],
    types: placeholder as Registry['new_account.store']['types'],
  },
  'session.create': {
    methods: ["GET","HEAD"],
    pattern: '/login',
    tokens: [[0,"login"]],
    types: placeholder as Registry['session.create']['types'],
  },
  'session.store': {
    methods: ["POST"],
    pattern: '/login',
    tokens: [[0,"login"]],
    types: placeholder as Registry['session.store']['types'],
  },
  'webhooks.signature': {
    methods: ["POST"],
    pattern: '/webhooks/signature',
    tokens: [[0,"webhooks"],[0,"signature"]],
    types: placeholder as Registry['webhooks.signature']['types'],
  },
  'sandbox.show': {
    methods: ["GET","HEAD"],
    pattern: '/sandbox/sign/:signerId',
    tokens: [[0,"sandbox"],[0,"sign"],[1,"signerId"]],
    types: placeholder as Registry['sandbox.show']['types'],
  },
  'sandbox.decide': {
    methods: ["POST"],
    pattern: '/sandbox/sign/:signerId',
    tokens: [[0,"sandbox"],[0,"sign"],[1,"signerId"]],
    types: placeholder as Registry['sandbox.decide']['types'],
  },
  'session.destroy': {
    methods: ["POST"],
    pattern: '/logout',
    tokens: [[0,"logout"]],
    types: placeholder as Registry['session.destroy']['types'],
  },
  'dashboard': {
    methods: ["GET","HEAD"],
    pattern: '/dashboard',
    tokens: [[0,"dashboard"]],
    types: placeholder as Registry['dashboard']['types'],
  },
  'contracts.index': {
    methods: ["GET","HEAD"],
    pattern: '/contracts',
    tokens: [[0,"contracts"]],
    types: placeholder as Registry['contracts.index']['types'],
  },
  'contracts.create': {
    methods: ["GET","HEAD"],
    pattern: '/contracts/new',
    tokens: [[0,"contracts"],[0,"new"]],
    types: placeholder as Registry['contracts.create']['types'],
  },
  'contracts.store': {
    methods: ["POST"],
    pattern: '/contracts',
    tokens: [[0,"contracts"]],
    types: placeholder as Registry['contracts.store']['types'],
  },
  'contracts.show': {
    methods: ["GET","HEAD"],
    pattern: '/contracts/:id',
    tokens: [[0,"contracts"],[1,"id"]],
    types: placeholder as Registry['contracts.show']['types'],
  },
  'contracts.revise': {
    methods: ["POST"],
    pattern: '/contracts/:id/versions',
    tokens: [[0,"contracts"],[1,"id"],[0,"versions"]],
    types: placeholder as Registry['contracts.revise']['types'],
  },
  'contracts.submit': {
    methods: ["POST"],
    pattern: '/contracts/:id/submissions',
    tokens: [[0,"contracts"],[1,"id"],[0,"submissions"]],
    types: placeholder as Registry['contracts.submit']['types'],
  },
  'approvals.decide': {
    methods: ["POST"],
    pattern: '/contracts/:id/approvals/:approvalId/decision',
    tokens: [[0,"contracts"],[1,"id"],[0,"approvals"],[1,"approvalId"],[0,"decision"]],
    types: placeholder as Registry['approvals.decide']['types'],
  },
  'comments.store': {
    methods: ["POST"],
    pattern: '/contracts/:id/comments',
    tokens: [[0,"contracts"],[1,"id"],[0,"comments"]],
    types: placeholder as Registry['comments.store']['types'],
  },
  'documents.store': {
    methods: ["POST"],
    pattern: '/contracts/:id/document',
    tokens: [[0,"contracts"],[1,"id"],[0,"document"]],
    types: placeholder as Registry['documents.store']['types'],
  },
  'documents.show': {
    methods: ["GET","HEAD"],
    pattern: '/contracts/:id/document',
    tokens: [[0,"contracts"],[1,"id"],[0,"document"]],
    types: placeholder as Registry['documents.show']['types'],
  },
  'signatures.store': {
    methods: ["POST"],
    pattern: '/contracts/:id/signature',
    tokens: [[0,"contracts"],[1,"id"],[0,"signature"]],
    types: placeholder as Registry['signatures.store']['types'],
  },
  'signatures.cancel': {
    methods: ["POST"],
    pattern: '/contracts/:id/signature/cancel',
    tokens: [[0,"contracts"],[1,"id"],[0,"signature"],[0,"cancel"]],
    types: placeholder as Registry['signatures.cancel']['types'],
  },
  'signatures.proof': {
    methods: ["GET","HEAD"],
    pattern: '/contracts/:id/signature/proof',
    tokens: [[0,"contracts"],[1,"id"],[0,"signature"],[0,"proof"]],
    types: placeholder as Registry['signatures.proof']['types'],
  },
  'terms.store': {
    methods: ["POST"],
    pattern: '/contracts/:id/term',
    tokens: [[0,"contracts"],[1,"id"],[0,"term"]],
    types: placeholder as Registry['terms.store']['types'],
  },
  'terms.renew': {
    methods: ["POST"],
    pattern: '/contracts/:id/term/renew',
    tokens: [[0,"contracts"],[1,"id"],[0,"term"],[0,"renew"]],
    types: placeholder as Registry['terms.renew']['types'],
  },
  'terms.terminate': {
    methods: ["POST"],
    pattern: '/contracts/:id/term/terminate',
    tokens: [[0,"contracts"],[1,"id"],[0,"term"],[0,"terminate"]],
    types: placeholder as Registry['terms.terminate']['types'],
  },
  'obligations.store': {
    methods: ["POST"],
    pattern: '/contracts/:id/obligations',
    tokens: [[0,"contracts"],[1,"id"],[0,"obligations"]],
    types: placeholder as Registry['obligations.store']['types'],
  },
  'obligations.complete': {
    methods: ["POST"],
    pattern: '/contracts/:id/obligations/:obligationId/complete',
    tokens: [[0,"contracts"],[1,"id"],[0,"obligations"],[1,"obligationId"],[0,"complete"]],
    types: placeholder as Registry['obligations.complete']['types'],
  },
  'obligations.cancel': {
    methods: ["POST"],
    pattern: '/contracts/:id/obligations/:obligationId/cancel',
    tokens: [[0,"contracts"],[1,"id"],[0,"obligations"],[1,"obligationId"],[0,"cancel"]],
    types: placeholder as Registry['obligations.cancel']['types'],
  },
  'deadlines.index': {
    methods: ["GET","HEAD"],
    pattern: '/deadlines',
    tokens: [[0,"deadlines"]],
    types: placeholder as Registry['deadlines.index']['types'],
  },
  'templates.index': {
    methods: ["GET","HEAD"],
    pattern: '/templates',
    tokens: [[0,"templates"]],
    types: placeholder as Registry['templates.index']['types'],
  },
  'templates.create': {
    methods: ["GET","HEAD"],
    pattern: '/templates/new',
    tokens: [[0,"templates"],[0,"new"]],
    types: placeholder as Registry['templates.create']['types'],
  },
  'templates.store': {
    methods: ["POST"],
    pattern: '/templates',
    tokens: [[0,"templates"]],
    types: placeholder as Registry['templates.store']['types'],
  },
  'workflows.index': {
    methods: ["GET","HEAD"],
    pattern: '/workflows',
    tokens: [[0,"workflows"]],
    types: placeholder as Registry['workflows.index']['types'],
  },
  'workflows.store': {
    methods: ["POST"],
    pattern: '/workflows',
    tokens: [[0,"workflows"]],
    types: placeholder as Registry['workflows.store']['types'],
  },
  'members.index': {
    methods: ["GET","HEAD"],
    pattern: '/members',
    tokens: [[0,"members"]],
    types: placeholder as Registry['members.index']['types'],
  },
  'members.store': {
    methods: ["POST"],
    pattern: '/members',
    tokens: [[0,"members"]],
    types: placeholder as Registry['members.store']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
