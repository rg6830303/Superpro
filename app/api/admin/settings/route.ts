import { NextResponse } from "next/server";
import { adminGate, audit, serverError } from "@/lib/admin";
import { getSettings, setSettings } from "@/lib/settings";
import { whatsappConfig } from "@/lib/whatsapp";
import { isRazorpayEnabled } from "@/lib/razorpay";
import { dbConnInfo } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const settings = await getSettings();
    return NextResponse.json({
      settings,
      integrations: {
        whatsapp: whatsappConfig,
        razorpay: isRazorpayEnabled,
        db: dbConnInfo(),
        adminHost: process.env.NEXT_PUBLIC_ADMIN_HOST ?? null,
      },
    });
  } catch (err) {
    return serverError("settings:get", err);
  }
}

export async function PUT(req: Request) {
  const gate = await adminGate();
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, string>;
    const patch: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      if (typeof v === "string" && k.length < 64) patch[k] = v;
    }
    await setSettings(patch);
    await audit(gate, "settings.update", "settings", undefined, { keys: Object.keys(patch) });
    return NextResponse.json({ ok: true, settings: await getSettings() });
  } catch (err) {
    return serverError("settings:put", err);
  }
}
