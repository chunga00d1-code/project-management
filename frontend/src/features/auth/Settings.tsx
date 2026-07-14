import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { ActionBar, FormGrid, PageContainer, PageHeader } from "../../components/layout/PageLayout";
type Settings = {
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
};
export function Settings() {
  const [value, setValue] = useState<Settings>({});
  const [message, setMessage] = useState("");
  
  useEffect(() => {
    void api<Settings>("/settings").then(setValue);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/settings", {
        method: "PUT",
        body: JSON.stringify({
          ...value,
          blockingSeverities: Array.isArray(value.blockingSeverities)
            ? value.blockingSeverities
            : String(value.blockingSeverities || "").split(",").map(x => x.trim()).filter(Boolean),
        }),
      });
      setMessage("Cấu hình đã được lưu thành công!");
    } catch (err) {
      setMessage(`Lưu cấu hình thất bại: ${err instanceof Error ? err.message : String(err)}`);
    }
    setTimeout(() => setMessage(""), 3000);
  }

  return (
    <PageContainer>
      <PageHeader title="Cấu Hình Hệ Thống" />

      <form className="settings-form" onSubmit={save}>
        
        {/* Section 1: Telegram Notifications */}
        <section className="settings-section">
          <h2>
            📢 Thông báo Telegram
          </h2>
          <FormGrid>
            <div>
              <label htmlFor="telegram-token">Telegram Bot Token</label>
              <input
                id="telegram-token"
                type="password"
                placeholder="Nhập bot token từ @BotFather..."
                value={value.telegramToken || ""}
                onChange={(e) => setValue({ ...value, telegramToken: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="telegram-chat-id">Telegram Chat ID</label>
              <input
                id="telegram-chat-id"
                placeholder="Nhập chat ID hoặc group ID..."
                value={value.telegramChatId || ""}
                onChange={(e) => setValue({ ...value, telegramChatId: e.target.value })}
              />
            </div>
          </FormGrid>
        </section>

        {/* Section 2: Email & SMTP */}
        <section className="settings-section">
          <h2>
            📧 Cấu hình SMTP Email
          </h2>
          <FormGrid>
            <div>
              <label htmlFor="smtp-host">SMTP Host</label>
              <input
                id="smtp-host"
                placeholder="VD: smtp.gmail.com"
                value={value.smtpHost || ""}
                onChange={(e) => setValue({ ...value, smtpHost: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="smtp-port">SMTP Port</label>
              <input
                id="smtp-port"
                type="number"
                placeholder="VD: 587 hoặc 465"
                value={value.smtpPort || ""}
                onChange={(e) => setValue({ ...value, smtpPort: Number(e.target.value) })}
              />
            </div>
          </FormGrid>
          <FormGrid>
            <div>
              <label htmlFor="smtp-user">SMTP User (Email)</label>
              <input
                id="smtp-user"
                type="email"
                placeholder="Email đăng nhập SMTP..."
                value={value.smtpUser || ""}
                onChange={(e) => setValue({ ...value, smtpUser: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="smtp-password">SMTP Password</label>
              <input
                id="smtp-password"
                type="password"
                placeholder="Mật khẩu SMTP/App password..."
                value={value.smtpPassword || ""}
                onChange={(e) => setValue({ ...value, smtpPassword: e.target.value })}
              />
            </div>
          </FormGrid>
          <FormGrid>
            <div>
              <label htmlFor="email-from">Email gửi đi (Sender)</label>
              <input
                id="email-from"
                placeholder="VD: no-reply@company.com"
                value={value.emailFrom || ""}
                onChange={(e) => setValue({ ...value, emailFrom: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="email-to">Email nhận thông báo</label>
              <input
                id="email-to"
                placeholder="Email nhận các báo cáo cảnh báo..."
                value={value.emailTo || ""}
                onChange={(e) => setValue({ ...value, emailTo: e.target.value })}
              />
            </div>
          </FormGrid>
        </section>
        <ActionBar className="action-bar--sticky">{message && <div className="pill active" role={message.includes("thất bại") ? "alert" : "status"}>{message}</div>}<button className="btn-primary">💾 Lưu cấu hình</button></ActionBar>
      </form>
    </PageContainer>
  );
}
