import type { ArtistRecord, AudienceMonitorData, HistoricalPoint, MonthlyPoint } from "@/lib/audience-types";

export const slugifyArtist = (name: string) => encodeURIComponent(name.toLocaleLowerCase());
export const findArtist = (artists: ArtistRecord[], slug: string) => artists.find((artist) => slugifyArtist(artist.name) === slug);
export const formatNumber = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat("en-US").format(value);
export const formatSigned = (value: number | null | undefined) => value == null ? "—" : `${value > 0 ? "+" : ""}${formatNumber(value)}`;
export const formatPercent = (value: number | null | undefined) => value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
export const formatDate = (value: string | null | undefined, time = false) => {
  if (!value) return "—";
  // A bare "YYYY-MM" checkpoint (month-only Modash/Viberate data) never had a
  // recorded day — show the month instead of inventing "1 <Month> <Year>".
  if (/^\d{4}-\d{2}$/.test(value)) return formatMonth(value);
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit" } : {}) });
};
export const formatMonth = (value: string | null | undefined) => {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
};
export const sameCalendarMonth = (left: string | null | undefined, right: string | null | undefined) => Boolean(left && right && left.slice(0, 7) === right.slice(0, 7));
export const checkpointRange = (start: string | null | undefined, end: string | null | undefined, fallback = "Insufficient history for range") => {
  if (!start || !end) return fallback;
  if (start === end) return `1 checkpoint · ${formatDate(start)}`;
  return `${formatDate(start)} → ${formatDate(end)}`;
};
export const monthRange = (start: string | null | undefined, end: string | null | undefined, fallback = "Insufficient valid monthly history") => {
  if (!start || !end) return fallback;
  if (start === end) return `1 checkpoint · ${formatMonth(start)}`;
  return `${formatMonth(start)} → ${formatMonth(end)}`;
};

export type HistoricalPerformance = { start: HistoricalPoint; end: HistoricalPoint; change: number; growthPercent: number };
export const historicalPerformance = (history: HistoricalPoint[]): HistoricalPerformance | null => {
  const ordered = [...history].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const start = ordered[0]; const end = ordered.at(-1);
  if (!start || !end || start.date === end.date || start.followers === 0) return null;
  return { start, end, change: end.followers - start.followers, growthPercent: ((end.followers - start.followers) / start.followers) * 100 };
};
export const rank = (artists: ArtistRecord[], value: (artist: ArtistRecord) => number | null) => [...artists].filter((artist) => value(artist) !== null).sort((a, b) => (value(b) ?? -Infinity) - (value(a) ?? -Infinity));
export const median = (values: (number | null)[]) => { const list = values.filter((value): value is number => value !== null).sort((a, b) => a - b); if (!list.length) return null; const half = Math.floor(list.length / 2); const center = list[half] ?? 0; return list.length % 2 ? center : ((list[half - 1] ?? 0) + center) / 2; };
export const trajectory = (history: { followers: number | null }[]) => { const valid = history.filter((point): point is { followers: number } => point.followers !== null); const first = valid[0]?.followers; const last = valid.at(-1)?.followers; if (valid.length < 2 || first === undefined || last === undefined || first === 0) return "Insufficient history"; const rate = (last - first) / first; if (rate > .1) return "Strong growth"; if (rate > .02) return "Growing"; if (rate < -.02) return "Declining"; return "Stable"; };

