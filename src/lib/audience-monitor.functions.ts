import { createServerFn } from "@tanstack/react-start";
import type { AudienceMonitorData, ArtistRecord, MonthlyPoint, ObservationSource, PlatformMetric } from "@/lib/audience-types";

const SPREADSHEET_ID = "1ysF90fgjl5iMREIUn6AaJ0wVstRuRaTpZOT4a9RpoK4";
const SHEETS_BASE = "https://connector-gateway.lovable.dev/google_sheets/v4";
type Cell = string | number | boolean | null | undefined;
type Row = Cell[];
type RecordRow = Record<string, Cell>;

const text = (value: Cell) => { const result = String(value ?? "").trim(); return result && result !== "—" ? result : null; };
const number = (value: Cell) => { if (value === "" || value === null || value === undefined) return null; const result = typeof value === "number" ? value : Number(value); return Number.isFinite(result) ? result : null; };
const keyedRows = (rows: Row[]): RecordRow[] => { const [headers, ...body] = rows; return headers ? body.map((row) => Object.fromEntries(headers.map((header, index) => [String(header), row[index]]))) : []; };
const iso = (value: Cell) => { const raw = text(value); if (!raw) return null; const parsed = Date.parse(raw.replace(" · ", " ")); return Number.isNaN(parsed) ? raw : new Date(parsed).toISOString(); };
type Observation = { value: number; at: string | null; source: ObservationSource };
const latest = (items: Observation[]): PlatformMetric => { const valid = items.filter((item) => item.at && item.value !== null).sort((a, b) => Date.parse(a.at ?? "") - Date.parse(b.at ?? "")); const item = valid.at(-1); return { audience: item?.value ?? null, observedAt: item?.at ?? null, source: item?.source ?? null }; };
const sourceName = (value: string | null): ObservationSource => value?.toLowerCase().includes("modash") ? "Modash" : value?.toLowerCase().includes("viberate") ? "Viberate" : "Historical checkpoint";
const monthOf = (at: string) => { const date = new Date(at); return Number.isNaN(date.valueOf()) ? at.slice(0, 7) : date.toISOString().slice(0, 7); };

async function getBatch(ranges: string[]) {
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const connectionApiKey = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lovableApiKey || !connectionApiKey) throw new Error("Live data is not configured.");
  const params = new URLSearchParams({ valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "FORMATTED_STRING" });
  ranges.forEach((range) => params.append("ranges", range));
  const response = await fetch(`${SHEETS_BASE}/spreadsheets/${SPREADSHEET_ID}/values:batchGet?${params.toString()}`, { headers: { Authorization: `Bearer ${lovableApiKey}`, "X-Connection-Api-Key": connectionApiKey } });
  if (!response.ok) { const body = await response.text(); console.error(`Google Sheets request failed [${response.status}]: ${body}`); throw new Error("The live source is temporarily unavailable."); }
  const payload = await response.json() as { valueRanges?: { values?: Row[] }[] };
  return (payload.valueRanges ?? []).map((range) => range.values ?? []);
}

