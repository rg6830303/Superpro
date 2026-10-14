"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

export function LogoutButton({ admin = false, className = "btn-outline btn-sm" }: { admin?: boolean; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch(admin ? "/api/admin/auth/logout" : "/api/auth/logout", { method: "POST" });
    router.push(admin ? "/admin/login" : "/");
    router.refresh();
  }

  return (
    <button type="button" onClick={logout} disabled={busy} className={className}>
      <LogOut size={14} /> {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
