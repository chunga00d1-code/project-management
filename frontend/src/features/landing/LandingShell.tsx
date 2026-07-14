import { type ReactNode, useEffect, useRef, useState } from "react";
import { CommandField } from "./CommandField";
import { ReviewGridLogo } from "../../components/brand/ReviewGridLogo";

type Locale = "en" | "vi";
const ids = ["landing-capabilities", "landing-workflow", "landing-security", "landing-pricing", "landing-faq"];

export function LandingShell({ children, locale, onLocale, onLogin }: { children: ReactNode; locale: Locale; onLocale: (value: Locale) => void; onLogin: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState("");
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(entry => entry.isIntersecting && setActive(entry.target.id)),
      { rootMargin: "-35% 0px -55%" },
    );
    ids.forEach(id => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [locale]);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        menuTriggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  const labels = locale === "vi"
    ? ["Sản phẩm", "Quy trình", "Bảo mật", "Triển khai", "Hỏi đáp"]
    : ["Product", "Workflow", "Security", "Deployment", "FAQ"];
  const signInLabel = locale === "vi" ? "Đăng nhập" : "Sign in";

  return (
    <div className="pf-experience">
      <CommandField />
      <nav className="pf-premium-nav" aria-label={locale === "vi" ? "Điều hướng chính" : "Primary navigation"}>
        <a className="pf-logo" href="#landing-hero"><ReviewGridLogo showTagline /></a>
        <div
          id="landing-navigation-menu"
          className={`pf-nav-links ${mobileOpen ? "open" : ""}`}
          role="region"
          aria-label={locale === "vi" ? "Menu điều hướng" : "Navigation menu"}
        >
          {ids.map((id, index) => (
            <a className={active === id ? "active" : ""} key={id} href={`#${id}`} onClick={() => setMobileOpen(false)}>
              {labels[index]}
            </a>
          ))}
          <button className="pf-mobile-signin" type="button" onClick={() => { setMobileOpen(false); onLogin(); }}>{signInLabel}</button>
        </div>
        <div className="pf-nav-actions">
          <div className="pf-language" aria-label={locale === "vi" ? "Ngôn ngữ" : "Language"}>
            <button type="button" className={locale === "en" ? "active" : ""} onClick={() => onLocale("en")}>EN</button>
            <button type="button" className={locale === "vi" ? "active" : ""} onClick={() => onLocale("vi")}>VI</button>
          </div>
          <button type="button" className="pf-signin" onClick={onLogin}>{signInLabel}</button>
          <button
            ref={menuTriggerRef}
            type="button"
            className="pf-menu"
            aria-label={mobileOpen ? (locale === "vi" ? "Đóng menu" : "Close menu") : (locale === "vi" ? "Mở menu" : "Open menu")}
            aria-controls="landing-navigation-menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(open => !open)}
          >
            <span aria-hidden="true">{mobileOpen ? "×" : "☰"}</span>
          </button>
        </div>
      </nav>
      {children}
    </div>
  );
}
