import { type ReactNode, useEffect, useState } from "react";
import { CommandField } from "./CommandField";

type Locale = "en" | "vi";
const ids = ["landing-capabilities", "landing-workflow", "landing-security", "landing-pricing", "landing-faq"];
export function LandingShell({ children, locale, onLocale, onLogin }: { children: ReactNode; locale: Locale; onLocale: (value: Locale) => void; onLogin: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false); const [active, setActive] = useState("");
  useEffect(() => { const observer = new IntersectionObserver(entries => entries.forEach(entry => entry.isIntersecting && setActive(entry.target.id)), { rootMargin: "-35% 0px -55%" }); ids.forEach(id => { const el = document.getElementById(id); if (el) observer.observe(el); }); return () => observer.disconnect(); }, [locale]);
  const labels = locale === "vi" ? ["Sản phẩm","Quy trình","Bảo mật","Triển khai","Hỏi đáp"] : ["Product","Workflow","Security","Deployment","FAQ"];
  return <div className="pf-experience"><CommandField/><nav className="pf-premium-nav"><a className="pf-logo" href="#landing-hero"><b>P</b><span>PROJECT FLOW<small>PR REVIEW OPERATIONS</small></span></a><div className={`pf-nav-links ${mobileOpen ? "open" : ""}`}>{ids.map((id,i)=><a className={active===id?"active":""} key={id} href={`#${id}`} onClick={()=>setMobileOpen(false)}>{labels[i]}</a>)}</div><div className="pf-nav-actions"><div className="pf-language" aria-label="Language"><button className={locale==="en"?"active":""} onClick={()=>onLocale("en")}>EN</button><button className={locale==="vi"?"active":""} onClick={()=>onLocale("vi")}>VI</button></div><button className="pf-signin" onClick={onLogin}>{locale==="vi"?"Đăng nhập":"Sign in"}</button><button className="pf-menu" onClick={()=>setMobileOpen(!mobileOpen)} aria-expanded={mobileOpen}>{mobileOpen?"×":"☰"}</button></div></nav>{children}</div>;
}
