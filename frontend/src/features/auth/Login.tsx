import { useState } from "react";
import { api } from "../../api/client";
import { ReviewGridLogo } from "../../components/brand/ReviewGridLogo";
type LoginResult = { token: string; user: { id: string; email: string; role: string } };
export function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await api<LoginResult>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("token", result.token);
      localStorage.setItem("user", JSON.stringify(result.user));
      onLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đăng nhập thất bại");
    }
  }
  return (
    <div className="login-wrapper">
      <form className="login-form" onSubmit={submit}>
        <ReviewGridLogo className="login-brand" showTagline />
        <h1>PR Review Operations</h1>
        <p style={{ textAlign: "center", color: "var(--text-secondary)", marginTop: "-0.5rem", marginBottom: "1rem" }}>
          Hệ thống quản lý task thông minh tích hợp GitHub
        </p>
        {error && <div className="error-message">{error}</div>}
        <input
          required
          type="email"
          placeholder="Tên đăng nhập (Email)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          required
          minLength={12}
          placeholder="Mật khẩu (Tối thiểu 12 ký tự)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn-primary">Đăng nhập</button>
      </form>
    </div>
  );
}
