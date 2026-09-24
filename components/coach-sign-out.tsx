"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function CoachSignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/coach/auth/logout", { method: "POST" }).catch(() => {});
        router.push("/coach/login");
        router.refresh();
      }}
      className="btn-outline btn-sm"
    >
      <LogOut size={14} /> Sign out
    </button>
  );
}
