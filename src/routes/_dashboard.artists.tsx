import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/artists")({
  component: ArtistsLayout,
});

function ArtistsLayout() {
  return <Outlet />;
}