import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useIsMobileLayout } from "../../hooks/useMediaQuery";

export type OverlayProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function Overlay({ open, title, onClose, children, footer, initialFocusRef }: OverlayProps) {
  const isMobile = useIsMobileLayout();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const initialFocusRefRef = useRef(initialFocusRef);
  onCloseRef.current = onClose;
  initialFocusRefRef.current = initialFocusRef;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (initialFocusRefRef.current?.current ?? closeRef.current ?? dialogRef.current)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []).filter((element) => {
        if (element instanceof HTMLInputElement && element.type === "hidden") return false;
        for (let node: HTMLElement | null = element; node && node !== dialogRef.current; node = node.parentElement) {
          const style = window.getComputedStyle(node);
          if (node.hidden || node.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden") return false;
        }
        return true;
      });
      if (!focusable.length) { event.preventDefault(); dialogRef.current?.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="overlay-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCloseRef.current(); }}>
      <div
        ref={dialogRef}
        className={`overlay ${isMobile ? "overlay--sheet" : "overlay--modal"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="overlay__header">
          <h2 id={titleId}>{title}</h2>
          <button ref={closeRef} type="button" className="overlay__close" aria-label="Close" onClick={() => onCloseRef.current()}>Ã—</button>
        </header>
        <div className="overlay__body">{children}</div>
        {footer && <footer className="overlay__footer action-bar action-bar--sticky">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

