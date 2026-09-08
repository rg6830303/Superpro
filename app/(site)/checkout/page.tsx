import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout-form";
import { isRazorpayEnabled, razorpayKeyId } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your SuperPro order — pickup at TurfXL or delivery across Kolkata.",
  robots: { index: false },
};

export default function CheckoutPage() {
  return (
    <div className="wrap py-14">
      <p className="eyebrow">Checkout</p>
      <h1 className="mt-3 text-[clamp(2.25rem,6vw,3.5rem)]">Almost on court</h1>
      <p className="mt-3 max-w-xl text-sm text-bone/50">
        One screen. No account needed — we&apos;ll confirm everything on WhatsApp.
      </p>

      <div className="mt-10">
        <CheckoutForm razorpayEnabled={isRazorpayEnabled} razorpayKeyId={razorpayKeyId} />
      </div>
    </div>
  );
}
