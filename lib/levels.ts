import type { SkillLevel } from "@/lib/types";

/**
 * Playing up requires permission; playing down never does.
 *
 * A slot advertises the standard of play it is for. Someone rated below that
 * standard can still ask in — the club would rather have the conversation than
 * turn a keen player away — but an admin approves it, so an advanced court does
 * not quietly fill with beginners. Dropping down a band is always fine: a
 * stronger player in a beginner game is a help, not a problem.
 */
export type SlotLevel = "all" | "beginner" | "intermediate" | "advanced";

const RANK: Record<string, number> = {
  all: 0,
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  // DUPR-rated players sit at the top of the ladder.
  pro: 4,
};

export function levelRank(level: string | null | undefined): number {
  return RANK[String(level ?? "beginner")] ?? 1;
}

/** True when this player is reaching above the slot's advertised standard. */
export function needsApproval(slotLevel: string | null | undefined, playerLevel: string | null | undefined): boolean {
  if (!slotLevel || slotLevel === "all") return false;
  return levelRank(slotLevel) > levelRank(playerLevel);
}

export const LEVEL_LABEL: Record<string, string> = {
  all: "All levels",
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  pro: "DUPR rated",
};

/** One line explaining why a slot is gated, shown next to the request button. */
export function approvalReason(slotLevel: string, playerLevel: string): string {
  return `${LEVEL_LABEL[slotLevel] ?? slotLevel} court — you're listed as ${
    (LEVEL_LABEL[playerLevel] ?? playerLevel).toLowerCase()
  }, so an admin approves this one.`;
}
