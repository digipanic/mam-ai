# Add Monthly Context to Pulse

## Goal
Make Pulse show the recorded month-by-month Instagram story alongside the current exact-observation movement, so the executive overview is useful at both short and longer time horizons.

## Changes
1. Add a monthly Instagram overview to Pulse using the already-normalized recorded history for every artist.
   - Show a roster-level monthly trend across all available months.
   - Clearly mark the current partial month when the source data identifies it.
   - Keep missing observations as gaps rather than filling them.

2. Add a compact longer-term momentum view to Pulse.
   - Surface leading artists by earliest-valid-month to latest-valid-month follower gain and percentage growth.
   - Display the actual start and end month used for each calculation.
   - Keep this distinct from the existing current exact-observation comparison.

3. Expand the factual Pulse insights with monthly signals derived from the same live data.
   - Largest longer-term follower gain.
   - Strongest longer-term percentage growth.
   - Recent monthly acceleration, deceleration, or stable momentum only when enough consecutive monthly observations exist.
   - Preserve neutral language and omit a signal when the data is incomplete.

4. Improve the Pulse hierarchy so the two time horizons are clear.
   - Current movement: exact recent Instagram observation dates and values.
   - Monthly development: recorded month-to-month history.
   - Continue to keep Instagram, SoundCloud, and Resident Advisor separate.

5. Keep the existing live refresh and graceful fallback behavior. New monthly rows in the connected sheet will flow into Pulse automatically through the current normalized data response.

## Insight opportunities available from the current data
- Roster-wide monthly Instagram trend and median monthly change.
- Long-term leaders by gain and percentage growth.
- Recent momentum classification from consecutive monthly changes.
- Artists showing a current-period move that differs from their longer-term recorded trend.
- Platform leaderboards (Instagram, SoundCloud, Resident Advisor) with their individual observation dates.
- Coverage indicators showing where a platform or monthly observation is genuinely unavailable, without turning blanks into zero.

## Technical details
- Reuse the live `Monthly Historical Followers` data already fetched and normalized by the server-side data adapter.
- Add selectors for valid adjacent-month changes, earliest-to-latest monthly growth, and momentum classification; calculate them from available observations only.
- Add focused Pulse chart and insight components without changing the source connection or using generic “1M” fields.