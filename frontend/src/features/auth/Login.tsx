import { useState } from "react";
import { api } from "../../api/client";
type LoginResult = { token: string; user: { id: string; email: string; role: string } };
export function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState("");
  async function submit(e: React.FormEvent) { e.preventDefault(); try { const result = await api<LoginResult>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); localStorage.setItem("token", result.token); localStorage.setItem("user", JSON.stringify(result.user)); onLogin(); } catch (e) { setError(e instanceof Error ? e.message : "Login failed"); } }
  return <form onSubmit={submit}><h1>PR Review Tasks</h1><input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} /><input required minLength={12} placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /><button>Sign in</button><p>{error}</p></form>;
}
