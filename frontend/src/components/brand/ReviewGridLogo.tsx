import "./reviewgrid-brand.css";

type ReviewGridLogoProps = {
  className?: string;
  compact?: boolean;
  showTagline?: boolean;
};

export function ReviewGridLogo({ className = "", compact = false, showTagline = false }: ReviewGridLogoProps) {
  return (
    <span className={`reviewgrid-logo${compact ? " reviewgrid-logo--compact" : ""} ${className}`.trim()} aria-label="ReviewGrid — See risk. Review clearly.">
      <svg className="reviewgrid-beacon" viewBox="0 0 48 48" aria-hidden="true">
        <rect x="1" y="1" width="46" height="46" rx="13" fill="currentColor" />
        <circle cx="24" cy="24" r="14" className="reviewgrid-beacon__ring" />
        <circle cx="24" cy="24" r="8" className="reviewgrid-beacon__ring reviewgrid-beacon__ring--inner" />
        <path className="reviewgrid-beacon__axis" d="M24 7v7M24 34v7M7 24h7M34 24h7" />
        <path className="reviewgrid-beacon__check" d="m18.5 24.5 3.4 3.5 7.8-8" />
      </svg>
      {!compact && <span className="reviewgrid-logo__copy"><strong>Review<span>Grid</span></strong>{showTagline && <small>See risk. Review clearly.</small>}</span>}
    </span>
  );
}
