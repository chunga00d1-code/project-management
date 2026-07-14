import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

type BoxProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode };
type PageContainerProps = HTMLAttributes<HTMLElement> & { children: ReactNode };
const join = (...names: Array<string | undefined>) => names.filter(Boolean).join(" ");

export function PageContainer({ className, ...props }: PageContainerProps) { return <main className={join("page-container", className)} {...props} />; }
export function Stack({ className, ...props }: BoxProps) { return <div className={join("stack", className)} {...props} />; }
export function Cluster({ className, ...props }: BoxProps) { return <div className={join("cluster", className)} {...props} />; }
export function FormGrid({ className, ...props }: BoxProps) { return <div className={join("form-grid", className)} {...props} />; }
export function ActionBar({ className, ...props }: BoxProps) { return <div className={join("action-bar", className)} {...props} />; }

export function ResponsiveGrid({ minItemWidth = "12rem", className, style, ...props }: BoxProps & { minItemWidth?: string }) {
  return <div className={join("responsive-grid", className)} style={{ ...style, "--grid-min": minItemWidth } as CSSProperties} {...props} />;
}

type PageHeaderProps = HTMLAttributes<HTMLElement> & { title: string; description?: string; actions?: ReactNode };

export function PageHeader({ title, description, actions, className, ...props }: PageHeaderProps) {
  return <header className={join("page-header", className)} {...props}><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-header__actions" role="group" aria-label="Thao tác trang">{actions}</div>}</header>;
}
