import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth-forms";
import { getPlayerSession } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function SignupPage({ searchParams }: { searchParams?: Promise<{ next?: string }> }) {
  const session = await getPlayerSession();
  if (session) redirect(safeNext(((await searchParams) ?? {}).next));

  return (
    <div className="wrap max-w-xl section">
      <Suspense fallback={<p className="text-sm text-ink/40">Loading…</p>}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
