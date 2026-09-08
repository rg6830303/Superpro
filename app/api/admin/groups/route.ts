import { NextResponse } from "next/server";
import { adminGate, audit, badRequest, serverError } from "@/lib/admin";
import { query } from "@/lib/db";
import { sendWhatsApp, tournamentGroupMessage } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Reg = { id: string; team_name: string; player1_dupr: number | null; player2_dupr: number | null };

export async function GET(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const tournamentId = new URL(req.url).searchParams.get("tournament_id");
    if (!tournamentId) return badRequest("Missing tournament id.");
    const groups = await query(
      `SELECT g.*, COALESCE(
                (SELECT COUNT(*) FROM tournament_registrations r WHERE r.group_id = g.id), 0)::int AS teams
       FROM tournament_groups g WHERE g.tournament_id = $1 ORDER BY g.name`,
      [tournamentId],
    );
    return NextResponse.json({ groups });
  } catch (err) {
    return serverError("groups:list", err);
  }
}

/**
 * Actions:
 *   auto     — wipe and rebuild the draw, snake-seeding confirmed teams by
 *              combined DUPR so every group has comparable strength
 *   create   — add one empty group
 *   publish  — post the finished draw to the WhatsApp group
 */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const tournamentId = String(body.tournament_id ?? "");
    if (!tournamentId) return badRequest("Missing tournament id.");
    const action = String(body.action ?? "auto");

    if (action === "create") {
      const rows = await query<{ id: string }>(
        `INSERT INTO tournament_groups (tournament_id, name, court_number, scheduled_at)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [tournamentId, body.name ?? "Group", body.court_number ?? null, body.scheduled_at ?? null],
      );
      await audit(gate, "group.create", "tournament_groups", rows[0].id);
      return NextResponse.json({ ok: true, id: rows[0].id });
    }

    if (action === "publish") {
      const rows = await query<{ name: string; court_number: number | null; team_name: string | null }>(
        `SELECT g.name, g.court_number, r.team_name
         FROM tournament_groups g
         LEFT JOIN tournament_registrations r ON r.group_id = g.id AND r.status <> 'withdrawn'
         WHERE g.tournament_id = $1 ORDER BY g.name, r.seed NULLS LAST, r.team_name`,
        [tournamentId],
      );
      const title = await query<{ title: string }>(`SELECT title FROM tournaments WHERE id = $1`, [tournamentId]);

      const grouped = new Map<string, { name: string; court: number | null; teams: string[] }>();
      for (const r of rows) {
        if (!grouped.has(r.name)) grouped.set(r.name, { name: r.name, court: r.court_number, teams: [] });
        if (r.team_name) grouped.get(r.name)!.teams.push(r.team_name);
      }

      const message = tournamentGroupMessage({
        tournament: title[0]?.title ?? "SuperPro Tournament",
        groups: [...grouped.values()],
      });
      const result = await sendWhatsApp({
        kind: "tournament_groups",
        target: "group",
        message,
        refTable: "tournaments",
        refId: tournamentId,
      });
      await audit(gate, "group.publish", "tournaments", tournamentId);
      return NextResponse.json({ ok: result.status !== "failed", result, message });
    }

    // ── auto-grouping ──────────────────────────────────────────────────────
    const size = Math.max(2, Number(body.group_size ?? 4));
    const teams = await query<Reg>(
      `SELECT id, team_name, player1_dupr, player2_dupr
       FROM tournament_registrations
       WHERE tournament_id = $1 AND status IN ('confirmed','pending')
       ORDER BY (COALESCE(player1_dupr,0) + COALESCE(player2_dupr,0)) DESC, created_at`,
      [tournamentId],
    );
    if (teams.length === 0) return badRequest("No teams to group yet.");

    const groupCount = Math.max(1, Math.ceil(teams.length / size));
    await query(`DELETE FROM tournament_groups WHERE tournament_id = $1`, [tournamentId]);

    const groupIds: string[] = [];
    for (let i = 0; i < groupCount; i++) {
      const rows = await query<{ id: string }>(
        `INSERT INTO tournament_groups (tournament_id, name, court_number)
         VALUES ($1,$2,$3) RETURNING id`,
        [tournamentId, `Group ${String.fromCharCode(65 + i)}`, i + 1],
      );
      groupIds.push(rows[0].id);
    }

    // Snake seeding: 1→A, 2→B, 3→C, 4→C, 5→B, 6→A … keeps group strength even.
    for (let i = 0; i < teams.length; i++) {
      const round = Math.floor(i / groupCount);
      const posInRound = i % groupCount;
      const idx = round % 2 === 0 ? posInRound : groupCount - 1 - posInRound;
      await query(`UPDATE tournament_registrations SET group_id = $1, seed = $2 WHERE id = $3`, [
        groupIds[idx],
        i + 1,
        teams[i].id,
      ]);
    }

    await audit(gate, "group.auto", "tournaments", tournamentId, { groups: groupCount, teams: teams.length });
    return NextResponse.json({ ok: true, groups: groupCount, teams: teams.length });
  } catch (err) {
    return serverError("groups:action", err);
  }
}

export async function PATCH(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // Move one team between groups.
    if (body.registration_id) {
      await query(`UPDATE tournament_registrations SET group_id = $1 WHERE id = $2`, [
        body.group_id ?? null,
        body.registration_id,
      ]);
      return NextResponse.json({ ok: true });
    }

    if (!body.id) return badRequest("Missing group id.");
    await query(
      `UPDATE tournament_groups SET name = COALESCE($1, name), court_number = $2, scheduled_at = $3 WHERE id = $4`,
      [body.name ?? null, body.court_number ?? null, body.scheduled_at ?? null, body.id],
    );
    await audit(gate, "group.update", "tournament_groups", String(body.id), body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("groups:update", err);
  }
}

export async function DELETE(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return badRequest("Missing group id.");
    await query(`DELETE FROM tournament_groups WHERE id = $1`, [id]);
    await audit(gate, "group.delete", "tournament_groups", id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("groups:delete", err);
  }
}
