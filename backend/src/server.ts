import { env } from "./config/env.js";import { closeDatabase } from "./core/database.js";import { retryQueue } from "./modules/jobs/retry-queue.service.js";import { notifyReview } from "./modules/notifications/notification.service.js";import { buildApp } from "./app.js";
interface NotificationJobPayload{repository:string;number:number;url:string;findings:Parameters<typeof notifyReview>[3]}
const app=await buildApp();
retryQueue.start(async job=>{if(job.type==="notification"){const payload=job.payload as NotificationJobPayload;await notifyReview(payload.repository,payload.number,payload.url,payload.findings)}});
const server=app.listen(env.port,()=>console.log(`Service on ${env.port}`));
process.on("SIGTERM",()=>{retryQueue.stop();server.close(()=>closeDatabase().then(()=>process.exit(0)));});
