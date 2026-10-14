/** Client-safe: no database imports here (see badges-server.ts). */
/** The badge catalogue. `custom` lets the admin name a one-off badge. */
export const BADGES = [
  { key: "founding_member", label: "Founding member", tone: "volt" },
  { key: "club_captain", label: "Club captain", tone: "ink" },
  { key: "tournament_winner", label: "Tournament winner", tone: "gold" },
  { key: "runner_up", label: "Runner-up", tone: "silver" },
  { key: "most_improved", label: "Most improved", tone: "sky" },
  { key: "regular", label: "Court regular", tone: "volt" },
  { key: "fair_play", label: "Fair play", tone: "sky" },
  { key: "coach", label: "Coach", tone: "ink" },
  { key: "volunteer", label: "Volunteer", tone: "blush" },
  { key: "custom", label: "Custom badge", tone: "lilac" },
] as const;

export type BadgeKey = (typeof BADGES)[number]["key"];
export type UserBadge = { id: string; badge: string; label: string; note: string | null; created_at: string };

export const badgeTone = (key: string) => BADGES.find((b) => b.key === key.split(":")[0])?.tone ?? "lilac";

