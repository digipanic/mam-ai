import { createServerFn } from "@tanstack/react-start";

const SPREADSHEET_ID = "1ysF90fgjl5iMREIUn6AaJ0wVstRuRaTpZOT4a9RpoK4";
const SHEETS_BASE = "https://connector-gateway.lovable.dev/google_sheets/v4";

type Cell = string | number | boolean | null | undefined;
type Row = Cell[];

type PlatformMetric = {
  audience: number | null;
  oneMonthChange: number | null;
  oneMonthPercent: number | null;
  observedAt: string | null;
};

type Artist = {
  name: string;
  location: string | null;
  role: string | null;
  instagramHandle: string | null;
  metrics: {
    instagram: PlatformMetric;
    soundcloud: PlatformMetric;
    residentAdvisor: PlatformMetric;
  };
  instagramHistory: { date: string; followers: number }[];
};

export type AudienceMonitorData = {
  artists: Artist[];
  refreshedAt: string;
  sourceUpdatedAt: string | null;
};

function text(value: Cell): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function number(value: Cell): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function keyedRows(rows: Row[]): Record<string, Cell>[] {
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((row) => Object.fromEntries(header.map((key, index) => [String(key), row[index]])));
}

function metric(row: Record<string, Cell> | undefined, platform: "Instagram" | "SoundCloud" | "RA"): PlatformMetric {
  return {
    audience: number(row?.[`${platform} Followers`]),
    oneMonthChange: number(row?.[`${platform} 1M`]),
    oneMonthPercent: number(row?.[`${platform} 1M %`]),
    observedAt: text(row?.[`${platform} Latest`]),
  };
}

async function googleSheetsGet(path: string, params: URLSearchParams) {
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const connectionApiKey = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lovableApiKey || !connectionApiKey) throw new Error("Live data is not configured.");

  const response = await fetch(`${SHEETS_BASE}${path}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "X-Connection-Api-Key": connectionApiKey,
    },
  });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Google Sheets request failed [${response.status}]: ${errorBody}`);
    throw new Error("The live source is temporarily unavailable.");
  }
  return response.json() as Promise<Record<string, unknown>>;
}

export const getAudienceMonitor = createServerFn({ method: "GET" }).handler(async (): Promise<AudienceMonitorData> => {
  const ranges = ["Roster!A1:O1000", "Social Dashboard!A1:P1000", "Follower Tracker!A1:D1000"];
  const params = new URLSearchParams({ valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "FORMATTED_STRING" });
  ranges.forEach((range) => params.append("ranges", range));
  const payload = await googleSheetsGet(`/spreadsheets/${SPREADSHEET_ID}/values:batchGet`, params);
  const rawRanges = (payload["valueRanges"] ?? []) as { values?: Row[] }[];
  const [rosterRows = [], dashboardRows = [], trackerRows = []] = rawRanges.map((range) => range.values ?? []);

  const roster = keyedRows(rosterRows);
  const dashboard = new Map(keyedRows(dashboardRows).map((row) => [text(row["Artist"]), row]));
  const history = new Map<string, { date: string; followers: number }[]>();
  keyedRows(trackerRows).forEach((row) => {
    if (text(row["Platform"]) !== "Instagram") return;
    const artist = text(row["Artist"]);
    const date = text(row["Date"]);
    const followers = number(row["Followers"]);
    if (!artist || !date || followers === null) return;
    history.set(artist, [...(history.get(artist) ?? []), { date, followers }]);
  });

  const meta = await googleSheetsGet(`/spreadsheets/${SPREADSHEET_ID}`, new URLSearchParams({ includeGridData: "false", fields: "properties(title),spreadsheetUrl" }));
  const sourceUpdatedAt = null;

  return {
    artists: roster
      .map((row) => {
        const name = text(row["Artist"]);
        if (!name) return null;
        const current = dashboard.get(name);
        return {
          name,
          location: text(row["Location"]),
          role: text(row["Role"]),
          instagramHandle: text(row["Instagram Handle"]),
          metrics: {
            instagram: metric(current, "Instagram"),
            soundcloud: metric(current, "SoundCloud"),
            residentAdvisor: metric(current, "RA"),
          },
          instagramHistory: history.get(name) ?? [],
        };
      })
      .filter((artist): artist is Artist => artist !== null),
    refreshedAt: new Date().toISOString(),
    sourceUpdatedAt,
  };
});
