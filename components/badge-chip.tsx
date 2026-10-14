import { Award } from "lucide-react";
import { badgeTone } from "@/lib/badges";

const TONES: Record<string, string> = {
  volt: "bg-[#d9ef75] text-[#193d32]",
  ink: "bg-[#193d32] text-white",
  gold: "bg-[#f3d77a] text-[#4a3a0c]",
  silver: "bg-[#dfe3e6] text-[#33403a]",
  sky: "bg-[#cfe4f3] text-[#1d4660]",
  blush: "bg-[#f4d3d6] text-[#5e2a31]",
  lilac: "bg-[#e3d9f5] text-[#3e2f63]",
};

export function BadgeChip({ badge, label }: { badge: string; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${TONES[badgeTone(badge)] ?? TONES.lilac}`}>
      <Award size={12} /> {label}
    </span>
  );
}
