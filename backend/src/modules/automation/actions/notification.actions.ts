import type { ActionAdapter } from "../action-registry.js";

export interface NotificationActionPort {
  send(channel: string, message: string, idempotencyKey: string): Promise<{ messageId: string }>;
  sendCorrection(originalMessageId: string, message: string, idempotencyKey: string): Promise<void>;
}

export function createNotificationActions({ notifications }: { notifications: NotificationActionPort }): ActionAdapter[] {
  const notification: ActionAdapter = {
    type: "notification.send",
    sensitive: false,
    validate(config) {
      const unknown = Object.keys(config).find(key => !["channel", "message"].includes(key));
      if (unknown) throw new Error(`Unknown config key: ${unknown}`);
      if (typeof config.channel !== "string" || !/^[A-Za-z0-9_.:#@/-]{1,128}$/.test(config.channel)) throw new Error("Invalid notification channel");
      if (typeof config.message !== "string" || config.message.trim().length === 0 || config.message.length > 10_000) throw new Error("Invalid notification message");
    },
    async preview(config) {
      this.validate(config);
      return { channel: config.channel, message: config.message };
    },
    async execute(config, context) {
      this.validate(config);
      return notifications.send(String(config.channel), String(config.message), context.idempotencyKey);
    },
    async compensate(_config, result, context) {
      if (typeof result.messageId !== "string" || result.messageId.length === 0) throw new Error("Invalid original message ID");
      await notifications.sendCorrection(result.messageId, "Automation rollback: disregard the original message.", context.idempotencyKey);
      return { corrected: true };
    },
  };
  return [notification];
}
