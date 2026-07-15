import type { ActionAdapter } from "../action-registry.js";

export interface ReviewerSnapshot {
  users: string[];
  teams: string[];
}

export interface GithubActionPort {
  applyReviewers(
    repository: string,
    number: number,
    reviewers: string[],
    teams: string[],
    idempotencyKey: string,
  ): Promise<{ previous: ReviewerSnapshot }>;
  restoreReviewers(
    repository: string,
    number: number,
    previous: ReviewerSnapshot,
    idempotencyKey: string,
  ): Promise<void>;
  addComment(repository: string, number: number, body: string, idempotencyKey: string): Promise<{ commentId: string }>;
  deleteComment(repository: string, commentId: string, idempotencyKey: string): Promise<void>;
  editComment(repository: string, commentId: string, body: string, idempotencyKey: string): Promise<void>;
  addCorrection(repository: string, number: number, originalCommentId: string, body: string, idempotencyKey: string): Promise<void>;
}

const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const loginPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

function validateTarget(config: Record<string, unknown>, allowed: string[]): void {
  const unknown = Object.keys(config).find(key => !allowed.includes(key));
  if (unknown) throw new Error(`Unknown config key: ${unknown}`);
  if (typeof config.repository !== "string" || !repositoryPattern.test(config.repository)) throw new Error("Invalid GitHub repository");
  const repositoryName = config.repository.split("/")[1];
  if (repositoryName === "." || repositoryName === "..") throw new Error("Invalid GitHub repository");
  if (!Number.isSafeInteger(config.number) || Number(config.number) <= 0) throw new Error("Invalid pull request number");
}

function validateNames(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== "string" || !loginPattern.test(item))) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}

export function createGithubActions({ github }: { github: GithubActionPort }): ActionAdapter[] {
  const reviewers: ActionAdapter = {
    type: "github.assign_reviewer",
    sensitive: true,
    validate(config) {
      validateTarget(config, ["repository", "number", "reviewers", "teams"]);
      validateNames(config.reviewers, "reviewers");
      if (config.teams !== undefined) validateNames(config.teams, "teams");
    },
    async preview(config) {
      this.validate(config);
      return { repository: config.repository, number: config.number, reviewers: config.reviewers, teams: config.teams ?? [] };
    },
    async execute(config, context) {
      this.validate(config);
      const result = await github.applyReviewers(
        String(config.repository),
        Number(config.number),
        config.reviewers as string[],
        (config.teams ?? []) as string[],
        context.idempotencyKey,
      );
      return { ...result, repository: config.repository, number: config.number };
    },
    async compensate(_config, result, context) {
      const previous = result.previous as unknown as ReviewerSnapshot;
      await github.restoreReviewers(
        String(result.repository),
        Number(result.number),
        previous,
        context.idempotencyKey,
      );
      return { restored: true };
    },
  };

  const comment: ActionAdapter = {
    type: "github.comment",
    sensitive: true,
    validate(config) {
      validateTarget(config, ["repository", "number", "body"]);
      if (typeof config.body !== "string" || config.body.trim().length === 0 || config.body.length > 65_536) throw new Error("Invalid comment body");
    },
    async preview(config) {
      this.validate(config);
      return { repository: config.repository, number: config.number, body: config.body };
    },
    async execute(config, context) {
      this.validate(config);
      return {
        ...(await github.addComment(String(config.repository), Number(config.number), String(config.body), context.idempotencyKey)),
        repository: config.repository,
        number: config.number,
      };
    },
    async compensate(_config, result, context) {
      const repository = String(result.repository);
      const commentId = String(result.commentId);
      try {
        await github.deleteComment(repository, commentId, context.idempotencyKey);
        return { deleted: true };
      } catch {
        try {
          await github.editComment(repository, commentId, "[Rolled back by automation]", context.idempotencyKey);
          return { edited: true };
        } catch {
          await github.addCorrection(repository, Number(result.number), commentId, "Automation rollback: disregard the referenced comment.", context.idempotencyKey);
          return { corrected: true };
        }
      }
    },
  };

  return [reviewers, comment];
}