export const getAudienceMonitor = createServerFn({ method: "GET" }).handler(async (): Promise<AudienceMonitorData> => {
  const [rosterValues, instagramValues, soundcloudValues, raValues, monthlyValues, historicalValues] = await getBatch([
    "Roster!A1:O1000", "Instagram Profile Snapshots!A1:T1500", "SoundCloud Profile Snapshots!A1:P1000", "Resident Advisor Snapshots!A1:N1000", "Monthly Historical Followers!A1:F1000", "Viberate Historical Data!A1:L12000",
  ]);
  const roster = keyedRows(rosterValues ?? []);
  const instagram = keyedRows(instagramValues ?? []).map((row) => ({ name: text(row["Artist"]), value: number(row["Followers"]), at: iso(row["Collected At"]) ?? iso(row["Raw Timestamp"]), status: text(row["Source Status"]), source: "Minor AM monitoring" as const })).filter((row) => row.name && row.value !== null && row.status === "OK") as ({ name: string; status: string | null } & Observation)[];
  const soundcloud = keyedRows(soundcloudValues ?? []).map((row) => ({ name: text(row["Artist"]), value: number(row["Followers"]), at: iso(row["Collected At"]), status: text(row["Source Status"]), source: "Minor AM monitoring" as const })).filter((row) => row.name && row.value !== null && row.status === "OK") as ({ name: string; status: string | null } & Observation)[];
  const ra = keyedRows(raValues ?? []).map((row) => ({ name: text(row["Artist"]), value: number(row["Followers / Fans"]), at: iso(row["Raw Timestamp"]) ?? iso(row["Collected At"]), status: text(row["Source Status"]), source: "Minor AM monitoring" as const })).filter((row) => row.name && row.value !== null && row.status === "OK") as ({ name: string; status: string | null } & Observation)[];
  const monthlyRows = keyedRows(monthlyValues ?? []);
  const historicalRows = keyedRows(historicalValues ?? []).map((row) => ({ name: text(row["Artist"]), platform: text(row["Platform"]), date: iso(row["Date"]), followers: number(row["Followers"]), source: sourceName(text(row["Source"])) })).filter((row) => row.name && row.platform && row.date && row.followers !== null) as { name: string; platform: string; date: string; followers: number; source: ObservationSource }[];
  const months = [...new Set([...monthlyRows.map((row) => text(row["Month"])), ...historicalRows.filter((row) => row.platform.toLowerCase() === "instagram").map((row) => monthOf(row.date))].filter((value): value is string => Boolean(value)))].sort();
  const observationGroups = new Map<string, number>();
  instagram.forEach((row) => { if (row.at) observationGroups.set(row.at, (observationGroups.get(row.at) ?? 0) + 1); });
  const comparableTimestamps = [...observationGroups.entries()]
    .filter(([, count]) => count >= Math.max(2, roster.length * 0.6))
    .map(([at]) => at)
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  const currentTimestamp = comparableTimestamps[0] ?? null;
  // Current movement always compares the latest complete roster snapshot against
  // the latest complete snapshot from the preceding calendar month. This avoids
  // treating repeat collection runs within a month as the reporting period.
  const currentDate = currentTimestamp ? new Date(currentTimestamp) : null;
  const baselineTimestamp = currentDate
    ? comparableTimestamps.find((at) => {
        const date = new Date(at);
        return date.getFullYear() < currentDate.getFullYear()
          || (date.getFullYear() === currentDate.getFullYear() && date.getMonth() < currentDate.getMonth());
      }) ?? null
    : null;
  const allObserved = [...instagram.map((r) => r.at), ...soundcloud.map((r) => r.at), ...ra.map((r) => r.at)].filter((value): value is string => Boolean(value)).sort((a,b) => Date.parse(b) - Date.parse(a));
  const artists: ArtistRecord[] = roster.map((row) => {
    const name = text(row["Artist"]); if (!name) return null;
    const historyFor = (platform: string) => historicalRows.filter((item) => item.name === name && item.platform.toLowerCase() === platform).sort((a, b) => Date.parse(a.date) - Date.parse(b.date)).map(({ date, followers, source }) => ({ date, followers, source }));
    const instagramHistory = historyFor("instagram"), soundcloudHistory = historyFor("soundcloud");
    const unifiedInstagram = [...instagram.filter((item) => item.name === name), ...instagramHistory.map((item) => ({ value: item.followers, at: item.date, source: item.source }))];
    const unifiedSoundcloud = [...soundcloud.filter((item) => item.name === name), ...soundcloudHistory.map((item) => ({ value: item.followers, at: item.date, source: item.source }))];
    const currentInstagram = latest(unifiedInstagram);
    const baseline = [...unifiedInstagram].filter((item) => item.at && currentInstagram.observedAt && monthOf(item.at) < monthOf(currentInstagram.observedAt)).sort((a, b) => Date.parse(b.at ?? "") - Date.parse(a.at ?? ""))[0];
    const change = currentInstagram.audience !== null && baseline ? currentInstagram.audience - baseline.value : null;
    const monthlyHistory: MonthlyPoint[] = months.map((month) => {
      const livePoint = instagram.filter((item) => item.name === name && item.at && monthOf(item.at) === month).sort((a, b) => Date.parse(b.at ?? "") - Date.parse(a.at ?? ""))[0];
      const historicalPoint = instagramHistory.filter((item) => monthOf(item.date) === month).at(-1);
      const stored = number(monthlyRows.find((item) => text(item["Artist"]) === name && text(item["Month"]) === month)?.["Followers"]);
      return livePoint ? { month, followers: livePoint.value, source: livePoint.source, observedAt: livePoint.at } : historicalPoint ? { month, followers: historicalPoint.followers, source: historicalPoint.source, observedAt: historicalPoint.date } : stored !== null ? { month, followers: stored, source: "Modash", observedAt: `${month}-01T00:00:00.000Z` } : { month, followers: null, source: null, observedAt: null };
    });
    return { name, location: text(row["Location"]), role: text(row["Role"]), instagramHandle: text(row["Instagram Handle"]), urls: { instagram: text(row["Instagram URL"]), soundcloud: text(row["SoundCloud URL"]), residentAdvisor: text(row["Resident Advisor URL"]) }, instagram: { ...currentInstagram, baseline: baseline?.value ?? null, baselineAt: baseline?.at ?? null, change, growthPercent: change !== null && baseline?.value ? (change / baseline.value) * 100 : null }, soundcloud: latest(unifiedSoundcloud), residentAdvisor: latest(ra.filter((item) => item.name === name)), monthlyHistory, historical: { instagram: instagramHistory, soundcloud: soundcloudHistory } };
  }).filter((artist): artist is ArtistRecord => artist !== null);
  return { artists, months, comparison: { baselineAt: baselineTimestamp, latestAt: currentTimestamp }, refreshedAt: new Date().toISOString(), latestSourceObservation: allObserved[0] ?? null };
});