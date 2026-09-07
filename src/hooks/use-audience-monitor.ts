import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAudienceMonitor } from "@/lib/audience-monitor.functions";
export function useAudienceMonitor() { const fetchMonitor = useServerFn(getAudienceMonitor); return useQuery({ queryKey: ["audience-monitor"], queryFn: () => fetchMonitor(), refetchInterval: 300000, staleTime: 240000, retry: 1 }); }
