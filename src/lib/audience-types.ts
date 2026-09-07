export type ObservationSource = "Minor AM monitoring" | "Viberate" | "Modash" | "Historical checkpoint";
export type PlatformMetric = { audience: number | null; observedAt: string | null; source: ObservationSource | null };

export type MonthlyPoint = { month: string; followers: number | null; source: ObservationSource | null; observedAt: string | null };
export type HistoricalPoint = { date: string; followers: number; source: ObservationSource };

// Whether Minor AM's own scraper is successfully collecting an artist is a
// different question from what their current audience is (a stale-but-OK
// scrape and a broken scraper can show the same last-known number). This is
// the last *attempt*, successful or not — never just the last success.
export type MonitoringStatus = { lastAttemptAt: string | null; status: string | null; ok: boolean };

export type ArtistRecord = {
  name: string;
  location: string | null;
  role: string | null;
  instagramHandle: string | null;
  urls: { instagram: string | null; soundcloud: string | null; residentAdvisor: string | null };
  instagram: PlatformMetric & { baseline: number | null; baselineAt: string | null; change: number | null; growthPercent: number | null };
  soundcloud: PlatformMetric;
  residentAdvisor: PlatformMetric;
  monthlyHistory: MonthlyPoint[];
  historical: { instagram: HistoricalPoint[]; soundcloud: HistoricalPoint[] };
  monitoring: { instagram: MonitoringStatus; soundcloud: MonitoringStatus; residentAdvisor: MonitoringStatus };
};

export type AudienceMonitorData = {
  artists: ArtistRecord[];
  months: string[];
  comparison: { baselineAt: string | null; latestAt: string | null };
  refreshedAt: string;
  latestSourceObservation: string | null;
};