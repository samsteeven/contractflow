import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
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
    'workflows.index': { paramsTuple?: []; params?: {} }
    'workflows.store': { paramsTuple?: []; params?: {} }
    'members.index': { paramsTuple?: []; params?: {} }
    'members.store': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'contracts.index': { paramsTuple?: []; params?: {} }
    'contracts.create': { paramsTuple?: []; params?: {} }
    'contracts.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'workflows.index': { paramsTuple?: []; params?: {} }
    'members.index': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'contracts.index': { paramsTuple?: []; params?: {} }
    'contracts.create': { paramsTuple?: []; params?: {} }
    'contracts.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'workflows.store': { paramsTuple?: []; params?: {} }
    'members.store': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}