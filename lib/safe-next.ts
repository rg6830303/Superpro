/**
 * Where to send someone after signing in or registering. Only same-site paths
 * are accepted: "/players/x" yes; "https://evil.example", "//evil.example" or
 * "/\evil.example" fall back — otherwise a crafted link could bounce a player
 * off-site the moment they sign in.
 */
export function safeNext(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}

/** Sign-in link that brings the visitor back to a player's page afterwards. */
export function signInToView(handle: string): string {
  return `/login?next=${encodeURIComponent(`/players/${handle}`)}`;
}
