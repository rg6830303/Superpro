import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { renderDashboard } from "../load";
import { DASHBOARD_TABS, TAB_TITLES, type TabKey } from "@/lib/dashboard-tabs";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ section: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  return { title: TAB_TITLES[section as TabKey] ?? "My clubhouse", robots: { index: false } };
}

export default async function DashboardSectionPage({ params }: Props) {
  const { section } = await params;
  if (section === "discover") redirect("/dashboard/community");
  if (section === "overview") redirect("/dashboard");
  if (!(DASHBOARD_TABS as readonly string[]).includes(section)) notFound();
  return renderDashboard(section as TabKey);
}
