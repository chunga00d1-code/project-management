import express, { type RequestHandler } from "express";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAutomationRouter, type AutomationApiService } from "../src/modules/automation/automation.router.js";

const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve())))); });

function execution(status = "waiting_approval") {
  return { _id:"exec-1", ruleId:"rule-1", ruleVersionId:"version-1", eventId:"event-1", status, plan:{ inputFingerprint:"fingerprint-1" }, attempts:[], createdAt:"2026-01-01T00:00:00.000Z", updatedAt:"2026-01-01T00:00:00.000Z" } as never;
}
function service(overrides: Partial<AutomationApiService> = {}): AutomationApiService {
  return {
    listRules: vi.fn().mockResolvedValue({items:[],total:0}), createRule:vi.fn(), publishRule:vi.fn(), setRuleEnabled:vi.fn(), dryRun:vi.fn(),
    listExecutions:vi.fn().mockResolvedValue({items:[],total:0}), findExecution:vi.fn(), transition:vi.fn(), ...overrides
  } as AutomationApiService;
}
function auth(role = "superadmin"): RequestHandler {
  return (req,_res,next) => { (req as never as {user:unknown}).user={email:"actor@example.com",role}; next(); };
}
async function request(api: AutomationApiService, path: string, init: RequestInit = {}, role = "superadmin", audit = vi.fn()) {
  const app=express(); app.use(express.json()); app.use("/api/automation",createAutomationRouter({service:api,audit,authenticate:auth(role)}));
  const server=createServer(app); servers.push(server); await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const address=server.address(); if(!address||typeof address==="string") throw new Error("No test address");
  const response=await fetch(`http://127.0.0.1:${address.port}${path}`,{...init,headers:{"content-type":"application/json",...init.headers}});
  return {response,body:await response.json(),audit};
}

describe("automation router", () => {
  it("allows a superadmin to list rules", async () => {
    const api=service({listRules:vi.fn().mockResolvedValue({items:[],total:0})}); const {response,body}=await request(api,"/api/automation/rules");
    expect(response.status).toBe(200); expect(body).toEqual({items:[],total:0,page:1,pages:0});
  });

  it.each(["admin","manager","developer"])("denies %s", async role => {
    const {response}=await request(service(),"/api/automation/rules",{},role); expect(response.status).toBe(403);
  });

  it("maps invalid mutation input to 400", async () => {
    const {response}=await request(service(),"/api/automation/rules/rule-1/enabled",{method:"PATCH",body:JSON.stringify({enabled:"yes"})});
    expect(response.status).toBe(400);
  });

  it.each(["/api/automation/rules/missing/publish","/api/automation/executions/missing"])("maps missing %s to 404", async path => {
    const init=path.includes("publish")?{method:"POST"}:{}; const {response}=await request(service(),path,init); expect(response.status).toBe(404);
  });

  it("rejects a stale approval fingerprint without transitioning or auditing", async () => {
    const transition=vi.fn(),audit=vi.fn(),api=service({findExecution:vi.fn().mockResolvedValue(execution()),transition});
    const {response}=await request(api,"/api/automation/executions/exec-1/approve",{method:"POST",body:JSON.stringify({inputFingerprint:"stale"})},"superadmin",audit);
    expect(response.status).toBe(409); expect(transition).not.toHaveBeenCalled(); expect(audit).not.toHaveBeenCalled();
  });

  it("atomically approves with actor, decision, time and fingerprint then audits", async () => {
    const current=execution(),updated={...current,status:"running"} as never,transition=vi.fn().mockResolvedValue(updated),audit=vi.fn(),api=service({findExecution:vi.fn().mockResolvedValue(current),transition});
    const {response}=await request(api,"/api/automation/executions/exec-1/approve",{method:"POST",body:JSON.stringify({inputFingerprint:"fingerprint-1"})},"superadmin",audit);
    expect(response.status).toBe(200);
    expect(transition).toHaveBeenCalledWith("exec-1",["waiting_approval"],"running",{approval:{decidedBy:"actor@example.com",decidedAt:expect.any(String),decision:"approved",inputFingerprint:"fingerprint-1"}},undefined);
    expect(audit).toHaveBeenCalledWith({actor:"actor@example.com",action:"automation.execution.approve",target:"exec-1",metadata:{from:"waiting_approval",to:"running"}});
  });

  it.each([
    ["reject","rejected",["waiting_approval"]], ["cancel","cancelled",["planned","waiting_approval","running"]], ["retry-compensation","compensating",["compensation_failed"]]
  ])("maps invalid %s state to 409", async (route,next,expected) => {
    const transition=vi.fn().mockResolvedValue(undefined),api=service({findExecution:vi.fn().mockResolvedValue(execution("succeeded")),transition});
    const {response}=await request(api,`/api/automation/executions/exec-1/${route}`,{method:"POST",body:"{}"}); expect(response.status).toBe(409);
    expect(transition).toHaveBeenCalledWith("exec-1",expected,next,route==="reject"?expect.objectContaining({approval:expect.any(Object)}):undefined,route==="cancel"?true:undefined);
  });

  it.each(["page=0","page=1.5","limit=0","limit=101","status=unsafe"])("bounds pagination/filter: %s", async query => {
    const {response}=await request(service(),`/api/automation/executions?${query}`); expect(response.status).toBe(400);
  });

  it("passes safe bounded execution filters", async () => {
    const listExecutions=vi.fn().mockResolvedValue({items:[],total:0}); const {response}=await request(service({listExecutions}),"/api/automation/executions?page=2&limit=10&status=running&ruleId=rule-1");
    expect(response.status).toBe(200); expect(listExecutions).toHaveBeenCalledWith({page:2,limit:10,status:"running",ruleId:"rule-1"});
  });

  it("registers every required endpoint", () => {
    const router=createAutomationRouter({service:service(),audit:vi.fn(),authenticate:auth()});
    const routes=(router as never as {stack:{route?:{path:string;methods:Record<string,boolean>}}[]}).stack.flatMap(x=>x.route?[`${Object.keys(x.route.methods)[0].toUpperCase()} ${x.route.path}`]:[]);
    expect(routes).toEqual(expect.arrayContaining(["GET /rules","POST /rules","POST /rules/:id/publish","PATCH /rules/:id/enabled","POST /rules/:id/dry-run","GET /executions","GET /executions/:id","POST /executions/:id/approve","POST /executions/:id/reject","POST /executions/:id/cancel","POST /executions/:id/retry-compensation"]));
  });

  it("mounts the production router", () => {
    const source=readFileSync(new URL("../src/server.ts",import.meta.url),"utf8");
    expect(source).toContain('app.use("/api/automation", automationRouter)');
  });
});
