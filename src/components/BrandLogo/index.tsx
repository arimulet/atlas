interface BrandLogoProps {
  variant?: "header" | "auth";
}

export function BrandLogo({ variant = "header" }: BrandLogoProps) {
  return (
    <div className={`atlas-brand-logo atlas-brand-logo--${variant}`} role="img" aria-label="ATLAS">
      <svg
        aria-hidden="true"
        className="atlas-brand-logo__symbol"
        focusable="false"
        viewBox="0 0 48 48"
      >
        <circle cx="8" cy="36" r="3.5" fill="currentColor" />
        <path d="M8 36H17.5L28 11L40 36H34L28 23" />
      </svg>
      <span aria-hidden="true" className="atlas-brand-logo__wordmark">
        ATLAS
      </span>
    </div>
  );
}
