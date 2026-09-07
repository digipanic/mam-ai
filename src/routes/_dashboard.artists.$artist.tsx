import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { MonthlyLine } from "@/components/audience/charts";
import { PageFrame, Panel } from "@/components/audience/page-frame";
import { useAudienceMonitor } from "@/hooks/use-audience-monitor";
import { dashboardSummary, findArtist, formatDate, formatNumber, formatPercent, formatSigned, monthlyConsistency, monthlyPerformance, percentile, recordHigh, trajectory } from "@/lib/audience-selectors";

export const Route = createFileRoute("/_dashboard/artists/$artist")({
  head: ({ params }) => ({ meta: [{ title: `${decodeURIComponent(params.artist)} | Minor AM` }, { name: "description", content: "Live Minor AM artist audience profile and recorded Instagram history." }, { property: "og:title", content: `${decodeURIComponent(params.artist)} | Minor AM` }, { property: "og:description", content: "Live Minor AM artist audience profile and recorded Instagram history." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ArtistProfile,
});

function ArtistProfile() {
  const { artist: slug } = Route.useParams();
  const { data } = useAudienceMonitor();
  if (!data) return null;
  const artist = findArtist(data.artists, slug);
  if (!artist) return <PageFrame eyebrow="Artists" title="Artist not found."><Link to="/artists" className="text-sm text-primary">Back to artists</Link></PageFrame>;
  const summary = dashboardSummary(data);
  const platforms = [
    { label: "Instagram", value: artist.instagram.audience, date: artist.instagram.observedAt },
    { label: "SoundCloud", value: artist.soundcloud.audience, date: artist.soundcloud.observedAt },
    { label: "Resident Advisor", value: artist.residentAdvisor.audience, date: artist.residentAdvisor.observedAt },
  ];
  const rankingSets = [
    ["Current IG", summary.currentRank], ["Growth %", summary.growthRank], ["Follower gain", summary.gainRank],
    ["SoundCloud", [...data.artists].sort((a, b) => (b.soundcloud.audience ?? -1) - (a.soundcloud.audience ?? -1))],
    ["Resident Advisor", [...data.artists].sort((a, b) => (b.residentAdvisor.audience ?? -1) - (a.residentAdvisor.audience ?? -1))],
  ] as const;
  const monthly = artist.monthlyHistory.map((point, index) => {
    const previous = artist.monthlyHistory[index - 1]?.followers ?? null;
    const change = point.followers !== null && previous !== null ? point.followers - previous : null;
    return { ...point, change, pct: change !== null && previous ? (change / previous) * 100 : null };
  });
  const performance = monthlyPerformance(artist);
  const currentPercentile = percentile(artist.instagram.audience, data.artists.map((entry) => entry.instagram.audience));
  const growthPercentile = percentile(artist.instagram.growthPercent, data.artists.map((entry) => entry.instagram.growthPercent));
  const description = [artist.location, artist.role].filter((item): item is string => typeof item === "string").join(" · ");
  return <PageFrame eyebrow="Artist profile" title={artist.name} description={description}>
    <div className="grid border-y border-border sm:grid-cols-3">{platforms.map((platform) => <div key={platform.label} className="border-b border-r border-border p-5 sm:border-b-0"><p className="text-[10px] uppercase tracking-[.12em] text-muted-foreground">{platform.label}</p><p className="mt-3 text-2xl font-semibold">{formatNumber(platform.value)}</p><p className="mt-1 text-xs text-muted-foreground">Observed {formatDate(platform.date)}</p></div>)}</div>
    <section className="mt-10 grid gap-10 xl:grid-cols-[1.1fr_.9fr]"><Panel title="Current Instagram movement"><div className="grid grid-cols-2 gap-6"><div><p className="text-xs text-muted-foreground">Follower change</p><p className="mt-2 text-2xl font-semibold">{formatSigned(artist.instagram.change)}</p></div><div><p className="text-xs text-muted-foreground">Growth</p><p className="mt-2 text-2xl font-semibold">{formatPercent(artist.instagram.growthPercent)}</p></div></div><p className="mt-5 text-xs text-muted-foreground">{artist.instagram.change === null ? "Comparable observations unavailable" : `${formatDate(artist.instagram.baselineAt)} → ${formatDate(artist.instagram.observedAt)}`}</p></Panel><Panel title="Roster rankings"><div className="space-y-2">{rankingSets.map(([label, roster]) => <div className="flex justify-between border-b border-border py-2 text-sm" key={label}><span>{label}</span><b>{roster.findIndex((entry) => entry.name === artist.name) + 1 || "—"}</b></div>)}</div></Panel></section>
    <section className="mt-10 grid gap-10 xl:grid-cols-3"><Panel title="Roster context"><dl className="space-y-3 text-sm"><div className="flex justify-between"><dt>Instagram audience</dt><dd>{currentPercentile === null ? "—" : `Top ${Math.max(1, Math.round(100 - currentPercentile + 1))}%`}</dd></div><div className="flex justify-between"><dt>Current growth</dt><dd>{growthPercentile === null ? "—" : `Top ${Math.max(1, Math.round(100 - growthPercentile + 1))}%`}</dd></div></dl></Panel><Panel title="Monthly signal"><p className="font-serif text-3xl">{trajectory(artist.monthlyHistory)}</p><p className="mt-3 text-sm text-muted-foreground">{monthlyConsistency(artist)}</p></Panel><Panel title="Recorded range"><p className="text-2xl font-semibold">{performance ? formatSigned(performance.change) : "—"}</p><p className="mt-2 text-sm text-muted-foreground">{performance ? `${performance.start.month} → ${performance.end.month} · ${formatPercent(performance.growthPercent)}` : "Insufficient valid monthly history"}</p>{recordHigh(artist) && <p className="mt-3 text-xs font-medium uppercase tracking-[.12em] text-primary">New recorded high</p>}</Panel></section>
    <section className="mt-10"><Panel title="Instagram history"><MonthlyLine artists={[artist]} /></Panel></section>
    <section className="mt-10 grid gap-10 xl:grid-cols-[1.1fr_.9fr]"><Panel title="Monthly development"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="pb-2">Month</th><th>Followers</th><th>Change</th><th>Growth</th></tr></thead><tbody>{monthly.map((point) => <tr className="border-b border-border" key={point.month}><td className="py-3">{point.month}</td><td>{formatNumber(point.followers)}</td><td>{formatSigned(point.change)}</td><td>{formatPercent(point.pct)}</td></tr>)}</tbody></table></div></Panel><Panel title="Trajectory"><p className="font-serif text-3xl">{trajectory(artist.monthlyHistory)}</p><div className="mt-8 space-y-3">{Object.entries(artist.urls).filter(([, url]) => url).map(([platform, url]) => <a className="flex items-center gap-2 text-sm text-primary" href={url ?? undefined} target="_blank" rel="noreferrer" key={platform}>{platform === "residentAdvisor" ? "Resident Advisor" : platform}<ExternalLink className="size-3" /></a>)}</div></Panel></section>
  </PageFrame>;
}
