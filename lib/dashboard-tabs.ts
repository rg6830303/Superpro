// Shared by the server pages and the client view, so it must not live in a
// "use client" module (server code would get a client reference, not the array).
export const DASHBOARD_TABS = ["overview", "bookings", "community", "rankings", "activity", "wallet", "profile"] as const;
export type TabKey = (typeof DASHBOARD_TABS)[number];

export const TAB_TITLES: Record<TabKey, string> = {
  overview: "My clubhouse",
  bookings: "My bookings",
  community: "Community",
  rankings: "Leaderboard",
  activity: "Activity",
  wallet: "Wallet",
  profile: "My profile",
};

export const tabHref = (tab: TabKey) => (tab === "overview" ? "/dashboard" : `/dashboard/${tab}`);

/** Community standings row: public directory columns plus position. */
export type RankRow = {
  id: string;
  handle: string | null;
  full_name: string;
  avatar_url: string | null;
  skill_level: string;
  dupr: number | null;
  games: number;
  followers: number;
  rank: number;
};
