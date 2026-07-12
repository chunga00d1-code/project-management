import { z } from "zod";
export const updateSettingsSchema = z.object({
  telegramToken: z.string().max(500).optional(),
  telegramChatId: z.string().max(200).optional(),
  smtpHost: z.string().max(200).optional(),
  smtpPort: z.number().int().positive().max(65535).optional(),
  smtpUser: z.string().max(200).optional(),
  smtpPassword: z.string().max(500).optional(),
  emailFrom: z.string().email().optional(),
  emailTo: z.string().email().optional(),
  blockingSeverities: z.array(z.string().max(50)).max(20).optional(),
  postReviewComment: z.boolean().optional(),
  githubAssigneeMappings: z.string().max(10000).optional(),
});