export type MonthlyPerformance = { artist: ArtistRecord; start: ValidMonthlyPoint; end: ValidMonthlyPoint; change: number; growthPercent: number; momentum: "Accelerating" | "Decelerating" | "Stable" | null };
type ValidMonthlyPoint = MonthlyPoint & { followers: number };
export const validMonthlyPoints = (artist: ArtistRecord): ValidMonthlyPoint[] => artist.monthlyHistory.filter((point): point is ValidMonthlyPoint => point.followers !== null);
export const monthlyPerformance = (artist: ArtistRecord): MonthlyPerformance | null => {
  const history = validMonthlyPoints(artist); const start = history[0]; const end = history.at(-1);
  if (!start || !end || start.month === end.month || start.followers === 0) return null;
  const recent = history.slice(-3); const older = recent[0]; const middle = recent[1]; const newest = recent[2];
  const previousGain = older && middle && older.month !== middle.month ? middle.followers - older.followers : null;
  const latestGain = middle && newest && middle.month !== newest.month ? newest.followers - middle.followers : null;
  const momentum = previousGain === null || latestGain === null ? null : Math.abs(latestGain - previousGain) <= Math.max(10, Math.abs(previousGain) * .15) ? "Stable" : latestGain > previousGain ? "Accelerating" : "Decelerating";
  return { artist, start, end, change: end.followers - start.followers, growthPercent: ((end.followers - start.followers) / start.followers) * 100, momentum };
};
export const monthlyRosterSeries = (data: AudienceMonitorData) => data.months.map((month) => { const values = data.artists.map((artist) => artist.monthlyHistory.find((point) => point.month === month)?.followers).filter((value): value is number => value !== null && value !== undefined); return { month, audience: values.length ? values.reduce((total, value) => total + value, 0) : null, coverage: values.length }; });
export type MonthlyPace = { month: string; change: number | null; medianChange: number | null; coverage: number };
export const monthlyPace = (data: AudienceMonitorData): MonthlyPace[] => data.months.map((month, index) => { const previousMonth = data.months[index - 1]; if (!previousMonth || previousMonth === month) return { month, change: null, medianChange: null, coverage: 0 }; const changes = data.artists.map((artist) => { const current = artist.monthlyHistory.find((point) => point.month === month)?.followers; const previous = artist.monthlyHistory.find((point) => point.month === previousMonth)?.followers; return current !== null && current !== undefined && previous !== null && previous !== undefined ? current - previous : null; }); const valid = changes.filter((change): change is number => change !== null); return { month, change: valid.length ? valid.reduce((total, change) => total + change, 0) : null, medianChange: median(changes), coverage: valid.length }; });
export const monthlyConsistency = (artist: ArtistRecord) => { const points = validMonthlyPoints(artist); const changes = points.slice(1).map((point, index) => point.month !== points[index]?.month ? point.followers - (points[index]?.followers ?? point.followers) : null).filter((change): change is number => change !== null); if (changes.length < 2) return "Limited history"; return changes.every((change) => change > 0) ? "Consistently growing" : "Mixed movement"; };
export const recordHigh = (artist: ArtistRecord) => { const points = validMonthlyPoints(artist); const latest = points.at(-1); return Boolean(latest && points.length > 1 && points.slice(0, -1).every((point) => latest.followers > point.followers)); };
export const percentile = (value: number | null, values: (number | null)[]) => { if (value === null) return null; const valid = values.filter((item): item is number => item !== null).sort((a, b) => a - b); if (!valid.length) return null; return (valid.filter((item) => item <= value).length / valid.length) * 100; };
export const platformCoverage = (data: AudienceMonitorData) => ({ instagram: data.artists.filter((artist) => artist.instagram.audience !== null).length, comparableInstagram: data.artists.filter((artist) => artist.instagram.change !== null && artist.instagram.baselineAt !== artist.instagram.observedAt).length, soundcloud: data.artists.filter((artist) => artist.soundcloud.audience !== null).length, residentAdvisor: data.artists.filter((artist) => artist.residentAdvisor.audience !== null).length, monthlyHistory: data.artists.filter((artist) => validMonthlyPoints(artist).length > 0).length });
export const dashboardSummary = (data: AudienceMonitorData) => {
  const comparable = data.artists.filter((artist) => artist.instagram.change !== null && artist.instagram.growthPercent !== null && artist.instagram.baselineAt !== artist.instagram.observedAt);
  const currentRank = rank(data.artists, (artist) => artist.instagram.audience); const growthRank = rank(comparable, (artist) => artist.instagram.growthPercent); const gainRank = rank(comparable, (artist) => artist.instagram.change);
  const monthly = data.artists.map(monthlyPerformance).filter((item): item is MonthlyPerformance => item !== null); const monthlyGainRank = [...monthly].sort((a, b) => b.change - a.change); const monthlyGrowthRank = [...monthly].sort((a, b) => b.growthPercent - a.growthPercent); const accelerating = monthly.filter((item) => item.momentum === "Accelerating");
  return { comparable, leaders: { audience: currentRank[0], growth: growthRank[0], gain: gainRank[0], monthlyGain: monthlyGainRank[0], monthlyGrowth: monthlyGrowthRank[0] }, currentRank, growthRank, gainRank, growing: comparable.filter((artist) => (artist.instagram.change ?? 0) > 0), declining: comparable.filter((artist) => (artist.instagram.change ?? 0) <= 0), monthly, monthlyGainRank, monthlyGrowthRank, accelerating, medians: { audience: median(data.artists.map((artist) => artist.instagram.audience)), change: median(comparable.map((artist) => artist.instagram.change)), growth: median(comparable.map((artist) => artist.instagram.growthPercent)) }, coverage: platformCoverage(data) };
};