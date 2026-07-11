import { database } from "../../core/database.js";
export interface RuntimeSettings {
  telegramToken?: string;
  telegramChatId?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  emailFrom?: string;
  emailTo?: string;
  blockingSeverities?: string[];
  postReviewComment?: boolean;
  githubAssigneeMappings?: string;
}
const id = "runtime";
export class SettingsService {
  private async col() {
    return (await database()).collection<{
      _id: string;
      value: RuntimeSettings;
    }>("github_pr_settings");
  }
  async get() {
    return (await (await this.col()).findOne({ _id: id }))?.value || {};
  }
  async update(value: RuntimeSettings) {
    await (
      await this.col()
    ).updateOne({ _id: id }, { $set: { value } }, { upsert: true });
    return value;
  }
  async public() {
    const value = await this.get();
    return {
      ...value,
      telegramToken: "",
      smtpPassword: "",
      hasTelegramToken: Boolean(value.telegramToken),
      hasSmtpPassword: Boolean(value.smtpPassword),
    };
  }
}
