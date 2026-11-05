"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileSpreadsheet,
  UserCheck,
  SlidersHorizontal,
  Bot,
  AlertTriangle,
  X,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTelemetry } from "./telemetry-provider";

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { stats } = useTelemetry();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close on escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    if (mobileOpen) {
      document.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const pendingAlerts = stats?.pendingAlerts ?? 0;
  const awaitingApproval = stats?.totalAwaitingApproval ?? 0;
  const totalApplied = stats?.totalApplied ?? 0;
  const todayApplied = stats?.todayApplied ?? 0;
  const todayCap = stats?.todayCap ?? 10;
  const todayRemaining = stats?.todayRemaining ?? 10;
  const liCap = stats?.platforms?.linkedin?.max_cap ?? 5;
  const liApplied = stats?.platforms?.linkedin?.applied_count ?? 0;
  const isCap = stats?.platforms?.internshala?.max_cap ?? 5;
  const isApplied = stats?.platforms?.internshala?.applied_count ?? 0;

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
      label: "Applications",
      href: "/applications",
      icon: FileSpreadsheet,
      badge: awaitingApproval > 0 ? `${awaitingApproval}` : undefined,
      badgeVariant: "warning",
    },
    { label: "Master profile", href: "/profile", icon: UserCheck },
    { label: "Runner console", href: "/runner", icon: Bot },
    {
      label: "Security alerts",
      href: "/alerts",
      icon: AlertTriangle,
      badge: pendingAlerts > 0 ? `${pendingAlerts}` : undefined,
      badgeVariant: "danger",
    },
    { label: "Settings", href: "/settings", icon: SlidersHorizontal },
  ];

  const sidebarContent = (
    <>
      {/* Brand Header — 80px height to align with Aronya header */}
      <div className="h-20 flex items-center justify-between px-6 border-b border-[#303132] bg-[#141516]">
        <Link
          href="/"
          className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
        >
          <div className="w-8 h-8 rounded-[8px] border-2 border-white flex items-center justify-center bg-transparent">
            <span className="font-serif font-semibold text-sm text-white">A</span>
          </div>
          <div className="leading-tight">
            <span className="font-bold text-sm tracking-widest text-white uppercase block">
              AutoJob
            </span>
            <span className="text-[10px] text-[#CCF2DF] font-mono tracking-wider uppercase">
              Studio Automation
            </span>
          </div>
        </Link>
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[#262728] border border-[#303132] text-[10px] font-mono text-[#B8B9B9]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#CCF2DF]" />
          <span>v2.0</span>
        </div>
        {/* Mobile close button */}
        <button
          className="lg:hidden p-1.5 rounded-[8px] border border-[#303132] text-[#B8B9B9] hover:text-white transition-colors"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links — Uppercase, geometric precision */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto bg-[#131415]">
        <div className="px-3 pb-2 text-[10px] uppercase font-mono tracking-widest text-[#B8B9B9]/60">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center justify-between px-3.5 py-2.5 rounded-[8px] text-xs uppercase tracking-wider font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white",
                isActive
                  ? "bg-[#262728] text-white border-2 border-[#303132] font-semibold"
                  : "text-[#B8B9B9] hover:bg-[#262728]/60 hover:text-white border-2 border-transparent"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    "w-4 h-4 transition-colors",
                    isActive ? "text-[#CCF2DF]" : "text-[#B8B9B9] group-hover:text-white"
                  )}
                />
                <span>{item.label}</span>
              </div>
              {item.badge ? (
                <span
                  className={cn(
                    "text-[10px] font-mono font-bold px-2 py-0.5 rounded-none",
                    item.badgeVariant === "danger"
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Footer: Real Quota & Stats (UX-002) */}
      <div className="p-4 border-t border-[#303132] bg-[#141516] space-y-3">
        <div className="p-3.5 rounded-none border border-[#303132] bg-[#131415] space-y-3">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider font-mono">
            <span className="text-[#B8B9B9]">
              {stats?.opportunityType || "internship"} Quotas
            </span>
            <span className="text-white font-bold">
              {todayApplied} / {todayCap}
            </span>
          </div>

          {/* LinkedIn Progress */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px] font-mono text-[#B8B9B9]">
              <span className="flex items-center gap-1.5 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                LinkedIn
              </span>
              <span className="text-white">
                {liApplied} / {liCap}
              </span>
            </div>
            <div className="w-full bg-[#262728] h-1.5 rounded-none overflow-hidden">
              <div
                className="bg-sky-400 h-full rounded-none transition-all duration-300"
                style={{ width: `${Math.min(100, Math.round((liApplied / (liCap || 1)) * 100))}%` }}
              />
            </div>
          </div>

          {/* Internshala Progress */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px] font-mono text-[#B8B9B9]">
              <span className="flex items-center gap-1.5 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[#CCF2DF]" />
                Internshala
              </span>
              <span className="text-white">
                {isApplied} / {isCap}
              </span>
            </div>
            <div className="w-full bg-[#262728] h-1.5 rounded-none overflow-hidden">
              <div
                className="bg-[#CCF2DF] h-full rounded-none transition-all duration-300"
                style={{ width: `${Math.min(100, Math.round((isApplied / (isCap || 1)) * 100))}%` }}
              />
            </div>
          </div>

          <div className="flex justify-between items-center text-[11px] font-mono text-[#B8B9B9] pt-2 border-t border-[#303132]">
            <span className="uppercase">Remaining</span>
            <span className="text-[#CCF2DF] font-medium">{todayRemaining} slots</span>
          </div>
        </div>

        {/* Mini metrics */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-none border border-[#303132] bg-[#131415] text-center">
            <span className="text-[10px] uppercase font-mono tracking-wider text-[#B8B9B9] block">Applied</span>
            <span className="font-serif text-base font-semibold text-white">{totalApplied}</span>
          </div>
          <div className="p-2.5 rounded-none border border-[#303132] bg-[#131415] text-center">
            <span className="text-[10px] uppercase font-mono tracking-wider text-[#B8B9B9] block">Alerts</span>
            <span
              className={cn(
                "font-serif text-base font-semibold",
                pendingAlerts > 0 ? "text-rose-400" : "text-[#B8B9B9]"
              )}
            >
              {pendingAlerts}
            </span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger trigger */}
      <button
        className="lg:hidden fixed top-5 left-4 z-50 p-2.5 rounded-[8px] bg-[#131415] border-2 border-[#303132] text-white hover:border-white transition-colors"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-[#303132] bg-[#131415] flex-col h-screen fixed top-0 left-0 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-[#141516]/80 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={cn(
          "lg:hidden fixed top-0 left-0 z-50 w-72 max-w-[85vw] h-screen bg-[#131415] border-r border-[#303132] flex flex-col transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
