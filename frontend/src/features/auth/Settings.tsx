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
        blockingSeverities: String(value.blockingSeverities || "").split(","),
      }),
    });
    setMessage("Saved");
  }
  return (
    <form onSubmit={save}>
      <h2>Settings</h2>
      <input
        placeholder="Telegram chat ID"
        value={value.telegramChatId || ""}
        onChange={(e) => setValue({ ...value, telegramChatId: e.target.value })}
      />
      <input
        placeholder="SMTP host"
        value={value.smtpHost || ""}
        onChange={(e) => setValue({ ...value, smtpHost: e.target.value })}
      />
      <input
        placeholder="Email To"
        value={value.emailTo || ""}
        onChange={(e) => setValue({ ...value, emailTo: e.target.value })}
      />
      <input
        placeholder="Blocking severity: critical,high"
        value={
          Array.isArray(value.blockingSeverities)
            ? value.blockingSeverities.join(",")
            : ""
        }
        onChange={(e) =>
          setValue({ ...value, blockingSeverities: e.target.value.split(",") })
        }
      />
      <textarea
        placeholder="github-user=assignee"
        value={value.githubAssigneeMappings || ""}
        onChange={(e) =>
          setValue({ ...value, githubAssigneeMappings: e.target.value })
        }
      />
      <label>
        <input
          type="checkbox"
          checked={Boolean(value.postReviewComment)}
          onChange={(e) =>
            setValue({ ...value, postReviewComment: e.target.checked })
          }
        />{" "}
        Post review to GitHub PR
      </label>
      <button>Save</button>
      <p>{message}</p>
    </form>
  );
}
