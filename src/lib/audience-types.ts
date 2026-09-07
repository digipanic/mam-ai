export type PlatformMetric = { audience: number | null; observedAt: string | null };

export type MonthlyPoint = { month: string; followers: number | null };
export type HistoricalPoint = { date: string; followers: number; source: string };

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
};

export type AudienceMonitorData = {
  artists: ArtistRecord[];
  months: string[];
  comparison: { baselineAt: string | null; latestAt: string | null };
  refreshedAt: string;
  latestSourceObservation: string | null;
};