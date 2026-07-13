const baseUrl = process.env.BASE_URL || "http://127.0.0.1:2000";
const cookie = process.env.COOKIE || "";
const connections = Math.max(1, Number(process.env.CONNECTIONS || 1));
const durationMs = Math.max(3000, Number(process.env.DURATION_MS || 10000));
if (!cookie) { console.error("COOKIE is required, for example: COOKIE='igen_refresh=...'"); process.exit(2); }
let opened = 0; let events = 0; const controllers = [];
async function connect() { const controller = new AbortController(); controllers.push(controller); const response = await fetch(`${baseUrl}/api/realtime/events`, { headers: { cookie, accept: "text/event-stream" }, signal: controller.signal }); if (!response.ok || !response.body) throw new Error(`SSE HTTP ${response.status}`); opened += 1; const reader = response.body.getReader(); const decoder = new TextDecoder(); try { while (true) { const { done, value } = await reader.read(); if (done) break; const text = decoder.decode(value, { stream: true }); events += (text.match(/^event:/gm) || []).length; } } catch (error) { if (error?.name !== "AbortError") throw error; } }
const runs = Array.from({ length: connections }, () => connect().catch((error) => { if (error?.name !== "AbortError") console.error(error.message); }));
setTimeout(() => controllers.forEach((controller) => controller.abort()), durationMs);
await Promise.all(runs);
console.log(JSON.stringify({ requestedConnections: connections, openedConnections: opened, events, durationMs }));
if (!opened) process.exit(1);
