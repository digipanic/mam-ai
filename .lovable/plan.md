# Additional audience intelligence

## Proposed additions

1. **Roster health**
   - Show the share of artists with a valid Instagram comparison, SoundCloud observation, Resident Advisor observation, and recorded monthly history.
   - Keep missing information as `—`, with no substituted values.

2. **Monthly pace and consistency**
   - Add a monthly net follower-change view for the roster and a median artist change per recorded month.
   - Add an artist consistency label based only on valid recorded month-to-month changes: consistently growing, mixed, or limited history.

3. **Current vs. longer-term movement**
   - Add a neutral matrix that compares the current August-to-latest-month Instagram change with earliest-to-latest monthly growth.
   - Highlight only factual combinations such as current growth with longer-term growth, or current decline after longer-term growth; no causal language.

4. **Platform-specific coverage and leaders**
   - Expand separate Instagram, SoundCloud, and Resident Advisor leaderboards with observation dates and coverage counts.
   - Add platform availability filters to identify artists with profile data on one, two, or all three platforms—never a combined audience total.

5. **More actionable ranking views**
   - Add percentile/median context to current Instagram, exact-period gain, and growth rankings.
   - Add a “new high” marker only where the latest Instagram monthly observation exceeds every prior valid monthly value.

6. **Insights enhancements**
   - Add a data-driven “above roster median growth” list and a “below roster median audience with above-median growth” list, labelled as a factual screen rather than a prediction.
   - Add monthly acceleration/decline coverage counts, keeping the existing deterministic tolerance rule visible in a tooltip.

## Guardrails

- Continue reading the connected sheet as the live source and derive all new views from the normalized response.
- Preserve exact observation and month labels; future rows and months appear automatically.
- Keep Instagram, SoundCloud, and Resident Advisor separate throughout.
- Do not expose internal collection details, source-provider information, formulas, or data-quality notes.

## Technical details

- Extend the existing client-side selector layer with null-safe coverage, monthly-change, consistency, percentile, and record-high calculations.
- Reuse the existing React Query refresh/cache behavior and chart styling; no extra sheet requests per view.
- Add the views to Pulse, Rankings, and Insights where they support the existing workflows without duplicating the Monthly History or Artist pages.
