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
const iso = (value: Cell) => { const raw = text(value); if (!raw) return null; const parsed = Date.parse(raw.replace(" · ", " ")); return Number.isNaN(parsed) ? raw : new Date(parsed).toISOString(); };
type Observation = { value: number; at: string | null; source: ObservationSource };
const latest = (items: Observation[]): PlatformMetric => { const valid = items.filter((item) => item.at && item.value !== null).sort((a, b) => Date.parse(a.at ?? "") - Date.parse(b.at ?? "")); const item = valid.at(-1); return { audience: item?.value ?? null, observedAt: item?.at ?? null, source: item?.source ?? null }; };
const sourceName = (value: string | null): ObservationSource => value?.toLowerCase().includes("modash") ? "Modash" : value?.toLowerCase().includes("viberate") ? "Viberate" : "Historical checkpoint";
const monthOf = (at: string) => { const date = new Date(at); return Number.isNaN(date.valueOf()) ? at.slice(0, 7) : date.toISOString().slice(0, 7); };

async function getBatch(ranges: string[]) {

  const apiKey = process.env["GOOGLE_SHEETS_API_KEY"];

  if (!apiKey) {

    throw new Error("Google Sheets API is not configured.");

  }

  const params = new URLSearchParams({

    valueRenderOption: "UNFORMATTED_VALUE",

    dateTimeRenderOption: "FORMATTED_STRING",

    key: apiKey,

  });

  ranges.forEach((range) => params.append("ranges", range));

  const response = await fetch(

    `${SHEETS_BASE}/spreadsheets/${SPREADSHEET_ID}/values:batchGet?${params.toString()}`

  );

  if (!response.ok) {

    const body = await response.text();

    console.error(

      `Google Sheets request failed [${response.status}]: ${body}`

    );

    throw new Error("The live source is temporarily unavailable.");

  }

  const payload = (await response.json()) as {

    valueRanges?: { values?: Row[] }[];

  };

  return (payload.valueRanges ?? []).map(

    (range) => range.values ?? []

  );

}
