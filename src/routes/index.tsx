import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CircleAlert, ExternalLink, RefreshCw, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { getAudienceMonitor, type AudienceMonitorData } from "@/lib/audience-monitor.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Minor AM Audience Monitor" },
      { name: "description", content: "Live audience monitoring across Instagram, SoundCloud, and Resident Advisor." },
      { property: "og:title", content: "Minor AM Audience Monitor" },
      { property: "og:description", content: "Live audience monitoring across Instagram, SoundCloud, and Resident Advisor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Platform = "instagram" | "soundcloud" | "residentAdvisor";
const platforms: { id: Platform; label: string; short: string }[] = [
  { id: "instagram", label: "Instagram", short: "IG" },
  { id: "soundcloud", label: "SoundCloud", short: "SC" },
  { id: "residentAdvisor", label: "Resident Advisor", short: "RA" },
];

function number(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("en-US").format(value);
}
function change(value: number | null) {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${new Intl.NumberFormat("en-US").format(value)}`;
}
function date(value: string | null) {
  return value ? value : "—";
}

function Index() {
  const fetchMonitor = useServerFn(getAudienceMonitor);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("instagram");
  const query = useQuery({ queryKey: ["audience-monitor"], queryFn: () => fetchMonitor(), refetchInterval: 300000, staleTime: 240000 });
  const data = query.data as AudienceMonitorData | undefined;
  const selected = platforms.find((platform) => platform.id === selectedPlatform) ?? platforms[0];
  const leaders = useMemo(() => data?.artists.slice().sort((a, b) => (b.metrics[selectedPlatform].audience ?? -1) - (a.metrics[selectedPlatform].audience ?? -1)).slice(0, 5) ?? [], [data, selectedPlatform]);
  const maxAudience = Math.max(...leaders.map((artist) => artist.metrics[selectedPlatform].audience ?? 0), 1);

  if (query.isLoading && !data) return <main className="min-h-screen bg-background" />;
  if (!data) return <Unavailable onRetry={() => query.refetch()} />;

  return (
    <main className="min-h-screen bg-background px-5 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-border pb-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Minor AM</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">Audience Monitor</h1>
              <p className="mt-2 text-sm text-muted-foreground">Live roster and platform audiences</p>
            </div>
            <div className="flex items-center gap-3 text-right">
              <div className="text-xs text-muted-foreground"><span className="block font-medium text-foreground">Last refreshed</span>{new Date(data.refreshedAt).toLocaleString()}</div>
              <Button variant="outline" size="icon" onClick={() => query.refetch()} disabled={query.isFetching} aria-label="Refresh data" title="Refresh data"><RefreshCw className={query.isFetching ? "animate-spin" : ""} /></Button>
            </div>
          </div>
        </header>

        {query.isError && <div className="mt-5 flex items-center gap-2 border border-border bg-muted px-4 py-3 text-sm text-muted-foreground"><CircleAlert className="size-4" /> Showing the most recently available data while the live source reconnects.</div>}

        <section className="grid gap-px border-x border-y border-border bg-border sm:grid-cols-3" aria-label="Platform overview">
          {platforms.map((platform) => {
            const observed = data.artists.map((artist) => artist.metrics[platform.id].observedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
            return <div key={platform.id} className="bg-background p-5"><p className="text-sm font-medium text-foreground">{platform.label}</p><p className="mt-5 text-3xl font-semibold text-foreground">{data.artists.filter((artist) => artist.metrics[platform.id].audience !== null).length}</p><p className="mt-1 text-xs text-muted-foreground">artists observed · latest {date(observed)}</p></div>;
          })}
        </section>

        <section className="mt-9 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-lg font-semibold text-foreground">Roster</h2><p className="mt-1 text-sm text-muted-foreground">Current audience and one-month movement, kept separate by platform.</p></div><span className="text-sm text-muted-foreground">{data.artists.length} artists</span></div>
            <div className="mt-5 overflow-x-auto border-y border-border"><table className="min-w-[860px] w-full text-left text-sm"><thead className="border-b border-border text-xs uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-3 py-3 font-medium">Artist</th>{platforms.map((platform) => <th key={platform.id} className="px-3 py-3 font-medium">{platform.short} audience</th>)}{platforms.map((platform) => <th key={`${platform.id}-change`} className="px-3 py-3 font-medium">{platform.short} 1M</th>)}</tr></thead><tbody>{data.artists.map((artist) => <tr key={artist.name} className="border-b border-border last:border-0"><td className="px-3 py-4"><p className="font-medium text-foreground">{artist.name}</p><p className="mt-1 text-xs text-muted-foreground">{[artist.location, artist.role].filter(Boolean).join(" · ") || "—"}</p></td>{platforms.map((platform) => <td key={platform.id} className="px-3 py-4 text-foreground">{number(artist.metrics[platform.id].audience)}<span className="mt-1 block text-xs text-muted-foreground">{date(artist.metrics[platform.id].observedAt)}</span></td>)}{platforms.map((platform) => <td key={`${platform.id}-change`} className="px-3 py-4 text-foreground">{change(artist.metrics[platform.id].oneMonthChange)}</td>)}</tr>)}</tbody></table></div>
          </div>
          <aside className="border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0"><div className="flex items-center gap-2"><BarChart3 className="size-4 text-muted-foreground"/><h2 className="text-lg font-semibold text-foreground">Platform leaders</h2></div><div className="mt-5 flex border border-border">{platforms.map((platform) => <button key={platform.id} type="button" onClick={() => setSelectedPlatform(platform.id)} className={`flex-1 px-2 py-2 text-xs font-medium ${selectedPlatform === platform.id ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>{platform.short}</button>)}</div><div className="mt-6 space-y-5">{leaders.map((artist) => { const metric = artist.metrics[selectedPlatform]; return <div key={artist.name}><div className="flex justify-between gap-3 text-sm"><span className="font-medium text-foreground">{artist.name}</span><span className="text-foreground">{number(metric.audience)}</span></div><div className="mt-2 h-1.5 bg-muted"><div className="h-full bg-primary" style={{ width: `${((metric.audience ?? 0) / maxAudience) * 100}%` }} /></div></div>})}</div><p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">{selected.label} · latest recorded audience</p></aside>
        </section>
      </div>
    </main>
  );
}

function Unavailable({ onRetry }: { onRetry: () => void }) {
  return <main className="flex min-h-screen items-center justify-center bg-background px-5"><div className="max-w-md border-l-2 border-primary pl-5"><Users className="size-5 text-primary"/><h1 className="mt-4 text-2xl font-semibold text-foreground">Audience Monitor</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">The live audience data is temporarily unavailable. Please try again shortly.</p><Button className="mt-5" onClick={onRetry}><RefreshCw /> Try again</Button></div></main>;
}
