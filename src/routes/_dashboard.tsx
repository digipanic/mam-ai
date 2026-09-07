import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DashboardShell } from "@/components/audience/dashboard-shell";
import { useAudienceMonitor } from "@/hooks/use-audience-monitor";
export const Route = createFileRoute("/_dashboard")({ component: DashboardLayout });
function DashboardLayout(){const query=useAudienceMonitor(); if(!query.data)return <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Loading live audience data…</main>; return <DashboardShell data={query.data} isRefreshing={query.isFetching} onRefresh={()=>query.refetch()}>{query.isError&&<div className="border-b border-border bg-secondary px-5 py-2 text-xs text-muted-foreground lg:px-12">Live refresh is temporarily unavailable. Showing the last successful data.</div>}<Outlet/></DashboardShell>}
