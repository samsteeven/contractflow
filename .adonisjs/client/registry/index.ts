/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

export type { Route, Path } from './schema.d.ts'

const placeholder: any = {}

const routes = {
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
