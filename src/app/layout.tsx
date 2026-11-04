import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "AutoJob — 24/7 Background Job Automation Engine",
  description:
    "Autonomous multi-platform job application runner with strict daily pacing, dynamic LLM tailoring, and Telegram-backed human-in-the-loop CAPTCHA bypass.",
};

export const viewport: Viewport = {
  themeColor: "#0f1318",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased flex selection:bg-primary/20 selection:text-foreground" suppressHydrationWarning>
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-screen lg:ml-64">
          <Header />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-[1200px] w-full mx-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
