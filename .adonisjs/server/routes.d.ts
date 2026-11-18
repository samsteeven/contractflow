import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'webhooks.signature': { paramsTuple?: []; params?: {} }
    'sandbox.show': { paramsTuple: [ParamValue]; params: {'signerId': ParamValue} }
    'sandbox.decide': { paramsTuple: [ParamValue]; params: {'signerId': ParamValue} }
    'invitations.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'invitations.accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'contracts.index': { paramsTuple?: []; params?: {} }
    'contracts.create': { paramsTuple?: []; params?: {} }
    'contracts.store': { paramsTuple?: []; params?: {} }
    'contracts.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'contracts.revise': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'contracts.submit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'approvals.decide': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'approvalId': ParamValue} }
    'comments.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'attachments.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'attachments.show': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'attachmentId': ParamValue} }
    'documents.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'documents.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'signatures.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'signatures.cancel': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'signatures.proof': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'terms.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'terms.renew': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'terms.terminate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'obligations.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'obligations.complete': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'obligationId': ParamValue} }
    'obligations.cancel': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'obligationId': ParamValue} }
    'deadlines.index': { paramsTuple?: []; params?: {} }
    'templates.index': { paramsTuple?: []; params?: {} }
    'templates.create': { paramsTuple?: []; params?: {} }
    'templates.store': { paramsTuple?: []; params?: {} }
    'workflows.index': { paramsTuple?: []; params?: {} }
    'workflows.store': { paramsTuple?: []; params?: {} }
    'members.index': { paramsTuple?: []; params?: {} }
    'members.store': { paramsTuple?: []; params?: {} }
    'invitations.store': { paramsTuple?: []; params?: {} }
    'invitations.revoke': { paramsTuple: [ParamValue]; params: {'invitationId': ParamValue} }
  }
  GET: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'sandbox.show': { paramsTuple: [ParamValue]; params: {'signerId': ParamValue} }
    'invitations.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'contracts.index': { paramsTuple?: []; params?: {} }
    'contracts.create': { paramsTuple?: []; params?: {} }
    'contracts.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'attachments.show': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'attachmentId': ParamValue} }
    'documents.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'signatures.proof': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'deadlines.index': { paramsTuple?: []; params?: {} }
    'templates.index': { paramsTuple?: []; params?: {} }
    'templates.create': { paramsTuple?: []; params?: {} }
    'workflows.index': { paramsTuple?: []; params?: {} }
    'members.index': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'sandbox.show': { paramsTuple: [ParamValue]; params: {'signerId': ParamValue} }
    'invitations.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'contracts.index': { paramsTuple?: []; params?: {} }
    'contracts.create': { paramsTuple?: []; params?: {} }
    'contracts.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'attachments.show': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'attachmentId': ParamValue} }
    'documents.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'signatures.proof': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'deadlines.index': { paramsTuple?: []; params?: {} }
    'templates.index': { paramsTuple?: []; params?: {} }
    'templates.create': { paramsTuple?: []; params?: {} }
    'workflows.index': { paramsTuple?: []; params?: {} }
    'members.index': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'webhooks.signature': { paramsTuple?: []; params?: {} }
    'sandbox.decide': { paramsTuple: [ParamValue]; params: {'signerId': ParamValue} }
    'invitations.accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'contracts.store': { paramsTuple?: []; params?: {} }
    'contracts.revise': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'contracts.submit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'approvals.decide': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'approvalId': ParamValue} }
    'comments.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'attachments.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'documents.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'signatures.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'signatures.cancel': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'terms.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'terms.renew': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'terms.terminate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'obligations.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'obligations.complete': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'obligationId': ParamValue} }
    'obligations.cancel': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'obligationId': ParamValue} }
    'templates.store': { paramsTuple?: []; params?: {} }
    'workflows.store': { paramsTuple?: []; params?: {} }
    'members.store': { paramsTuple?: []; params?: {} }
    'invitations.store': { paramsTuple?: []; params?: {} }
    'invitations.revoke': { paramsTuple: [ParamValue]; params: {'invitationId': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}