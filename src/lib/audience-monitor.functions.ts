import { createServerFn } from "@tanstack/react-start";
import type { AudienceMonitorData, ArtistRecord, MonthlyPoint, ObservationSource, PlatformMetric } from "@/lib/audience-types";

const SPREADSHEET_ID = "1ysF90fgjl5iMREIUn6AaJ0wVstRuRaTpZOT4a9RpoK4";
const SHEETS_BASE = "https://sheets.googleapis.com/v4";
type Cell = string | number | boolean | null | undefined;
type Row = Cell[];
type RecordRow = Record<string, Cell>;

const text = (value: Cell) => { const result = String(value ?? "").trim(); return result && result !== "—" ? result : null; };
const number = (value: Cell) => { if (value === "" || value === null || value === undefined) return null; const result = typeof value === "number" ? value : Number(value); return Number.isFinite(result) ? result : null; };
const keyedRows = (rows: Row[]): RecordRow[] => { const [headers, ...body] = rows; return headers ? body.map((row) => Object.fromEntries(headers.map((header, index) => [String(header), row[index]]))) : []; };

// Some historical rows (chiefly Modash exports) only ever recorded a calendar
// month, never a day. Turning "August 2026" into "2026-08-01" would invent a
// checkpoint date the source never claimed, so month-only values are kept as
// bare "YYYY-MM" strings end to end (sorting, bucketing, display all treat that
// shape as a first-class case instead of promoting it to a fake full date).
const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const monthOnly = (raw: string): string | null => {
  const isoMonth = /^(\d{4})-(\d{2})$/.exec(raw);
  if (isoMonth) return `${isoMonth[1]}-${isoMonth[2]}`;
  const nameMonth = /^([A-Za-z]{3,9})[.\s-]+(\d{4})$/.exec(raw);
  if (!nameMonth) return null;
  const index = MONTH_NAMES.indexOf((nameMonth[1] ?? "").slice(0, 3).toLowerCase());
  return index >= 0 ? `${nameMonth[2]}-${String(index + 1).padStart(2, "0")}` : null;
};
const iso = (value: Cell): string | null => {
  const raw = text(value);
  if (!raw) return null;
  const normalized = raw.replace(" · ", " ");
  const month = monthOnly(normalized);
  if (month) return month;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? raw : new Date(parsed).toISOString();
};
type Observation = { value: number; at: string | null; source: ObservationSource };
// When two observations land on the exact same timestamp (e.g. a same-day
// Viberate refresh alongside a Minor AM scrape), Minor AM's own monitoring is
// the authoritative read — this is the tie-break, not array order.
const SOURCE_RANK: Record<ObservationSource, number> = { "Minor AM monitoring": 3, Viberate: 2, Modash: 1, "Historical checkpoint": 0 };
const latest = (items: Observation[]): PlatformMetric => {
  const valid = items.filter((item) => item.at && item.value !== null).sort((a, b) => {
    const byDate = Date.parse(a.at ?? "") - Date.parse(b.at ?? "");
    return byDate !== 0 ? byDate : SOURCE_RANK[a.source] - SOURCE_RANK[b.source];
  });
  const item = valid.at(-1);
  return { audience: item?.value ?? null, observedAt: item?.at ?? null, source: item?.source ?? null };
};
const sourceName = (value: string | null): ObservationSource => value?.toLowerCase().includes("modash") ? "Modash" : value?.toLowerCase().includes("viberate") ? "Viberate" : "Historical checkpoint";
// A bare "YYYY-MM" value is already a month key; only full timestamps need slicing.
const monthOf = (at: string) => /^\d{4}-\d{2}$/.test(at) ? at : (Number.isNaN(new Date(at).valueOf()) ? at.slice(0, 7) : new Date(at).toISOString().slice(0, 7));
// The "Monthly Historical Followers" tab's Month column is normally already a
// clean "YYYY-MM" key, but tolerate a hand-typed "August 2026" too.
const normalizedMonth = (value: Cell): string | null => { const raw = text(value); return raw ? (monthOnly(raw) ?? raw) : null; };

