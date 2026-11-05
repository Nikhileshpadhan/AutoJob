"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";

  if (isLandingPage) {
    return (
      <div className="min-h-screen w-full bg-[#141516] text-white overflow-x-hidden selection:bg-[#CCF2DF]/20 selection:text-white">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141516] text-white antialiased flex selection:bg-[#CCF2DF]/20 selection:text-white font-sans w-full">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen lg:ml-64">
        <Header />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

