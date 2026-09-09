import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth-forms";
import { getPlayerSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function SignupPage() {
  const session = await getPlayerSession();
  if (session) redirect("/dashboard");

  return (
    <div className="wrap max-w-xl section">
      <SignupForm />
    </div>
  );
}
