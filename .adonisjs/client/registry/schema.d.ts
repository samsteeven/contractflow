/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractRawResponse, ExtractResponse, Method, PathWithRegistry, PatternsByMethod, RouteWithRegistry } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'
import type { routes } from './index.ts'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'drive.fs.serve': {
    methods: ["GET","HEAD"]
    pattern: '/storage/*'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { '*': ParamValue[] }
      query: {}
      response: unknown
      errorResponse: unknown
      rawResponse: ExtractRawResponse<unknown>
    }
  }
  'home': {
    methods: ["GET","HEAD"]
    pattern: '/'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
      rawResponse: ExtractRawResponse<unknown>
    }
  }
  'new_account.create': {
    methods: ["GET","HEAD"]
    pattern: '/signup'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['create']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['create']>>>
    }
  }
  'new_account.store': {
    methods: ["POST"]
    pattern: '/signup'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').signupValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').signupValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'session.create': {
    methods: ["GET","HEAD"]
    pattern: '/login'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['create']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/session_controller').default['create']>>>
    }
  }
  'session.store': {
    methods: ["POST"]
    pattern: '/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').loginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').loginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/session_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'webhooks.signature': {
    methods: ["POST"]
    pattern: '/webhooks/signature'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/webhooks_controller').default['signature']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/webhooks_controller').default['signature']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/webhooks_controller').default['signature']>>>
    }
  }
  'sandbox.show': {
    methods: ["GET","HEAD"]
    pattern: '/sandbox/sign/:signerId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { signerId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sandbox_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sandbox_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/sandbox_controller').default['show']>>>
    }
  }
  'sandbox.decide': {
    methods: ["POST"]
    pattern: '/sandbox/sign/:signerId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { signerId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/sandbox_controller').default['decide']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/sandbox_controller').default['decide']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/sandbox_controller').default['decide']>>>
    }
  }
  'session.destroy': {
    methods: ["POST"]
    pattern: '/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['destroy']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/session_controller').default['destroy']>>>
    }
  }
  'dashboard': {
    methods: ["GET","HEAD"]
    pattern: '/dashboard'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['show']>>>
    }
  }
  'contracts.index': {
    methods: ["GET","HEAD"]
    pattern: '/contracts'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/contracts_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/contracts_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/contracts_controller').default['index']>>>
    }
  }
  'contracts.create': {
    methods: ["GET","HEAD"]
    pattern: '/contracts/new'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/contracts_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/contracts_controller').default['create']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/contracts_controller').default['create']>>>
    }
  }
  'contracts.store': {
    methods: ["POST"]
    pattern: '/contracts'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/contract').createFromTemplateValidator)>|InferInput<(typeof import('#validators/contract').createContractValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/contract').createFromTemplateValidator)>|InferInput<(typeof import('#validators/contract').createContractValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/contracts_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/contracts_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/contracts_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'contracts.show': {
    methods: ["GET","HEAD"]
    pattern: '/contracts/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/contracts_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/contracts_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/contracts_controller').default['show']>>>
    }
  }
  'contracts.revise': {
    methods: ["POST"]
    pattern: '/contracts/:id/versions'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/contract').reviseContractValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/contract').reviseContractValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/contracts_controller').default['revise']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/contracts_controller').default['revise']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/contracts_controller').default['revise']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'contracts.submit': {
    methods: ["POST"]
    pattern: '/contracts/:id/submissions'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/contract').submitContractValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/contract').submitContractValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/contracts_controller').default['submit']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/contracts_controller').default['submit']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/contracts_controller').default['submit']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'approvals.decide': {
    methods: ["POST"]
    pattern: '/contracts/:id/approvals/:approvalId/decision'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/contract').decisionValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; approvalId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/contract').decisionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/approvals_controller').default['decide']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/approvals_controller').default['decide']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/approvals_controller').default['decide']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'comments.store': {
    methods: ["POST"]
    pattern: '/contracts/:id/comments'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/contract').commentValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/contract').commentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/comments_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/comments_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/comments_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'documents.store': {
    methods: ["POST"]
    pattern: '/contracts/:id/document'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['store']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['store']>>>
    }
  }
  'documents.show': {
    methods: ["GET","HEAD"]
    pattern: '/contracts/:id/document'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/documents_controller').default['show']>>>
    }
  }
  'signatures.store': {
    methods: ["POST"]
    pattern: '/contracts/:id/signature'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/contract').requestSignatureValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/contract').requestSignatureValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'signatures.cancel': {
    methods: ["POST"]
    pattern: '/contracts/:id/signature/cancel'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['cancel']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['cancel']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['cancel']>>>
    }
  }
  'signatures.proof': {
    methods: ["GET","HEAD"]
    pattern: '/contracts/:id/signature/proof'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['proof']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['proof']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['proof']>>>
    }
  }
  'terms.store': {
    methods: ["POST"]
    pattern: '/contracts/:id/term'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/contract').setTermValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/contract').setTermValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/obligations_controller').default['setTerm']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/obligations_controller').default['setTerm']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/obligations_controller').default['setTerm']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'terms.renew': {
    methods: ["POST"]
    pattern: '/contracts/:id/term/renew'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/obligations_controller').default['renew']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/obligations_controller').default['renew']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/obligations_controller').default['renew']>>>
    }
  }
  'terms.terminate': {
    methods: ["POST"]
    pattern: '/contracts/:id/term/terminate'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/obligations_controller').default['terminate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/obligations_controller').default['terminate']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/obligations_controller').default['terminate']>>>
    }
  }
  'obligations.store': {
    methods: ["POST"]
    pattern: '/contracts/:id/obligations'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/contract').addObligationValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/contract').addObligationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/obligations_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/obligations_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/obligations_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'obligations.complete': {
    methods: ["POST"]
    pattern: '/contracts/:id/obligations/:obligationId/complete'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; obligationId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/obligations_controller').default['complete']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/obligations_controller').default['complete']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/obligations_controller').default['complete']>>>
    }
  }
  'obligations.cancel': {
    methods: ["POST"]
    pattern: '/contracts/:id/obligations/:obligationId/cancel'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; obligationId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/obligations_controller').default['cancel']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/obligations_controller').default['cancel']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/obligations_controller').default['cancel']>>>
    }
  }
  'deadlines.index': {
    methods: ["GET","HEAD"]
    pattern: '/deadlines'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/deadlines_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/deadlines_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/deadlines_controller').default['index']>>>
    }
  }
  'templates.index': {
    methods: ["GET","HEAD"]
    pattern: '/templates'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/templates_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/templates_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/templates_controller').default['index']>>>
    }
  }
  'templates.create': {
    methods: ["GET","HEAD"]
    pattern: '/templates/new'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/templates_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/templates_controller').default['create']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/templates_controller').default['create']>>>
    }
  }
  'templates.store': {
    methods: ["POST"]
    pattern: '/templates'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/contract').createTemplateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/contract').createTemplateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/templates_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/templates_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/templates_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'workflows.index': {
    methods: ["GET","HEAD"]
    pattern: '/workflows'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/workflows_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/workflows_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/workflows_controller').default['index']>>>
    }
  }
  'workflows.store': {
    methods: ["POST"]
    pattern: '/workflows'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/contract').createWorkflowValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/contract').createWorkflowValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/workflows_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/workflows_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/workflows_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'members.index': {
    methods: ["GET","HEAD"]
    pattern: '/members'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/members_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/members_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/members_controller').default['index']>>>
    }
  }
  'members.store': {
    methods: ["POST"]
    pattern: '/members'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/contract').addMemberValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/contract').addMemberValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/members_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/members_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/members_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
}

export namespace Route {
  export type Request<Name extends keyof typeof routes> = RouteWithRegistry.Request<typeof routes, Name>
  export type Response<Name extends keyof typeof routes> = RouteWithRegistry.Response<typeof routes, Name>
  export type Params<Name extends keyof typeof routes> = RouteWithRegistry.Params<typeof routes, Name>
  export type Body<Name extends keyof typeof routes> = RouteWithRegistry.Body<typeof routes, Name>
  export type Query<Name extends keyof typeof routes> = RouteWithRegistry.Query<typeof routes, Name>
  export type Error<Name extends keyof typeof routes> = RouteWithRegistry.Error<typeof routes, Name>
}

export namespace Path {
  export type Request<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Request<typeof routes, M, P>
  export type Response<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Response<typeof routes, M, P>
  export type Params<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Params<typeof routes, M, P>
  export type Body<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Body<typeof routes, M, P>
  export type Query<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Query<typeof routes, M, P>
  export type Error<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Error<typeof routes, M, P>
}
