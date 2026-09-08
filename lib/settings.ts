import { query, withTimeout } from "@/lib/db";

/**
 * Operator-editable key/value settings, changed from the admin console without
 * a redeploy. Defaults below are used whenever a key is missing, so a fresh
 * database renders a complete site.
 */
export const SETTING_DEFAULTS: Record<string, string> = {
  whatsapp_number: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "919163132551",
  whatsapp_group_url: process.env.NEXT_PUBLIC_WHATSAPP_GROUP_URL ?? "",
  rep_name: "Team SuperPro",
  daily_game_price: "35000",
  coaching_rate: "120000",
  home_notice: "",
  booking_terms:
    "Slots are held for 20 minutes when paying at the venue. Cancellations up to 6 hours before the slot are fully credited.",
};

export type Settings = Record<string, string>;

export async function getSettings(): Promise<Settings> {
  return withTimeout(
    "settings",
    async () => {
      const rows = await query<{ key: string; value: string | null }>("SELECT key, value FROM settings");
      const out: Settings = { ...SETTING_DEFAULTS };
      for (const r of rows) if (r.value !== null) out[r.key] = r.value;
      return out;
    },
    { ...SETTING_DEFAULTS },
  );
}

export async function getSetting(key: string): Promise<string> {
  const all = await getSettings();
  return all[key] ?? "";
}

export async function setSettings(patch: Settings): Promise<void> {
  const entries = Object.entries(patch);
  for (const [key, value] of entries) {
    await query(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, value],
    );
  }
}
