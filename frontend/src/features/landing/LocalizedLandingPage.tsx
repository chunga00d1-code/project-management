import { useState } from "react";
import { LandingPage } from "./LandingPage";
import { VietnameseLandingPage } from "./VietnameseLandingPage";
import { LandingShell } from "./LandingShell";
import "./landing-experience.css";

type Locale = "en" | "vi";
export function LocalizedLandingPage({ onLogin }: { onLogin: () => void }) {
  const [locale, setLocale] = useState<Locale>(() => { const saved = localStorage.getItem("project-flow-language"); if (saved === "en" || saved === "vi") return saved; return navigator.language.toLowerCase().startsWith("vi") ? "vi" : "en"; });
  const selectLocale = (value: Locale) => { localStorage.setItem("project-flow-language", value); document.documentElement.lang = value; setLocale(value); };
  return <LandingShell locale={locale} onLocale={selectLocale} onLogin={onLogin}>{locale === "vi" ? <VietnameseLandingPage onLogin={onLogin}/> : <LandingPage onLogin={onLogin}/>}</LandingShell>;
}
