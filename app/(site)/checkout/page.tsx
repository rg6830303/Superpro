import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout-form";
import { isRazorpayEnabled, razorpayKeyId } from "@/lib/razorpay";
import { getPlayerSession } from "@/lib/auth";
import { getUserRow } from "@/lib/accounts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your SuperPro order — pickup at TurfXL or delivery across Kolkata.",
  robots: { index: false },
};

export default async function CheckoutPage() {
  const session = await getPlayerSession();
  const profile = session ? await getUserRow(session.id) : null;
  return (
    <div className="wrap section">
      <p className="eyebrow">Checkout</p>
      <h1 className="mt-3 headline-page">Almost on court</h1>
      <p className="mt-3 max-w-xl text-sm text-ink/65">
        One screen. No account needed — we&apos;ll confirm everything on WhatsApp.
      </p>

      <div className="mt-10">
        <CheckoutForm
          razorpayEnabled={isRazorpayEnabled}
          razorpayKeyId={razorpayKeyId}
          walletPaise={Number(profile?.wallet_balance_paise ?? 0)}
          defaults={
            profile
              ? { name: profile.full_name, phone: profile.phone ?? "", email: profile.email }
              : undefined
          }
        />
      </div>
    </div>
  );
}
