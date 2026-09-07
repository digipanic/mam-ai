// Lightweight inline mark, replacing the former Lovable-hosted PNG (served
// from their CDN, unreachable once the app runs outside Lovable's platform).
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" role="img" aria-hidden="true" className={className}>
      <rect x="0.5" y="0.5" width="39" height="39" rx="9.5" fill="var(--primary)" />
      <text
        x="50%"
        y="54%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--primary-foreground)"
        fontFamily="ui-serif, Georgia, serif"
        fontSize="20"
      >
        M
      </text>
    </svg>
  );
}
