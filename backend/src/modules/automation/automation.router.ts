import { randomUUID } from "node:crypto";
import { Router, type Request, type RequestHandler } from "express";
import type { Db, Filter } from "mongodb";
import { authenticate, authorize, type AuthRequest } from "../../core/auth.js";
import { audit } from "../../core/audit.service.js";
import { database } from "../../core/database.js";
import { ValidationError, object } from "../../core/validation.js";
import { parseRuleInput } from "./automation.validation.js";
import type { AutomationEvent, AutomationExecution, AutomationRule, ExecutionStatus } from "./automation.model.js";
import { AutomationRepository } from "./automation.repository.js";
import { AutomationService } from "./automation.service.js";


type Paging = { page: number; limit: number; status?: string; ruleId?: string };
type AutomationRequest = Request & AuthRequest;
type Audit = (i: { actor?: string; action: string; target: string; metadata?: Record<string, unknown> }) => Promise<unknown>;
export interface AutomationApiService {
  listRules(i: Paging): Promise<{ items: AutomationRule[]; total: number }>;
  createRule(i: ReturnType<typeof parseRuleInput>, actor: string): Promise<AutomationRule>;
  publishRule(id: string): Promise<AutomationRule | undefined>; setRuleEnabled(id: string, enabled: boolean): Promise<AutomationRule | undefined>;
  dryRun(id: string, input: AutomationEvent): Promise<unknown | undefined>; listExecutions(i: Paging): Promise<{ items: AutomationExecution[]; total: number }>;
  findExecution(id: string): Promise<AutomationExecution | undefined>;
  transition(id: string, expected: ExecutionStatus[], next: ExecutionStatus, extra?: Record<string, unknown>, noAttempts?: boolean, expectedFingerprint?: string): Promise<AutomationExecution | undefined>;
}
const states: ExecutionStatus[] = ["planned","waiting_approval","running","succeeded","rejected","cancelled","expired","compensating","rolled_back","compensation_failed"];
function paging(q: Record<string, unknown>, allowed?: string[]): Paging { const page=q.page===undefined?1:Number(q.page), limit=q.limit===undefined?30:Number(q.limit); if(!Number.isInteger(page)||page<1||!Number.isInteger(limit)||limit<1||limit>100) throw new ValidationError("Invalid pagination"); const status=q.status===undefined?undefined:String(q.status),ruleId=q.ruleId===undefined?undefined:String(q.ruleId); if(status&&(!allowed||!allowed.includes(status))) throw new ValidationError("Invalid status filter"); if(ruleId!==undefined&&(!ruleId.trim()||ruleId.length>200)) throw new ValidationError("Invalid rule filter"); return {page,limit,...(status?{status}:{}),...(ruleId?{ruleId}:{})}; }
function identifier(value: unknown): string {
  const id=String(value??""); if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(id)) throw new ValidationError("Invalid identifier"); return id;
}
function automationEvent(value: unknown): AutomationEvent {
  const body=object(value),scope=object(body.scope); object(body.payload);
  const triggers=["pr.opened","pr.updated","pr.merged","pr.closed","pr.review_changed","task.created","task.updated","task.status_changed","task.due_soon","task.overdue","integration.failed","schedule.tick"];
  const sources=["audit","github","scheduler","operations"], occurredAt=typeof body.occurredAt==="string"?body.occurredAt:"", parsed=new Date(occurredAt);
  if(Object.keys(body).some(k=>!["eventId","type","source","occurredAt","actor","scope","payload","automation"].includes(k))||typeof body.eventId!=="string"||!identifier(body.eventId)||typeof body.type!=="string"||!triggers.includes(body.type)||typeof body.source!=="string"||!sources.includes(body.source)||Number.isNaN(parsed.getTime())||parsed.toISOString()!==occurredAt||Object.keys(scope).some(k=>!["repository","projectId","team"].includes(k)))throw new ValidationError("Invalid automation event");
  for(const v of Object.values(scope))if(typeof v!=="string"||!v.trim()||v.length>200)throw new ValidationError("Invalid automation event scope");
  if(body.actor!==undefined&&(typeof body.actor!=="string"||body.actor.length>254))throw new ValidationError("Invalid automation event actor");
  if(body.automation!==undefined){
    const provenance=object(body.automation);
    if(Object.keys(provenance).some(k=>!["executionId","sourceRuleId","depth"].includes(k))||typeof provenance.executionId!=="string"||typeof provenance.sourceRuleId!=="string"||!Number.isInteger(provenance.depth)||Number(provenance.depth)<0||Number(provenance.depth)>5)throw new ValidationError("Invalid automation provenance");
    identifier(provenance.executionId); identifier(provenance.sourceRuleId);
  }
  return body as unknown as AutomationEvent;
}



