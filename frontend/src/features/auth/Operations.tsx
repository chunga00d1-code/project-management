import { useEffect, useState } from "react";
import { api } from "../../api/client";
type Audit = { _id: string; at: string; actor?: string; action: string; target: string };
type Dead = { _id: string; type: string; attempts: number; lastError?: string; payload: { repository: string; number: number } };
export function Operations() {
  const [audit, setAudit] = useState<Audit[]>([]); const [jobs, setJobs] = useState<Dead[]>([]); const [error, setError] = useState("");
  const load = () => Promise.all([api<{ items: Audit[] }>("/operations/audit"), api<Dead[]>("/operations/dead-letter")]).then(([a, j]) => { setAudit(a.items); setJobs(j); }).catch((e: Error) => setError(e.message));
  useEffect(() => { void load(); }, []);
  return <main><h2>Operations</h2><p>{error}</p><h3>Failed jobs</h3><ul>{jobs.map((job) => <li key={job._id}>{job.type} · {job.payload.repository} #{job.payload.number} · attempts: {job.attempts} <button onClick={async () => { await api(`/operations/dead-letter/${job._id}/retry`, { method: "POST" }); void load(); }}>Retry</button></li>)}</ul><h3>Audit log</h3><ul>{audit.map((item) => <li key={item._id}>{new Date(item.at).toLocaleString()} · {item.actor || "system"} · {item.action} · {item.target}</li>)}</ul></main>;
}
