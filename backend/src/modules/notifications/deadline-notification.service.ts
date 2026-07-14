import nodemailer from "nodemailer";
import type { RuntimeSettings } from "../settings/settings.service.js";
export async function notifyTaskDeadline(input: { title: string; dueDate: string; phase: "due_tomorrow" | "due_today" | "overdue"; recipients: string[]; settings: RuntimeSettings }) {
  const label = input.phase === "overdue" ? "OVERDUE" : input.phase === "due_today" ? "DUE TODAY" : "DUE TOMORROW"; const text = `[${label}] ${input.title}\nDue date: ${input.dueDate}`; const jobs: Promise<unknown>[] = [];
  const telegramToken = input.settings.telegramToken; const telegramChatId = input.settings.telegramChatId;
  if (telegramToken && telegramChatId) jobs.push(fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: telegramChatId, text }) }).then((response) => { if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`); }));
  const smtpHost = input.settings.smtpHost; const from = input.settings.emailFrom; const configuredTo = input.settings.emailTo || ""; const to = [...new Set([...input.recipients, ...configuredTo.split(",").map((item) => item.trim()).filter(Boolean)])];
  if (smtpHost && from && to.length) jobs.push(nodemailer.createTransport({ host: smtpHost, port: input.settings.smtpPort, auth: input.settings.smtpUser ? { user: input.settings.smtpUser, pass: input.settings.smtpPassword } : undefined }).sendMail({ from, to, subject: `${label}: ${input.title}`, text }));
  await Promise.all(jobs);
}
