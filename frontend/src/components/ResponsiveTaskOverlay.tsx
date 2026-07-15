import { useEffect, useRef, type ReactNode, type RefObject } from "react";
type Props = { open: boolean; label: string; onClose: () => void; children: ReactNode; footer?: ReactNode; openerRef?: RefObject<HTMLElement | null>; className?: string };
export function ResponsiveTaskOverlay({ open, label, onClose, children, footer, openerRef, className = "" }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; panelRef.current?.focus(); const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; document.addEventListener("keydown", key); return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", key); openerRef?.current?.focus(); }; }, [open, onClose, openerRef]);
  if (!open) return null;
  return <div className="task-sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} className={`task-sheet ${className}`}><div className="task-sheet__header"><h2>{label}</h2><button type="button" className="btn-close-icon" aria-label="Đóng" onClick={onClose}>×</button></div><div className="task-sheet__content">{children}</div>{footer && <div className="task-sheet__footer">{footer}</div>}</div></div>;
}
