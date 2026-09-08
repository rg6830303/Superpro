import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/shell";

export const metadata: Metadata = {
  title: { default: "SuperPro Admin", template: "%s · SuperPro Admin" },
  // The console must never be indexed, on any host.
  robots: { index: false, follow: false, nocache: true },
  manifest: "/admin.webmanifest",
  icons: { icon: "/icons/admin-icon-192.png", apple: "/icons/admin-apple-touch-icon.png" },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
