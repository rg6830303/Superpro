import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppFab } from "@/components/whatsapp-fab";
import { ReadProgress } from "@/components/motion";

/**
 * Public-site chrome. The admin console sits outside this group so it never
 * inherits the customer header, footer or WhatsApp launcher.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ReadProgress />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <WhatsAppFab />
    </div>
  );
}
