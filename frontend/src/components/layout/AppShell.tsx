import { useEffect, useRef, useState, type ReactNode } from "react";
import { useIsDrawerLayout } from "../../hooks/useMediaQuery";
import { ReviewGridLogo } from "../brand/ReviewGridLogo";

export type AppNavItem<PageId extends string> = { id: PageId; label: string; icon: string };
export type AppShellProps<PageId extends string> = { items: AppNavItem<PageId>[]; activePage: PageId; onNavigate: (page: PageId) => void; user: { email?: string; role?: string }; onSignOut: () => void; children: ReactNode };
const focusableSelector = ["a[href]", "button:not([disabled])", "input:not([disabled])", "select:not([disabled])", "textarea:not([disabled])", '[tabindex]:not([tabindex="-1"])'].join(",");

export function AppShell<PageId extends string>({ items, activePage, onNavigate, user, onSignOut, children }: AppShellProps<PageId>) {
  const isDrawerLayout = useIsDrawerLayout();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLButtonElement>(".app-drawer__close")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setDrawerOpen(false); return; }
      if (event.key !== "Tab") return;
      const focusable = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (!drawerRef.current?.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("keydown", handleKeyDown); document.body.style.overflow = previousOverflow; triggerRef.current?.focus(); };
  }, [drawerOpen]);
  useEffect(() => { if (!isDrawerLayout) setDrawerOpen(false); }, [isDrawerLayout]);
  const navigate = (page: PageId) => { onNavigate(page); setDrawerOpen(false); };
  const navigationContent = <>
    <div className="brand"><ReviewGridLogo showTagline /></div>
    <div className="nav-group">{items.map((item) => <button key={item.id} className={activePage === item.id ? "active" : ""} aria-current={activePage === item.id ? "page" : undefined} onClick={() => navigate(item.id)}><span className="nav-icon" aria-hidden="true">{item.icon}</span>{item.label}</button>)}</div>
    <div className="sidebar-footer"><div className="user-chip"><span className="avatar">{(user.email || "U").charAt(0).toUpperCase()}</span><span><strong>{user.email || "Người dùng"}</strong><small>{user.role || "member"}</small></span></div><button className="sign-out" onClick={onSignOut}><span className="nav-icon" aria-hidden="true">↪</span>Đăng xuất</button></div>
  </>;
  return <div className="app-shell">
    {isDrawerLayout ? <><header className="mobile-app-header"><span aria-hidden="true"><ReviewGridLogo compact /></span><button ref={triggerRef} type="button" aria-label="Mở điều hướng" aria-expanded={drawerOpen} aria-controls="app-navigation-drawer" onClick={() => setDrawerOpen(true)}>☰</button></header>{drawerOpen && <><div className="app-drawer-backdrop" aria-hidden="true" onClick={() => setDrawerOpen(false)} /><div id="app-navigation-drawer" ref={drawerRef} className="app-drawer" role="dialog" aria-modal="true" aria-label="Điều hướng chính"><button className="app-drawer__close" type="button" aria-label="Đóng điều hướng" onClick={() => setDrawerOpen(false)}>×</button><nav className="sidebar" aria-label="Điều hướng chính">{navigationContent}</nav></div></>}</> : <nav className="sidebar desktop-sidebar" aria-label="Điều hướng chính">{navigationContent}</nav>}
    <div className="app-shell__content" role="region" aria-label="Nội dung chính">{children}</div>
  </div>;
}