async function getBatch(ranges: string[]) {
  const apiKey = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!apiKey) throw new Error("Google Sheets API is not configured.");
  const params = new URLSearchParams({
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
    key: apiKey,
  });
  ranges.forEach((range) => params.append("ranges", range));
  const response = await fetch(`${SHEETS_BASE}/spreadsheets/${SPREADSHEET_ID}/values:batchGet?${params.toString()}`);
  if (!response.ok) {
    const body = await response.text();
    console.error(`Google Sheets request failed [${response.status}]: ${body}`);
    throw new Error("The live source is temporarily unavailable.");
  }
  const payload = (await response.json()) as { valueRanges?: { values?: Row[] }[] };
  return (payload.valueRanges ?? []).map((range) => range.values ?? []);
}

const RANGES = ["Roster!A1:O1000", "Instagram Profile Snapshots!A1:T1500", "SoundCloud Profile Snapshots!A1:P1000", "Resident Advisor Snapshots!A1:N1000", "Monthly Historical Followers!A1:F1000", "Viberate Historical Data!A1:L12000"];

// Pure normalization over already-fetched sheet rows — kept separate from the
// server function so it can be exercised directly in tests without needing a
// TanStack Start request context or a live Google Sheets connection.
export function buildAudienceMonitorData(batches: Row[][]): AudienceMonitorData {
  const [rosterValues, instagramValues, soundcloudValues, raValues, monthlyValues, historicalValues] = batches;
  const roster = keyedRows(rosterValues ?? []);
  const instagram = keyedRows(instagramValues ?? []).map((row) => ({ name: text(row["Artist"]), value: number(row["Followers"]), at: iso(row["Collected At"]) ?? iso(row["Raw Timestamp"]), status: text(row["Source Status"]), source: "Minor AM monitoring" as const })).filter((row) => row.name && row.value !== null && row.status === "OK") as ({ name: string; status: string | null } & Observation)[];
  const soundcloud = keyedRows(soundcloudValues ?? []).map((row) => ({ name: text(row["Artist"]), value: number(row["Followers"]), at: iso(row["Collected At"]), status: text(row["Source Status"]), source: "Minor AM monitoring" as const })).filter((row) => row.name && row.value !== null && row.status === "OK") as ({ name: string; status: string | null } & Observation)[];
  const ra = keyedRows(raValues ?? []).map((row) => ({ name: text(row["Artist"]), value: number(row["Followers / Fans"]), at: iso(row["Raw Timestamp"]) ?? iso(row["Collected At"]), status: text(row["Source Status"]), source: "Minor AM monitoring" as const })).filter((row) => row.name && row.value !== null && row.status === "OK") as ({ name: string; status: string | null } & Observation)[];
  const monthlyRows = keyedRows(monthlyValues ?? []);
  const historicalRows = keyedRows(historicalValues ?? []).map((row) => ({ name: text(row["Artist"]), platform: text(row["Platform"]), date: iso(row["Date"]), followers: number(row["Followers"]), source: sourceName(text(row["Source"])) })).filter((row) => row.name && row.platform && row.date && row.followers !== null) as { name: string; platform: string; date: string; followers: number; source: ObservationSource }[];
  const months = [...new Set([...monthlyRows.map((row) => normalizedMonth(row["Month"])), ...historicalRows.filter((row) => row.platform.toLowerCase() === "instagram").map((row) => monthOf(row.date))].filter((value): value is string => Boolean(value)))].sort();
  const observationGroups = new Map<string, number>();
  instagram.forEach((row) => { if (row.at) observationGroups.set(row.at, (observationGroups.get(row.at) ?? 0) + 1); });
  const comparableTimestamps = [...observationGroups.entries()]
    .filter(([, count]) => count >= Math.max(2, roster.length * 0.6))
    .map(([at]) => at)
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  const currentTimestamp = comparableTimestamps[0] ?? null;
  const currentDate = currentTimestamp ? new Date(currentTimestamp) : null;
  const baselineTimestamp = currentDate
    ? comparableTimestamps.find((at) => {
        const date = new Date(at);
        return date.getFullYear() < currentDate.getFullYear()
          || (date.getFullYear() === currentDate.getFullYear() && date.getMonth() < currentDate.getMonth());
      }) ?? null
    : null;
  const allObserved = [...instagram.map((r) => r.at), ...soundcloud.map((r) => r.at), ...ra.map((r) => r.at)].filter((value): value is string => Boolean(value)).sort((a, b) => Date.parse(b) - Date.parse(a));
  const artists: ArtistRecord[] = roster.map((row) => {
    const name = text(row["Artist"]); if (!name) return null;
    const historyFor = (platform: string) => historicalRows.filter((item) => item.name === name && item.platform.toLowerCase() === platform).sort((a, b) => Date.parse(a.date) - Date.parse(b.date)).map(({ date, followers, source }) => ({ date, followers, source }));
    const instagramHistory = historyFor("instagram"), soundcloudHistory = historyFor("soundcloud");
    const unifiedInstagram = [...instagram.filter((item) => item.name === name), ...instagramHistory.map((item) => ({ value: item.followers, at: item.date, source: item.source }))];
    const unifiedSoundcloud = [...soundcloud.filter((item) => item.name === name), ...soundcloudHistory.map((item) => ({ value: item.followers, at: item.date, source: item.source }))];
    // Current audience: the single latest valid observation, any trusted source.
    const currentInstagram = latest(unifiedInstagram);
    // One canonical checkpoint per calendar month, preferring Minor AM's own
    // monitoring over third-party history over the legacy monthly-only tab.
    // Built once per artist so every consumer (current-movement comparison,
    // monthly history table, roster-wide charts) reads the same numbers.
    const monthlyHistory: MonthlyPoint[] = months.map((month) => {
      const livePoint = instagram.filter((item) => item.name === name && item.at && monthOf(item.at) === month).sort((a, b) => Date.parse(b.at ?? "") - Date.parse(a.at ?? ""))[0];
      const historicalPoint = instagramHistory.filter((item) => monthOf(item.date) === month).at(-1);
      const stored = number(monthlyRows.find((item) => text(item["Artist"]) === name && normalizedMonth(item["Month"]) === month)?.["Followers"]);
      return livePoint ? { month, followers: livePoint.value, source: livePoint.source, observedAt: livePoint.at } : historicalPoint ? { month, followers: historicalPoint.followers, source: historicalPoint.source, observedAt: historicalPoint.date } : stored !== null ? { month, followers: stored, source: "Modash", observedAt: month } : { month, followers: null, source: null, observedAt: null };
    });
    // Current movement: latest observation vs. the latest canonical checkpoint
    // from a genuinely earlier calendar month — never two observations pulled
    // from the same month (e.g. a same-day Viberate refresh vs. a Minor AM
    // scrape), which is what produced the previous "0-day growth" bug.
    const currentMonth = currentInstagram.observedAt ? monthOf(currentInstagram.observedAt) : null;
    const baselinePoint = currentMonth
      ? [...monthlyHistory].reverse().find((point) => point.followers !== null && point.month < currentMonth)
      : undefined;
    const change = currentInstagram.audience !== null && baselinePoint?.followers != null ? currentInstagram.audience - baselinePoint.followers : null;
    const growthPercent = change !== null && baselinePoint?.followers ? (change / baselinePoint.followers) * 100 : null;
    return { name, location: text(row["Location"]), role: text(row["Role"]), instagramHandle: text(row["Instagram Handle"]), urls: { instagram: text(row["Instagram URL"]), soundcloud: text(row["SoundCloud URL"]), residentAdvisor: text(row["Resident Advisor URL"]) }, instagram: { ...currentInstagram, baseline: baselinePoint?.followers ?? null, baselineAt: baselinePoint?.observedAt ?? null, change, growthPercent }, soundcloud: latest(unifiedSoundcloud), residentAdvisor: latest(ra.filter((item) => item.name === name)), monthlyHistory, historical: { instagram: instagramHistory, soundcloud: soundcloudHistory } };
  }).filter((artist): artist is ArtistRecord => artist !== null);
  return { artists, months, comparison: { baselineAt: baselineTimestamp, latestAt: currentTimestamp }, refreshedAt: new Date().toISOString(), latestSourceObservation: allObserved[0] ?? null };
}

export const getAudienceMonitor = createServerFn({ method: "GET" }).handler(async (): Promise<AudienceMonitorData> => {
  return buildAudienceMonitorData(await getBatch(RANGES));
});
