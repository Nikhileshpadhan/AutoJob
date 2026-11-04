import { NextResponse } from "next/server";
import { sendTelegramMessageDetails } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const text = `🤖 *AutoJob Automation Alert Test*
Timestamp: ${new Date().toLocaleString()}

Your Telegram human-in-the-loop notification bridge is online and connected! If a CAPTCHA or security checkpoint is encountered by Playwright, an instant snapshot and pause alert will be delivered here.`;

    const result = await sendTelegramMessageDetails(text);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send message. Please verify your TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in settings." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: "Telegram test message sent successfully!" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
