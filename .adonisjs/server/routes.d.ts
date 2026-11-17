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
    'documents.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'documents.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'templates.index': { paramsTuple?: []; params?: {} }
    'templates.create': { paramsTuple?: []; params?: {} }
    'templates.store': { paramsTuple?: []; params?: {} }
    'workflows.index': { paramsTuple?: []; params?: {} }
    'workflows.store': { paramsTuple?: []; params?: {} }
    'members.index': { paramsTuple?: []; params?: {} }
    'members.store': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'contracts.index': { paramsTuple?: []; params?: {} }
    'contracts.create': { paramsTuple?: []; params?: {} }
    'contracts.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'documents.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'dashboard': { paramsTuple?: []; params?: {} }
    'contracts.index': { paramsTuple?: []; params?: {} }
    'contracts.create': { paramsTuple?: []; params?: {} }
    'contracts.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'documents.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'templates.index': { paramsTuple?: []; params?: {} }
    'templates.create': { paramsTuple?: []; params?: {} }
    'workflows.index': { paramsTuple?: []; params?: {} }
    'members.index': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'contracts.store': { paramsTuple?: []; params?: {} }
    'contracts.revise': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'contracts.submit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'approvals.decide': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'approvalId': ParamValue} }
    'comments.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'documents.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'templates.store': { paramsTuple?: []; params?: {} }
    'workflows.store': { paramsTuple?: []; params?: {} }
    'members.store': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}