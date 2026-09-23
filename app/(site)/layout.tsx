import { BootCover } from "@/components/boot-cover";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppFab } from "@/components/whatsapp-fab";
import { AIChatbot } from "@/components/ai-chatbot";
import { ReadProgress } from "@/components/motion";
import { WelcomePopup } from "@/components/welcome-popup";
import { SmashIntro } from "@/components/smash-intro";
import { Suspense } from "react";

/**
 * Public-site chrome. The admin console sits outside this group so it never
 * inherits the customer header, footer or WhatsApp launcher.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* First in the group so it is painted before anything it covers. */}
      <BootCover />
      {/* The entrance makes this subtree inert while it plays, so everything
          the visitor could otherwise reach behind it lives inside it. */}
      <div data-site-content className="flex min-h-screen flex-col">
        <ReadProgress />
        <SiteHeader />
        <div data-menu-content className="flex flex-1 flex-col">
          <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>
          <SiteFooter />
          <WhatsAppFab />
          <AIChatbot />
        </div>
      </div>
      {/* Both read the `welcome` query param, so both need a suspense boundary. */}
      <Suspense fallback={null}>
        <SmashIntro />
        <WelcomePopup />
      </Suspense>
    </div>
  );
}
