const token = () => localStorage.getItem("token");
async function request(url: string, options: RequestInit) { return fetch(`/api${url}`, { ...options, credentials: "same-origin", headers: { "content-type": "application/json", ...(token() ? { authorization: `Bearer ${token()}` } : {}), ...options.headers } }); }
export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  let response = await request(url, options);
  if (response.status === 401 && !["/auth/login", "/auth/refresh", "/auth/logout"].includes(url)) {
    const refreshed = await request("/auth/refresh", { method: "POST" });
    if (refreshed.ok) { const session = await refreshed.json() as { token: string; user: unknown }; localStorage.setItem("token", session.token); localStorage.setItem("user", JSON.stringify(session.user)); response = await request(url, options); }
    else { localStorage.removeItem("token"); localStorage.removeItem("user"); }
  }
  if (!response.ok) throw new Error(await response.text());
  return response.status === 204 ? (undefined as T) : response.json();
}
