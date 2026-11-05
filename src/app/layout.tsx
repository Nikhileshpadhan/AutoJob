import type { Metadata, Viewport } from "next";
import "@fontsource/geist/400.css";
import "@fontsource/geist/500.css";
import "@fontsource/geist/600.css";
import "@fontsource/geist/700.css";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "@fontsource/ibm-plex-serif/400.css";
import "@fontsource/ibm-plex-serif/500.css";
import "@fontsource/ibm-plex-serif/600.css";
import "@fontsource/ibm-plex-serif/400-italic.css";
import "@fontsource/ibm-plex-serif/500-italic.css";
import "./globals.css";

import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { TelemetryProvider } from "@/components/telemetry-provider";

export const metadata: Metadata = {
  title: "AutoJob — Autonomous Career Command Center",
  description:
    "Autonomous multi-platform job application runner with strict daily pacing, dynamic LLM tailoring, and Telegram-backed human-in-the-loop verification.",
};

export const viewport: Viewport = {
  themeColor: "#141516",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className="min-h-screen bg-[#141516] text-[#FFFFFF] antialiased selection:bg-[#CCF2DF]/20 selection:text-white font-sans"
        suppressHydrationWarning
      >
        <ToastProvider>
          <TelemetryProvider>
            <AppShell>{children}</AppShell>
          </TelemetryProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
