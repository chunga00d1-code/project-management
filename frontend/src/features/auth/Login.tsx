import { useState } from "react";
import { api } from "../../api/client";
export function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await api<{ token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("token", result.token);
      onLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    }
  }
  return (
    <form onSubmit={submit}>
      <h1>PR Review Tasks</h1>
      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button>Sign in</button>
      <p>{error}</p>
    </form>
  );
}
