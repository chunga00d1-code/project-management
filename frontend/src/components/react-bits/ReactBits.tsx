import { type CSSProperties, type ElementType, type ReactNode, useEffect, useRef, useState } from "react";
import "./react-bits.css";

export function AnimatedContent({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const node = ref.current; if (!node) return; const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { node.classList.add("rb-visible"); observer.disconnect(); } }, { threshold: .12 }); observer.observe(node); return () => observer.disconnect(); }, []);
  return <div ref={ref} className={`rb-animated ${className}`} style={{ "--rb-delay": `${delay}s` } as CSSProperties}>{children}</div>;
}

export function SpotlightCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return <div ref={ref} className={`rb-spotlight ${className}`} onPointerMove={(event) => { const rect = ref.current?.getBoundingClientRect(); if (!rect || !ref.current) return; ref.current.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`); ref.current.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`); }}>{children}</div>;
}

export function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null); const [value, setValue] = useState(0);
  useEffect(() => { const node = ref.current; if (!node) return; const observer = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) return; const started = performance.now(); const frame = (now: number) => { const progress = Math.min((now - started) / 1200, 1); setValue(to * (1 - Math.pow(1 - progress, 3))); if (progress < 1) requestAnimationFrame(frame); }; requestAnimationFrame(frame); observer.disconnect(); }); observer.observe(node); return () => observer.disconnect(); }, [to]);
  return <span ref={ref}>{Number.isInteger(to) ? Math.round(value) : value.toFixed(1)}{suffix}</span>;
}

export function ShinyText({ children }: { children: ReactNode }) { return <span className="rb-shiny">{children}</span>; }

export function StarBorder({ children, as: Component = "button", className = "", ...props }: { children: ReactNode; as?: ElementType; className?: string; [key: string]: unknown }) {
  return <Component className={`rb-star ${className}`} {...props}><span>{children}</span></Component>;
}
