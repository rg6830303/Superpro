import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { getPlayerSession } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ next?: string }> }) {
  const session = await getPlayerSession();
  if (session) redirect(safeNext(((await searchParams) ?? {}).next));

  return (
    <div className="wrap max-w-md section">
      <Suspense fallback={<p className="text-sm text-ink/55">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
