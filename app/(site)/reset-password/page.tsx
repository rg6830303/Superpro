import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/password-reset-forms";
import { checkResetToken } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const token = ((await searchParams) ?? {}).token ?? "";
  // Checked up front so an expired or used link says so before anyone types.
  const check = await checkResetToken(token).catch(() => ({ ok: false as const, error: "This reset link is not valid." }));
  return (
    <div className="wrap max-w-md section">
      <ResetPasswordForm token={token} invalid={check.ok ? null : check.error} />
    </div>
  );
}
