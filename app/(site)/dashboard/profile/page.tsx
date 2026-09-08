import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ProfileForm } from "@/components/profile-form";
import { getUserRow } from "@/lib/accounts";
import { getPlayerSession } from "@/lib/auth";
import { ensureSchema } from "@/lib/schema";
import { listWalletTransactions } from "@/lib/wallet";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Profile & wallet", robots: { index: false } };

export default async function ProfilePage() {
  const session = await getPlayerSession();
  if (!session) redirect("/login?next=/dashboard/profile");

  await ensureSchema();
  const [profile, transactions] = await Promise.all([
    getUserRow(session.id),
    listWalletTransactions(session.id, 25),
  ]);

  return (
    <div className="wrap max-w-3xl py-14">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-bone/50 hover:text-gold">
        <ChevronLeft size={16} /> My account
      </Link>

      <p className="eyebrow mt-6">Profile &amp; wallet</p>
      <h1 className="mt-2 text-[clamp(2.25rem,6vw,3.5rem)]">Your details</h1>
      <p className="mt-3 text-sm text-bone/50">
        Kept in step with your SuperPro account. Your email is managed by sign-in and cannot be changed here —
        message a rep if you need it moved.
      </p>

      <div className="mt-9">
        <ProfileForm
          profile={{
            email: profile?.email ?? session.email,
            full_name: profile?.full_name ?? session.name,
            phone: profile?.phone ?? "",
            skill_level: profile?.skill_level ?? "beginner",
            city: profile?.city ?? "Kolkata",
            dupr: profile?.dupr ?? null,
            whatsapp_opt_in: profile?.whatsapp_opt_in ?? true,
            wallet_balance_paise: Number(profile?.wallet_balance_paise ?? 0),
          }}
          transactions={transactions}
        />
      </div>
    </div>
  );
}
