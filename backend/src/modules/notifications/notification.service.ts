import nodemailer from "nodemailer";
import type { RuntimeSettings } from "../settings/settings.service.js";
import type { Finding } from "../reviews/review.service.js";
import type { TaskModel } from "../tasks/task.model.js";
export async function notifyReview(
  repository: string,
  number: number,
  url: string,
  findings: Finding[],
  settings: RuntimeSettings = {},
) {
  const text = `PR ${repository} #${number}\n${url}\n${findings.map((f) => `[${f.severity}] ${f.file}: ${f.message}`).join("\n") || "No findings"}`;
  const jobs: Promise<unknown>[] = [];
  if (
    (settings.telegramToken) &&
    (settings.telegramChatId)
  )
    jobs.push(
      fetch(
        `https://api.telegram.org/bot${settings.telegramToken}/sendMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: settings.telegramChatId,
            text,
          }),
        },
      ),
    );
  await Promise.all(jobs);
}
export async function notifyMismatch(
  taskCode: string,
  repository: string,
  number: number,
  url: string,
  reasons: string[],
  settings: RuntimeSettings = {},
) {
  const text = `Task ${taskCode} mismatch on PR ${repository} #${number}\n${url}\n${reasons.map((r) => `- ${r}`).join("\n")}`;
  const jobs: Promise<unknown>[] = [];
  if (
    (settings.telegramToken) &&
    (settings.telegramChatId)
  )
    jobs.push(
      fetch(
        `https://api.telegram.org/bot${settings.telegramToken}/sendMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: settings.telegramChatId,
            text,
          }),
        },
      ),
    );
  await Promise.all(jobs);
}
export async function notifyTaskAssignment(
  task: TaskModel,
  toEmail: string,
  settings: RuntimeSettings = {},
) {
  if (!(settings.smtpHost) || !(settings.emailFrom)) return;
  const due = task.dueAt || task.dueDate;
  const text = [
    `Bạn được giao Task ${task.code}: ${task.title}`,
    `Độ ưu tiên: ${task.priority}`,
    due ? `Hạn: ${due}` : undefined,
    task.description ? `\n${task.description}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
  await nodemailer
    .createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      auth:
        settings.smtpUser
          ? {
              user: settings.smtpUser,
              pass: settings.smtpPassword,
            }
          : undefined,
    })
    .sendMail({
      from: settings.emailFrom,
      to: toEmail,
      subject: `Bạn được giao Task ${task.code}: ${task.title}`,
      text,
    });
}
