import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CoachAuthForm } from "@/components/coach-auth-form";
import { getCoachSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Coach sign in", robots: { index: false } };

export default async function CoachLoginPage() {
  if (await getCoachSession()) redirect("/coach");
  return (
    <div className="wrap max-w-md section">
      <CoachAuthForm mode="login" />
    </div>
  );
}
