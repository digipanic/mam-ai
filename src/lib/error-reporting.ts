// Client-side error boundary hook. Replaces the previous Lovable editor
// telemetry forwarder (window.__lovableEvents) — errors are simply logged so
// they still surface in the browser console and hosting provider's logs.
export function reportBoundaryError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("[error-boundary]", error, { route: window.location.pathname, ...context });
}
