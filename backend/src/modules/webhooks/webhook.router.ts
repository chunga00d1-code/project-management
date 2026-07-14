import { Router } from "express";
import { env } from "../../config/env.js";
import { audit } from "../../core/audit.service.js";
import { verifySignature, reviewDiff } from "../reviews/review.service.js";
import { notifyReview } from "../notifications/notification.service.js";
import { TaskService } from "../tasks/task.service.js";
import { retryQueue } from "../jobs/retry-queue.service.js";
import { SettingsService } from "../settings/settings.service.js";
import { DeliveryService } from "./delivery.service.js";
import { getPullRequestFiles } from "./github-files.service.js";
import { InstallationService } from "../github-app/installation.model.js";
import { ProjectLinkService } from "../github-app/project-link.service.js";
import { getInstallationToken } from "../github-app/github-app.service.js";
const tasks = new TaskService();
const settings = new SettingsService();
const deliveries = new DeliveryService();
const installations = new InstallationService();
const projectLinks = new ProjectLinkService();
export const webhookRouter = Router();
interface InstallationPayload {
  action: string;
  installation: { id: number; account: { login: string } };
  repositories?: { full_name: string }[];
  repositories_added?: { full_name: string }[];
  repositories_removed?: { full_name: string }[];
}
async function handleInstallationEvent(payload: InstallationPayload) {
  const installationId = payload.installation.id;
  const account = payload.installation.account.login;
  if (payload.action === "created") {
    const repos = (payload.repositories || []).map((r) => r.full_name);
    await installations.upsert(installationId, account, repos);
    for (const repo of repos) await projectLinks.linkRepositoryToProject(repo, installationId);
  } else if (payload.action === "deleted") {
    const existing = await installations.delete(installationId);
    for (const repo of existing?.repositories || []) await projectLinks.unlinkRepository(repo);
  }
}
async function handleInstallationRepositoriesEvent(payload: InstallationPayload) {
  const installationId = payload.installation.id;
  const account = payload.installation.account.login;
  const added = (payload.repositories_added || []).map((r) => r.full_name);
  const removed = (payload.repositories_removed || []).map((r) => r.full_name);
  if (added.length) {
    await installations.addRepositories(installationId, added);
    for (const repo of added) await projectLinks.linkRepositoryToProject(repo, installationId);
  }
  if (removed.length) {
    await installations.removeRepositories(installationId, removed);
    for (const repo of removed) await projectLinks.unlinkRepository(repo);
  }
  if (!added.length && !removed.length && payload.action === "added")
    await installations.upsert(installationId, account, []);
}
async function resolveGithubToken(repositoryFullName: string): Promise<string> {
  const installation = await installations.findByRepository(repositoryFullName);
  if (installation) {
    try {
      return await getInstallationToken(installation._id);
    } catch {
      return env.githubApiToken;
    }
  }
  return env.githubApiToken;
}
webhookRouter.post("/github", async (req, res, next) => {
  try {
    const deliveryId = req.header("x-github-delivery") || "";
    const body = req.body as Buffer;
    if (!verifySignature(body, req.header("x-hub-signature-256")))
      return res.status(401).json({ error: "Invalid signature" });
    interface PullRequestPayload {
      action: string;
      repository: { full_name: string; url: string };
      pull_request: {
        number: number;
        title: string;
        html_url: string;
        comments_url: string;
        merged?: boolean;
        assignee?: { login: string } | null;
        requested_reviewers?: { login: string }[];
      };
    }
    const githubEvent = req.header("x-github-event");
    if (githubEvent === "ping") return res.json({ message: "pong" });
    if (githubEvent === "installation" || githubEvent === "installation_repositories") {
      let installationPayload: InstallationPayload;
      try {
        installationPayload = JSON.parse(body.toString());
      } catch {
        return res.status(400).json({ error: "Invalid JSON payload" });
      }
      if (deliveryId && (await deliveries.seen(deliveryId)))
        return res.json({ received: true, duplicate: true });
      if (githubEvent === "installation") await handleInstallationEvent(installationPayload);
      else await handleInstallationRepositoriesEvent(installationPayload);
      if (deliveryId) await deliveries.mark(deliveryId);
      return res.json({ received: true });
    }
    let payload: PullRequestPayload;
    try {
      payload = JSON.parse(body.toString());
    } catch {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }
    if (
      githubEvent !== "pull_request" ||
      !env.prActions.includes(payload.action)
    )
      return res.status(202).json({ ignored: true });
    if (
      env.allowedRepositories.length &&
      !env.allowedRepositories.includes(payload.repository.full_name)
    )
      return res
        .status(202)
        .json({ ignored: true, reason: "repository_not_allowed" });
    if (deliveryId && (await deliveries.seen(deliveryId)))
      return res.json({ received: true, duplicate: true });
    const pr = payload.pull_request;
    const githubToken = await resolveGithubToken(payload.repository.full_name);
    const findings = await reviewDiff(
      await getPullRequestFiles(payload.repository.url, pr.number, 10, githubToken),
    );
    const runtime = await settings.get();
    const blocking = runtime.blockingSeverities?.length
      ? runtime.blockingSeverities
      : ["critical", "high"];
    const status =
      payload.action === "closed"
        ? pr.merged
          ? "done"
          : "cancelled"
        : findings.some((f) => blocking.includes(f.severity))
          ? "needs_changes"
          : "ready";
    const assigneeLogin =
      pr.assignee?.login || pr.requested_reviewers?.[0]?.login || "";
    const assignee =
      String(runtime.githubAssigneeMappings || "")
        .split(/\\r?\\n|,/)
        .map((line: string) => line.split("=").map((x) => x.trim()))
        .find(
          (pair: string[]) =>
            pair[0]?.toLowerCase() === assigneeLogin.toLowerCase(),
        )?.[1] || assigneeLogin;
    const summary =
      findings
        .map((f) => `[${f.severity}] ${f.file}: ${f.message}`)
        .join("\n") || "No findings";
    const syncedTask = await tasks.upsertPullRequest({
      repository: payload.repository.full_name,
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      status,
      summary,
      assignee,
    });
    if (syncedTask) await audit({ actor: "github-webhook", action: "task.update", target: syncedTask._id, metadata: { projectId: syncedTask.projectId, repository: payload.repository.full_name, pullRequestNumber: pr.number } });
    if (runtime.postReviewComment) {
      const comment = await fetch(pr.comments_url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${githubToken}`,
          accept: "application/vnd.github+json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ body: `## Automated review\n${summary}` }),
      });
      if (!comment.ok) throw new Error(`GitHub comment HTTP ${comment.status}`);
    }
    try {
      await notifyReview(
        payload.repository.full_name,
        pr.number,
        pr.html_url,
        findings,
        runtime,
      );
    } catch {
      await retryQueue.enqueue("notification", {
        repository: payload.repository.full_name,
        number: pr.number,
        url: pr.html_url,
        findings,
        settings: runtime,
      });
    }
    if (deliveryId) await deliveries.mark(deliveryId);
    res.json({ received: true, findings: findings.length, status });
  } catch (error) {
    next(error);
  }
});
