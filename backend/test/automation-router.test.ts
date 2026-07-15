import express, { type RequestHandler } from "express";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAutomationRouter, MongoAutomationApiService, type AutomationApiService } from "../src/modules/automation/automation.router.js";

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
    expect(transition).toHaveBeenCalledWith("exec-1",["waiting_approval"],"running",{approval:{decidedBy:"actor@example.com",decidedAt:expect.any(String),decision:"approved",inputFingerprint:"fingerprint-1"}},undefined,"fingerprint-1");
    expect(audit).toHaveBeenCalledWith({actor:"actor@example.com",action:"automation.execution.approve",target:"exec-1",metadata:{from:"waiting_approval",to:"running"}});
  });

  it.each([
    ["reject","rejected",["waiting_approval"]], ["cancel","cancelled",["planned","waiting_approval","running"]], ["retry-compensation","compensating",["compensation_failed"]]
  ])("maps invalid %s state to 409", async (route,next,expected) => {
    const transition=vi.fn().mockResolvedValue(undefined),api=service({findExecution:vi.fn().mockResolvedValue(execution("succeeded")),transition});
    const {response}=await request(api,`/api/automation/executions/exec-1/${route}`,{method:"POST",body:"{}"}); expect(response.status).toBe(409);
    expect(transition).toHaveBeenCalledWith("exec-1",expected,next,route==="reject"?expect.objectContaining({approval:expect.any(Object)}):undefined,route==="cancel"?true:undefined,undefined);
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

  it.each([
    "/api/automation/rules/%20/publish", "/api/automation/rules/bad$id/enabled", "/api/automation/rules/bad$id/dry-run",
    "/api/automation/executions/%20", "/api/automation/executions/bad$id/approve", "/api/automation/executions/bad$id/reject",
    "/api/automation/executions/bad$id/cancel", "/api/automation/executions/bad$id/retry-compensation"
  ])("rejects unsafe path id with 400: %s", async path => {
    const api=service(), method=path.endsWith("%20")?"GET":path.includes("enabled")?"PATCH":"POST";
    const body=path.includes("enabled")?JSON.stringify({enabled:true}):path.includes("approve")?JSON.stringify({inputFingerprint:"fingerprint-1"}):"{}";
    const {response}=await request(api,path,{method,body:method==="GET"?undefined:body}); expect(response.status).toBe(400);
  });
  it("rejects malformed dry-run event before delegation", async () => {

    const dryRun=vi.fn(),api=service({dryRun});
    const {response}=await request(api,"/api/automation/rules/rule-1/dry-run",{method:"POST",body:JSON.stringify({payload:{}})});
    expect(response.status).toBe(400); expect(dryRun).not.toHaveBeenCalled();
  });
  it("maps enabling an unpublished rule to 404", async () => {
    const {response}=await request(service({setRuleEnabled:vi.fn().mockResolvedValue(undefined)}),"/api/automation/rules/unpublished/enabled",{method:"PATCH",body:JSON.stringify({enabled:true})});
    expect(response.status).toBe(404);
  });



  it("delegates publication to repository transactional semantics", async () => {
    const published={_id:"rule-1",version:2} as never,publish=vi.fn().mockResolvedValue(published),repository={publish,setEnabled:vi.fn()} as never;
    const adapter=new MongoAutomationApiService({} as never,{repository,automationService:{dryRun:vi.fn()} as never});
    await expect(adapter.publishRule("rule-1")).resolves.toBe(published); expect(publish).toHaveBeenCalledWith("rule-1",expect.any(String));
  });

  it("maps repository publication missing rule to undefined", async () => {
    const repository={publish:vi.fn().mockRejectedValue(new Error("Rule not found")),setEnabled:vi.fn()} as never;
    const adapter=new MongoAutomationApiService({} as never,{repository,automationService:{dryRun:vi.fn()} as never});
    await expect(adapter.publishRule("missing")).resolves.toBeUndefined();
  });

  it("delegates enabled state without mutating the draft", async () => {
    const setEnabled=vi.fn().mockResolvedValue(undefined),repository={publish:vi.fn(),setEnabled} as never;
    const adapter=new MongoAutomationApiService({} as never,{repository,automationService:{dryRun:vi.fn()} as never});
    await expect(adapter.setRuleEnabled("unpublished",true)).resolves.toBeUndefined(); expect(setEnabled).toHaveBeenCalledWith("unpublished",true);
  });

  it("delegates dry-run evaluation and planning to AutomationService", async () => {
    const event={eventId:"event-1",type:"pr.opened",source:"github",occurredAt:"2026-01-01T00:00:00.000Z",scope:{repository:"org/repo"},payload:{}} as const;
    const result={rule:{_id:"rule-1"},plan:{inputFingerprint:"fingerprint-1"}},dryRun=vi.fn().mockResolvedValue(result),repository={publish:vi.fn(),setEnabled:vi.fn()} as never;
    const adapter=new MongoAutomationApiService({} as never,{repository,automationService:{dryRun} as never});
    await expect(adapter.dryRun("rule-1",event)).resolves.toBe(result); expect(dryRun).toHaveBeenCalledWith("rule-1",event);
  });

  it("atomically filters approval by id, waiting state, and approved fingerprint", async () => {
    const findOneAndUpdate=vi.fn().mockResolvedValue(execution("running")),collection=vi.fn().mockReturnValue({findOneAndUpdate});
    const adapter=new MongoAutomationApiService({collection} as never);
    await adapter.transition("exec-1",["waiting_approval"],"running",{approval:{inputFingerprint:"fingerprint-1"}},false,"fingerprint-1");
    expect(findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({_id:"exec-1",status:"waiting_approval","plan.inputFingerprint":"fingerprint-1"}),expect.any(Object),{returnDocument:"after"});
  });

  it("keeps an explicitly empty fingerprint in the atomic Mongo predicate", async () => {
    const findOneAndUpdate=vi.fn().mockResolvedValue(undefined),collection=vi.fn().mockReturnValue({findOneAndUpdate});
    const adapter=new MongoAutomationApiService({collection} as never);
    await adapter.transition("exec-1",["waiting_approval"],"running",{},false,"");
    expect(findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({status:"waiting_approval","plan.inputFingerprint":""}),expect.any(Object),{returnDocument:"after"});
  });

  it.each([
    ["string","bad"], ["extra",{executionId:"exec-1",sourceRuleId:"rule-1",depth:1,extra:true}],
    ["bad id",{executionId:"bad$id",sourceRuleId:"rule-1",depth:1}], ["fractional depth",{executionId:"exec-1",sourceRuleId:"rule-1",depth:1.5}],
    ["negative depth",{executionId:"exec-1",sourceRuleId:"rule-1",depth:-1}], ["excessive depth",{executionId:"exec-1",sourceRuleId:"rule-1",depth:6}]
  ])("rejects invalid automation provenance: %s", async (_label,automation) => {
    const dryRun=vi.fn(),api=service({dryRun}),event={eventId:"event-1",type:"pr.opened",source:"github",occurredAt:"2026-01-01T00:00:00.000Z",scope:{repository:"org/repo"},payload:{},automation};
    const {response}=await request(api,"/api/automation/rules/rule-1/dry-run",{method:"POST",body:JSON.stringify(event)});
    expect(response.status).toBe(400); expect(dryRun).not.toHaveBeenCalled();
  });

  it("accepts valid automation provenance", async () => {
    const dryRun=vi.fn().mockResolvedValue({plan:{}}),api=service({dryRun}),event={eventId:"event-1",type:"pr.opened",source:"github",occurredAt:"2026-01-01T00:00:00.000Z",scope:{repository:"org/repo"},payload:{},automation:{executionId:"exec-1",sourceRuleId:"rule-1",depth:5}};
    const {response}=await request(api,"/api/automation/rules/rule-1/dry-run",{method:"POST",body:JSON.stringify(event)}); expect(response.status).toBe(200);
  });

  it("mounts the production router", () => {
    const source=readFileSync(new URL("../src/server.ts",import.meta.url),"utf8");
    expect(source).toContain('app.use("/api/automation", automationRouter)');
  });
});