class Missing extends Error {} class Conflict extends Error {}

export function createAutomationRouter(d: { service: AutomationApiService; audit: Audit; authenticate?: RequestHandler }) {
  const r=Router(), s=d.service, actor=(q:AutomationRequest)=>q.user?.email??"unknown"; r.use(d.authenticate??authenticate,authorize("superadmin"));
  const endpoint=(action:string,fn:(q:AutomationRequest)=>Promise<{value:unknown;target:string;metadata?:Record<string,unknown>;code?:number}>):RequestHandler=>async(q,res,next)=>{try{const o=await fn(q as AutomationRequest);await d.audit({actor:actor(q as AutomationRequest),action,target:o.target,metadata:o.metadata});res.status(o.code??200).json(o.value);}catch(e){if(e instanceof ValidationError)return res.status(400).json({error:e.message});next(e);}};
  r.get("/rules",async(q,res,next)=>{try{const p=paging(q.query),x=await s.listRules(p);res.json({...x,page:p.page,pages:Math.ceil(x.total/p.limit)});}catch(e){if(e instanceof ValidationError)return res.status(400).json({error:e.message});next(e);}});
  r.post("/rules",endpoint("automation.rule.create",async q=>{const value=await s.createRule(parseRuleInput(q.body),actor(q));return{value,target:value._id,code:201};}));
  r.post("/rules/:id/publish",endpoint("automation.rule.publish",async q=>{const value=await s.publishRule(identifier(q.params.id));if(!value)throw new Missing("Rule not found");return{value,target:value._id};}));
  r.patch("/rules/:id/enabled",endpoint("automation.rule.enabled",async q=>{const b=object(q.body);if(typeof b.enabled!=="boolean"||Object.keys(b).length!==1)throw new ValidationError("Invalid enabled state");const value=await s.setRuleEnabled(identifier(q.params.id),b.enabled);if(!value)throw new Missing("Rule not found or unpublished");return{value,target:value._id,metadata:{enabled:b.enabled}};}));
  r.post("/rules/:id/dry-run",endpoint("automation.rule.dry_run",async q=>{const ruleId=identifier(q.params.id),value=await s.dryRun(ruleId,automationEvent(q.body));if(value===undefined)throw new Missing("Rule not found or event did not match");return{value,target:ruleId};}));
  r.get("/executions",async(q,res,next)=>{try{const p=paging(q.query,states),x=await s.listExecutions(p);res.json({...x,page:p.page,pages:Math.ceil(x.total/p.limit)});}catch(e){if(e instanceof ValidationError)return res.status(400).json({error:e.message});next(e);}});
  r.get("/executions/:id",async(q,res,next)=>{try{const x=await s.findExecution(identifier(q.params.id));return x?res.json(x):res.status(404).json({error:"Execution not found"});}catch(e){if(e instanceof ValidationError)return res.status(400).json({error:e.message});next(e);}});
  const move=(path:string,action:string,expected:ExecutionStatus[],nextState:ExecutionStatus,opt?:{fingerprint?:boolean;noAttempts?:boolean})=>r.post(path,endpoint(action,async q=>{const current=await s.findExecution(identifier(q.params.id));if(!current)throw new Missing("Execution not found");const b=object(q.body??{});let extra:Record<string,unknown>|undefined;if(opt?.fingerprint){if(typeof b.inputFingerprint!=="string")throw new ValidationError("inputFingerprint is required");if(b.inputFingerprint!==current.plan.inputFingerprint)throw new Conflict("Stale input fingerprint");extra={approval:{decidedBy:actor(q),decidedAt:new Date().toISOString(),decision:"approved",inputFingerprint:b.inputFingerprint}};}if(nextState==="rejected")extra={approval:{decidedBy:actor(q),decidedAt:new Date().toISOString(),decision:"rejected",inputFingerprint:current.plan.inputFingerprint}};const value=await s.transition(current._id,expected,nextState,extra,opt?.noAttempts,opt?.fingerprint?String(b.inputFingerprint):undefined);if(!value)throw new Conflict("Invalid or stale execution state");return{value,target:current._id,metadata:{from:current.status,to:nextState}};}));
  move("/executions/:id/approve","automation.execution.approve",["waiting_approval"],"running",{fingerprint:true}); move("/executions/:id/reject","automation.execution.reject",["waiting_approval"],"rejected"); move("/executions/:id/cancel","automation.execution.cancel",["planned","waiting_approval","running"],"cancelled",{noAttempts:true}); move("/executions/:id/retry-compensation","automation.execution.retry_compensation",["compensation_failed"],"compensating");
  r.use((e:unknown,_q:unknown,res:{status(n:number):{json(v:unknown):unknown}},next:(e:unknown)=>void)=>{if(e instanceof Missing)return res.status(404).json({error:e.message});if(e instanceof Conflict)return res.status(409).json({error:e.message});next(e);}); return r;
}
export class MongoAutomationApiService implements AutomationApiService {
  private readonly repository: AutomationRepository;
  private readonly automationService: AutomationService;
  constructor(private db:Db,deps?:{repository?:AutomationRepository;automationService?:AutomationService}){this.repository=deps?.repository??new AutomationRepository(db);this.automationService=deps?.automationService??new AutomationService(this.repository);}
  async listRules(p:Paging){const f:Filter<{_id:string;draft:AutomationRule}>=p.ruleId?{_id:p.ruleId}:{};const c=this.db.collection<{_id:string;draft:AutomationRule}>("automation_rules"),[a,total]=await Promise.all([c.find(f).skip((p.page-1)*p.limit).limit(p.limit).toArray(),c.countDocuments(f)]);return{items:a.map(x=>x.draft),total};}
  async createRule(i:ReturnType<typeof parseRuleInput>,actor:string){const now=new Date().toISOString(),x:AutomationRule={...i,_id:randomUUID(),versionId:randomUUID(),version:0,enabled:i.enabled??false,priority:i.priority??0,createdBy:actor,createdAt:now};await this.db.collection<{_id:string;draft:AutomationRule}>("automation_rules").insertOne({_id:x._id,draft:x});return x;}
  async publishRule(id:string){try{return await this.repository.publish(id,new Date().toISOString());}catch(error){if(error instanceof Error&&error.message==="Rule not found")return undefined;throw error;}}
  async setRuleEnabled(id:string,enabled:boolean){return this.repository.setEnabled(id,enabled);}
  async dryRun(id:string,input:AutomationEvent){return this.automationService.dryRun(id,input);}
  async listExecutions(p:Paging){const f:Filter<AutomationExecution>={...(p.status?{status:p.status as ExecutionStatus}:{}),...(p.ruleId?{ruleId:p.ruleId}:{})},c=this.db.collection<AutomationExecution>("automation_executions"),[items,total]=await Promise.all([c.find(f).sort({createdAt:-1}).skip((p.page-1)*p.limit).limit(p.limit).toArray(),c.countDocuments(f)]);return{items,total};}
  async findExecution(id:string){return(await this.db.collection<AutomationExecution>("automation_executions").findOne({_id:id}))??undefined;}
  async transition(id:string,expected:ExecutionStatus[],next:ExecutionStatus,extra={},noAttempts=false,expectedFingerprint?:string){const hasFingerprint=expectedFingerprint!==undefined,f:Filter<AutomationExecution>={_id:id,status:hasFingerprint?expected[0]:{$in:expected},...(noAttempts?{attempts:{$size:0}}:{}),...(hasFingerprint?{"plan.inputFingerprint":expectedFingerprint}:{})};return(await this.db.collection<AutomationExecution>("automation_executions").findOneAndUpdate(f,{$set:{status:next,updatedAt:new Date().toISOString(),...extra}},{returnDocument:"after"}))??undefined;}
}
const production=new Proxy({} as AutomationApiService,{get:(_t,k)=>async(...args:unknown[])=>{const x=new MongoAutomationApiService(await database());return(x[k as keyof MongoAutomationApiService] as (...a:unknown[])=>unknown).apply(x,args);}}); export const automationRouter=createAutomationRouter({service:production,audit});
