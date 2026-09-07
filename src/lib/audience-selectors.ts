import type { ArtistRecord, AudienceMonitorData } from "@/lib/audience-types";

export const slugifyArtist = (name: string) => encodeURIComponent(name.toLocaleLowerCase());
export const findArtist = (artists: ArtistRecord[], slug: string) => artists.find((artist) => slugifyArtist(artist.name) === slug);
export const formatNumber = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat("en-US").format(value);
export const formatSigned = (value: number | null | undefined) => value == null ? "—" : `${value > 0 ? "+" : ""}${formatNumber(value)}`;
export const formatPercent = (value: number | null | undefined) => value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
export const formatDate = (value: string | null | undefined, time = false) => { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit" } : {}) }); };
export const rank = (artists: ArtistRecord[], value: (artist: ArtistRecord) => number | null) => [...artists].filter((artist) => value(artist) !== null).sort((a,b) => (value(b) ?? -Infinity) - (value(a) ?? -Infinity));
export const median = (values: (number | null)[]) => { const list = values.filter((value): value is number => value !== null).sort((a,b) => a-b); if (!list.length) return null; const half = Math.floor(list.length / 2); const center = list[half] ?? 0; return list.length % 2 ? center : ((list[half - 1] ?? 0) + center) / 2; };
export const trajectory = (history: { followers: number | null }[]) => { const valid = history.filter((point): point is { followers: number } => point.followers !== null); const firstPoint = valid[0]; if (valid.length < 2 || !firstPoint) return "Insufficient history"; const first = firstPoint.followers, last = valid.at(-1)?.followers ?? first; const rate = (last - first) / first; if (rate > .1) return "Strong growth"; if (rate > .02) return "Growing"; if (rate < -.02) return "Declining"; return "Stable"; };
export const dashboardSummary = (data: AudienceMonitorData) => {
 const comparable = data.artists.filter(a => a.instagram.change !== null && a.instagram.growthPercent !== null);
 const currentRank = rank(data.artists, a => a.instagram.audience), growthRank = rank(data.artists, a => a.instagram.growthPercent), gainRank = rank(data.artists, a => a.instagram.change);
 return { comparable, leaders: { audience: currentRank[0], growth: growthRank[0], gain: gainRank[0] }, currentRank, growthRank, gainRank, growing: comparable.filter(a=> (a.instagram.change ?? 0)>0), declining: comparable.filter(a=> (a.instagram.change ?? 0)<=0), medians: { audience: median(data.artists.map(a=>a.instagram.audience)), change: median(comparable.map(a=>a.instagram.change)), growth: median(comparable.map(a=>a.instagram.growthPercent)) } };
};
