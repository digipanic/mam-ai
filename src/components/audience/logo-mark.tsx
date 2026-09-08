// Minor AM's actual mark (the same pinwheel already used as the browser
// favicon) recolored via a CSS mask instead of rendered as a flat image, so
// it stays legible against both the light and dark theme backgrounds — the
// source asset's pale sage tone nearly disappears against the light theme's
// cream background otherwise.
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-hidden="true"
      className={className}
      style={{
        display: "inline-block",
        backgroundColor: "var(--primary)",
        WebkitMaskImage: "url(/favicon.png)",
        maskImage: "url(/favicon.png)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}
