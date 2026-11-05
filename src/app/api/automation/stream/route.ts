import { getRecentLogs, telemetryEmitter, type LogEntry } from "@/lib/automation/logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial hydration logs
      const recent = getRecentLogs();
      const initialPayload = `event: init\ndata: ${JSON.stringify(recent)}\n\n`;
      controller.enqueue(encoder.encode(initialPayload));

      // 2. Listen to real-time events
      const onLog = (entry: LogEntry) => {
        try {
          const chunk = `event: log\ndata: ${JSON.stringify(entry)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        } catch {
          telemetryEmitter.off("log", onLog);
        }
      };

      telemetryEmitter.on("log", onLog);

      // Keepalive heartbeat every 15 seconds
      const heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeatTimer);
          telemetryEmitter.off("log", onLog);
        }
      }, 15000);

      // Clean up on disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatTimer);
        telemetryEmitter.off("log", onLog);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
