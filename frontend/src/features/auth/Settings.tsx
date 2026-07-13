import { useEffect, useState } from "react";
import { api } from "../../api/client";
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
    setTimeout(() => setMessage(""), 3000);
  }

  return (
    <main>
      <header>
        <h2>Cấu Hình Hệ Thống</h2>
      </header>

      {message && (
        <div className="pill active" style={{ alignSelf: "flex-start", padding: "0.5rem 1rem", marginBottom: "1rem" }}>
          {message}
        </div>
      )}

      <form className="project-card" style={{ maxWidth: "100%", display: "flex", flexDirection: "column", gap: "1.5rem" }} onSubmit={save}>
        
        {/* Section 1: Telegram Notifications */}
        <div>
          <h3 style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem", marginBottom: "1rem" }}>
            📢 Thông báo Telegram
          </h3>
          <div className="grid-2">
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>Telegram Bot Token</label>
              <input
                type="password"
                placeholder="Nhập bot token từ @BotFather..."
                value={value.telegramToken || ""}
                onChange={(e) => setValue({ ...value, telegramToken: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>Telegram Chat ID</label>
              <input
                placeholder="Nhập chat ID hoặc group ID..."
                value={value.telegramChatId || ""}
                onChange={(e) => setValue({ ...value, telegramChatId: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Email & SMTP */}
        <div>
          <h3 style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem", marginBottom: "1rem" }}>
            📧 Cấu hình SMTP Email
          </h3>
          <div className="grid-2">
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>SMTP Host</label>
              <input
                placeholder="VD: smtp.gmail.com"
                value={value.smtpHost || ""}
                onChange={(e) => setValue({ ...value, smtpHost: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>SMTP Port</label>
              <input
                type="number"
                placeholder="VD: 587 hoặc 465"
                value={value.smtpPort || ""}
                onChange={(e) => setValue({ ...value, smtpPort: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid-2" style={{ marginTop: "1rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>SMTP User (Email)</label>
              <input
                type="email"
                placeholder="Email đăng nhập SMTP..."
                value={value.smtpUser || ""}
                onChange={(e) => setValue({ ...value, smtpUser: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>SMTP Password</label>
              <input
                type="password"
                placeholder="Mật khẩu SMTP/App password..."
                value={value.smtpPassword || ""}
                onChange={(e) => setValue({ ...value, smtpPassword: e.target.value })}
              />
            </div>
          </div>
          <div className="grid-2" style={{ marginTop: "1rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>Email gửi đi (Sender)</label>
              <input
                placeholder="VD: no-reply@company.com"
                value={value.emailFrom || ""}
                onChange={(e) => setValue({ ...value, emailFrom: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>Email nhận thông báo</label>
              <input
                placeholder="Email nhận các báo cáo cảnh báo..."
                value={value.emailTo || ""}
                onChange={(e) => setValue({ ...value, emailTo: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Section 3: GitHub Integration Details */}
        <div>
          <h3 style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem", marginBottom: "1rem" }}>
            🐙 Tích hợp GitHub & Quy tắc
          </h3>
          <div className="grid-2">
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>
                Mức độ nghiêm trọng chặn PR (cách nhau bằng dấu phẩy)
              </label>
              <input
                placeholder="VD: critical,high"
                value={
                  Array.isArray(value.blockingSeverities)
                    ? value.blockingSeverities.join(",")
                    : ""
                }
                onChange={(e) =>
                  setValue({ ...value, blockingSeverities: e.target.value.split(",") })
                }
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>
                Ánh xạ Assignee trên GitHub sang Email hệ thống
              </label>
              <textarea
                placeholder="github-username=user@email.com (mỗi dòng một ánh xạ)"
                value={value.githubAssigneeMappings || ""}
                onChange={(e) =>
                  setValue({ ...value, githubAssigneeMappings: e.target.value })
                }
                style={{ minHeight: "80px" }}
              />
            </div>
          </div>
          <div style={{ marginTop: "1rem" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={Boolean(value.postReviewComment)}
                onChange={(e) =>
                  setValue({ ...value, postReviewComment: e.target.checked })
                }
                style={{ width: "1.2rem", height: "1.2rem", accentColor: "var(--primary-color)" }}
              />
              <span>Tự động viết bình luận rà duyệt (review comment) lên Pull Request trên GitHub</span>
            </label>
          </div>
        </div>

        <button className="btn-primary" style={{ alignSelf: "flex-end", width: "auto", padding: "0.75rem 2rem" }}>
          💾 Lưu cấu hình
        </button>
      </form>
    </main>
  );
}
