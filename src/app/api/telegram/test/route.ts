import { NextResponse } from "next/server";
import { sendTelegramMessageDetails } from "@/lib/telegram";
import { requireAuth, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    const text = `🤖 *AutoJob Automation Alert Test*
Timestamp: ${new Date().toLocaleString()}

Your Telegram human-in-the-loop notification bridge is online and connected! If a CAPTCHA or security checkpoint is encountered by Playwright, an instant snapshot and pause alert will be delivered here.`;

    const result = await sendTelegramMessageDetails(text, auth.userId);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send message. Please verify your TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in settings." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: "Telegram test message sent successfully!" });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
