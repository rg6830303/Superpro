import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FloatingActions } from "@/components/floating-actions";
import { ReadProgress } from "@/components/motion";
import { WelcomePopup } from "@/components/welcome-popup";
import { AmbientBackdrop } from "@/components/ambient-backdrop";
import { Suspense } from "react";
import { headers } from "next/headers";
import { surfaceOfHost } from "@/lib/surface";
import { getPlayerSession } from "@/lib/auth";

/**
 * Public-site chrome. The admin console sits outside this group so it never
 * inherits the customer header, footer or WhatsApp launcher.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const surface = surfaceOfHost((await headers()).get("host"));
  const signedIn = Boolean(await getPlayerSession().catch(() => null));
  return (
    <div className="flex min-h-screen flex-col">
      {/* Behind everything, and the reason the content below carries a
          stacking context of its own. */}
      <AmbientBackdrop />
      {/* The entrance makes this subtree inert while it plays, so everything
          the visitor could otherwise reach behind it lives inside it. */}
      <div data-site-content className="flex min-h-screen flex-col">
        <ReadProgress />
        <SiteHeader surface={surface} signedIn={signedIn} />
        <div data-menu-content className="flex flex-1 flex-col">
          <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>
          <SiteFooter surface={surface} />
          {/* The main (launch) domain gets neither launcher: both offer bookings,
              coaching and orders, which are not open yet. */}
          {surface !== "main" && <FloatingActions />}
        </div>
      </div>
      {/* Reads the `welcome` query param, so it needs a suspense boundary. */}
      <Suspense fallback={null}>
        <WelcomePopup />
      </Suspense>
    </div>
  );
}
