import { createServerFn } from "@tanstack/react-start";
import type { AudienceMonitorData, ArtistRecord, MonthlyPoint, PlatformMetric } from "@/lib/audience-types";

const SPREADSHEET_ID = "1ysF90fgjl5iMREIUn6AaJ0wVstRuRaTpZOT4a9RpoK4";
const SHEETS_BASE = "https://connector-gateway.lovable.dev/google_sheets/v4";
type Cell = string | number | boolean | null | undefined;
type Row = Cell[];
type RecordRow = Record<string, Cell>;

const text = (value: Cell) => { const result = String(value ?? "").trim(); return result && result !== "—" ? result : null; };
const number = (value: Cell) => { if (value === "" || value === null || value === undefined) return null; const result = typeof value === "number" ? value : Number(value); return Number.isFinite(result) ? result : null; };
const keyedRows = (rows: Row[]): RecordRow[] => { const [headers, ...body] = rows; return headers ? body.map((row) => Object.fromEntries(headers.map((header, index) => [String(header), row[index]]))) : []; };
const iso = (value: Cell) => { const raw = text(value); if (!raw) return null; const parsed = Date.parse(raw.replace(" · ", " ")); return Number.isNaN(parsed) ? raw : new Date(parsed).toISOString(); };
const latest = (items: { value: number; at: string | null }[]): PlatformMetric => { const valid = items.filter((item) => item.at && item.value !== null).sort((a, b) => Date.parse(a.at ?? "") - Date.parse(b.at ?? "")); const item = valid.at(-1); return { audience: item?.value ?? null, observedAt: item?.at ?? null }; };

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
  const [rosterValues, instagramValues, soundcloudValues, raValues, monthlyValues] = await getBatch([
    "Roster!A1:O1000", "Instagram Profile Snapshots!A1:T1500", "SoundCloud Profile Snapshots!A1:P1000", "Resident Advisor Snapshots!A1:N1000", "Monthly Historical Followers!A1:F1000",
  ]);
  const roster = keyedRows(rosterValues ?? []);
  const instagram = keyedRows(instagramValues ?? []).map((row) => ({ name: text(row["Artist"]), value: number(row["Followers"]), at: iso(row["Raw Timestamp"]) ?? iso(row["Collected At"]), status: text(row["Source Status"]) })).filter((row) => row.name && row.value !== null && row.status === "OK") as { name: string; value: number; at: string | null; status: string | null }[];
  const soundcloud = keyedRows(soundcloudValues ?? []).map((row) => ({ name: text(row["Artist"]), value: number(row["Followers"]), at: iso(row["Collected At"]), status: text(row["Source Status"]) })).filter((row) => row.name && row.status === "OK") as { name: string; value: number | null; at: string | null; status: string | null }[];
  const ra = keyedRows(raValues ?? []).map((row) => ({ name: text(row["Artist"]), value: number(row["Followers / Fans"]), at: iso(row["Raw Timestamp"]) ?? iso(row["Collected At"]), status: text(row["Source Status"]) })).filter((row) => row.name && row.status === "OK") as { name: string; value: number | null; at: string | null; status: string | null }[];
  const monthlyRows = keyedRows(monthlyValues ?? []);
  const months = [...new Set(monthlyRows.map((row) => text(row["Month"])).filter((value): value is string => Boolean(value)))].sort();
  const observationGroups = new Map<string, number>();
  instagram.forEach((row) => { if (row.at) observationGroups.set(row.at, (observationGroups.get(row.at) ?? 0) + 1); });
  const comparableTimestamps = [...observationGroups.entries()].filter(([, count]) => count >= Math.max(2, roster.length * 0.6)).map(([at]) => at).sort((a, b) => Date.parse(b) - Date.parse(a));
  const currentTimestamp = comparableTimestamps[0] ?? null;
  const baselineTimestamp = comparableTimestamps[1] ?? null;
  const allObserved = [...instagram.map((r) => r.at), ...soundcloud.map((r) => r.at), ...ra.map((r) => r.at)].filter((value): value is string => Boolean(value)).sort((a,b) => Date.parse(b) - Date.parse(a));
  const artists: ArtistRecord[] = roster.map((row) => {
    const name = text(row["Artist"]); if (!name) return null;
    const current = instagram.find((item) => item.name === name && item.at === currentTimestamp)?.value ?? null;
    const baseline = instagram.find((item) => item.name === name && item.at === baselineTimestamp)?.value ?? null;
    const change = current !== null && baseline !== null ? current - baseline : null;
    const monthlyHistory: MonthlyPoint[] = months.map((month) => ({ month, followers: number(monthlyRows.find((item) => text(item["Artist"]) === name && text(item["Month"]) === month)?.["Followers"]) }));
    return { name, location: text(row["Location"]), role: text(row["Role"]), instagramHandle: text(row["Instagram Handle"]), urls: { instagram: text(row["Instagram URL"]), soundcloud: text(row["SoundCloud URL"]), residentAdvisor: text(row["Resident Advisor URL"]) }, instagram: { ...latest(instagram.filter((item) => item.name === name)), baseline, baselineAt: baseline !== null ? baselineTimestamp : null, change, growthPercent: change !== null && baseline ? (change / baseline) * 100 : null }, soundcloud: latest(soundcloud.filter((item) => item.name === name && item.value !== null) as { value: number; at: string | null }[]), residentAdvisor: latest(ra.filter((item) => item.name === name && item.value !== null) as { value: number; at: string | null }[]), monthlyHistory };
  }).filter((artist): artist is ArtistRecord => artist !== null);
  return { artists, months, comparison: { baselineAt: baselineTimestamp, latestAt: currentTimestamp }, refreshedAt: new Date().toISOString(), latestSourceObservation: allObserved[0] ?? null };
});