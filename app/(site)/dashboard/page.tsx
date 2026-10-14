import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { renderDashboard } from "./load";
import { DASHBOARD_TABS } from "@/lib/dashboard-tabs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "My clubhouse", robots: { index: false } };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  // Old ?tab= links (notifications, the caddy, bookmarks) land on the new pages.
  const { tab } = (await searchParams) ?? {};
  if (tab) {
    const section = tab === "discover" ? "community" : tab;
    if (section !== "overview" && (DASHBOARD_TABS as readonly string[]).includes(section)) redirect(`/dashboard/${section}`);
  }
  return renderDashboard("overview");
}
