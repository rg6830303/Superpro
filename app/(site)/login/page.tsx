import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { getPlayerSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage() {
  const session = await getPlayerSession();
  if (session) redirect("/dashboard");

  return (
    <div className="wrap max-w-md py-16">
      <Suspense fallback={<p className="text-sm text-ink/55">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
