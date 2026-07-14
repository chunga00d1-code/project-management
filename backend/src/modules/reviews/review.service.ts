import crypto from "crypto";
import { env } from "../../config/env.js";
export interface Finding {
  severity: "critical" | "high" | "medium" | "low";
  file: string;
  message: string;
  recommendation?: string;
}
export function verifySignature(body: Buffer, header: string | undefined) {
  if (!header?.startsWith("sha256=")) return false;
  const value = `sha256=${crypto.createHmac("sha256", env.githubWebhookSecret).update(body).digest("hex")}`;
  const expected = Buffer.from(value);
  const actual = Buffer.from(header);
  return (
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual)
  );
}
export interface TaskContext {
  title: string;
  description?: string;
}
export interface TaskAlignment {
  matches: boolean;
  reason: string;
}
export interface ReviewResult {
  findings: Finding[];
  taskAlignment?: TaskAlignment;
}
export async function reviewDiff(
  files: { filename: string; patch?: string }[],
  task?: TaskContext,
): Promise<ReviewResult> {
  const rules: [RegExp, Finding["severity"], string][] = [
    [/AKIA[0-9A-Z]{16}/, "critical", "AWS key detected"],
    [/-----BEGIN .*PRIVATE KEY-----/, "critical", "Private key detected"],
    [/console\.log|debugger/, "low", "Debug statement"],
  ];
  const findings: Finding[] = [];
  for (const file of files)
    for (const rule of rules)
      if (rule[0].test(file.patch || ""))
        findings.push({
          severity: rule[1],
          file: file.filename,
          message: rule[2],
        });
  if (!env.llmEnabled) return { findings };
  if (!env.llmUrl || !env.llmKey || !env.llmModel)
    throw new Error("LLM configuration is incomplete");
  const diff = files
    .slice(0, 30)
    .map((f) => `${f.filename}\n${f.patch || ""}`)
    .join("\n")
    .slice(0, 60000);
  const taskPrompt = task
    ? `Task being implemented:\nTitle: ${task.title}\nDescription: ${task.description || "(none)"}\n\nReview this PR diff, and assess whether the changes actually implement what the task above describes:\n${diff}`
    : `Review this PR diff:\n${diff}`;
  const response = await fetch(env.llmUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.llmKey}`,
    },
    body: JSON.stringify({
      model: env.llmModel,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: task
            ? "Return JSON only: {findings:[{severity,file,message,recommendation}], taskAlignment:{matches:boolean,reason:string}}"
            : "Return JSON only: {findings:[{severity,file,message,recommendation}]}",
        },
        { role: "user", content: taskPrompt },
      ],
    }),
  });
  if (!response.ok) throw new Error(`LLM HTTP ${response.status}`);
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  try {
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    return {
      findings: [...findings, ...(parsed.findings || [])],
      taskAlignment: task ? parsed.taskAlignment : undefined,
    };
  } catch {
    return { findings };
  }
}
