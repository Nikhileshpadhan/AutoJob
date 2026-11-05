"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Shield,
  Bot,
  Cpu,
  Eye,
  CheckCircle2,
  Terminal,
  Lock,
  Zap,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: "HOW DOES AUTOJOB PREVENT ACCOUNT FLAGS AND BANS?",
      a: "AutoJob uses a strict human-emulation strategy. Instead of rapid mass-blasting, it enforces single-application cycles followed by randomized 20 to 60-minute cooling rests within a natural 9 AM to 11 PM operating window. Playwright executes directly in your local Google Chrome binary with real persistent user profiles, simulated bezier mouse trajectories, and variable human typing cadences.",
    },
    {
      q: "WHAT HAPPENS WHEN A CAPTCHA, OTP, OR VERIFICATION CHECKPOINT APPEARS?",
      a: "Our stealth detector immediately pauses automation, captures a high-resolution snapshot of the screen, and pings your personal Telegram bot with an alert. You can inspect the checkpoint snapshot right on the web dashboard or solve it in the visible Chrome window. Once resolved, one click marks it solved and seamlessly resumes the runner.",
    },
    {
      q: "HOW DOES DYNAMIC LLM RESUME & COVER LETTER TAILORING WORK?",
      a: "Before submitting, the built-in LLM engine parses the recruiter's specific job description and cross-references your candidate resume skills. It generates a high-fidelity, contextual cover letter highlighting your exact matching projects and calculates a match percentage score. Listings below your minimum threshold are discarded to conserve daily quota.",
    },
    {
      q: "WHERE ARE MY CREDENTIALS AND APPLICATION DATA STORED?",
      a: "All candidate profiles, resumes, match telemetry, and submission logs are stored locally on your machine in an encrypted SQLite database. Your cookies and sessions live inside your own local Chrome user profile directory. No external servers or third-party databases ever touch your sensitive personal data.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#141516] text-[#FFFFFF] font-sans selection:bg-[#CCF2DF]/20 selection:text-white">
      {/* 80px Aronya Studio Navigation */}
      <header className="h-20 border-b border-[#303132] bg-[#141516]/95 backdrop-blur-md sticky top-0 z-[900] px-4 sm:px-8 md:px-12 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white group"
        >
          <div className="w-8 h-8 rounded-[8px] border-2 border-white flex items-center justify-center bg-transparent group-hover:bg-white group-hover:text-[#141516] transition-colors shrink-0">
            <span className="font-serif font-semibold text-sm">A</span>
          </div>
          <div className="leading-tight">
            <span className="font-bold text-xs sm:text-sm tracking-widest text-white uppercase block">
              AutoJob
            </span>
            <span className="text-[9px] sm:text-[10px] text-[#CCF2DF] font-mono tracking-wider uppercase block">
              Autonomous Career
            </span>
          </div>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-[11px] font-medium uppercase tracking-[0.18em] text-[#B8B9B9]">
          <a
            href="#features"
            className="hover:text-white transition-colors duration-150 relative py-1 hover:border-b-2 hover:border-white"
          >
            Capabilities
          </a>
          <a
            href="#architecture"
            className="hover:text-white transition-colors duration-150 relative py-1 hover:border-b-2 hover:border-white"
          >
            Pipeline
          </a>
          <a
            href="#telemetry"
            className="hover:text-white transition-colors duration-150 relative py-1 hover:border-b-2 hover:border-white"
          >
            Telemetry
          </a>
          <a
            href="#faq"
            className="hover:text-white transition-colors duration-150 relative py-1 hover:border-b-2 hover:border-white"
          >
            Protocols
          </a>
        </nav>

        {/* Right CTA */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-[#CCF2DF] px-3 py-1 border border-[#303132] bg-[#131415]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#CCF2DF] animate-pulse" />
            <span>Worker: Ready</span>
          </div>
          <Link href="/dashboard">
            <Button
              variant="outline"
              size="sm"
              className="text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold h-9 sm:h-10 px-3.5 sm:px-5 rounded-[8px] border-2 border-white bg-transparent text-white hover:bg-white hover:text-[#141516] transition-all"
            >
              Command Center
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section — Aronya Display XXL */}
      <section className="relative px-4 sm:px-8 md:px-12 pt-14 pb-20 md:pt-28 md:pb-36 border-b border-[#303132] overflow-hidden">
        {/* Subtle decorative atmospheric gradient */}
        <div className="absolute top-0 right-0 w-1/2 h-full pointer-events-none opacity-40 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#262728] via-[#141516] to-[#141516]" />

        <div className="max-w-7xl mx-auto relative z-10 space-y-8 sm:space-y-10">
          {/* Section Kicker */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-[#CCF2DF] border border-[#CCF2DF]/30 bg-[#CCF2DF]/10 px-2.5 py-1">
              [ 01 // AUTONOMOUS CAREER SYSTEM ]
            </span>
            <span className="hidden sm:inline font-mono text-[11px] uppercase tracking-widest text-[#B8B9B9]">
              Google Chrome • Playwright • Gemini Flash
            </span>
          </div>

          {/* Main Giant Headline */}
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-5xl md:text-7xl lg:text-[90px] font-normal tracking-[-0.035em] text-white leading-[1.08] uppercase max-w-5xl">
              AUTONOMOUS{" "}
              <span className="font-serif italic font-normal text-white">
                APPLICATION
              </span>{" "}
              INFRASTRUCTURE
            </h1>
            <p className="text-sm sm:text-lg md:text-xl text-[#CCF2DF] font-light max-w-2xl pt-2 sm:pt-4 leading-relaxed">
              An intelligent, human-in-the-loop automation engine engineered to
              navigate LinkedIn & Internshala, tailor contextual cover letters,
              bypass anti-bot gates, and safeguard daily application quotas.
            </p>
          </div>

          {/* Dual Action Buttons (Aronya 56px 2px Outlined) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-2 sm:pt-4">
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 text-xs uppercase tracking-widest font-semibold rounded-[8px] border-2 border-white bg-white text-[#141516] hover:bg-transparent hover:text-white transition-all duration-200"
              >
                Launch Command Center <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>

            <Link href="/runner" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 text-xs uppercase tracking-widest font-semibold rounded-[8px] border-2 border-[#CCF2DF] bg-transparent text-[#CCF2DF] hover:bg-[#CCF2DF] hover:text-[#141516] transition-all duration-200"
              >
                <Bot className="w-4 h-4 mr-2" /> Dispatch Runner
              </Button>
            </Link>

            <Link href="/profile" className="w-full sm:w-auto">
              <Button
                variant="ghost"
                size="lg"
                className="w-full sm:w-auto h-12 sm:h-14 px-5 text-xs uppercase tracking-widest font-semibold text-[#B8B9B9] hover:text-white hover:bg-transparent border-2 border-transparent hover:border-[#303132]"
              >
                Upload Resume & Skills
              </Button>
            </Link>
          </div>

          {/* Live System Metric Ticker Bar */}
          <div className="pt-8 sm:pt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 border-t border-[#303132]">
            <div className="p-3.5 sm:p-4 bg-[#131415] border border-[#303132]">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#B8B9B9] block mb-1">
                PLATFORM SUPPORT
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white uppercase tracking-wider">
                LinkedIn + Internshala
              </span>
            </div>

            <div className="p-3.5 sm:p-4 bg-[#131415] border border-[#303132]">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#B8B9B9] block mb-1">
                DAILY PACING CAP
              </span>
              <span className="text-xs sm:text-sm font-semibold text-[#CCF2DF] font-mono">
                10 Applications / Day
              </span>
            </div>

            <div className="p-3.5 sm:p-4 bg-[#131415] border border-[#303132]">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#B8B9B9] block mb-1">
                OPERATING WINDOW
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white font-mono">
                09:00 AM – 11:00 PM
              </span>
            </div>

            <div className="p-3.5 sm:p-4 bg-[#131415] border border-[#303132]">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#B8B9B9] block mb-1">
                VERIFICATION MODE
              </span>
              <span className="text-xs sm:text-sm font-semibold text-amber-300 uppercase tracking-wider">
                Telegram Checkpoints
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 02: Interactive Live Execution Simulator & Telemetry Showcase */}
      <section
        id="telemetry"
        className="px-4 sm:px-8 md:px-12 py-16 md:py-24 border-b border-[#303132] bg-[#111213]"
      >
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#CCF2DF]">
                [ 02 // REAL-TIME TELEMETRY MATRIX ]
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light uppercase tracking-tight text-white">
                LIVE RUNNER{" "}
                <span className="font-serif italic font-normal text-white">
                  CONSOLE VIEW
                </span>
              </h2>
            </div>
            <p className="text-xs text-[#B8B9B9] max-w-md leading-relaxed font-light">
              Every execution event is streamed in real-time via Server-Sent
              Events (SSE), written to local SQLite storage, and audited with
              microsecond precision.
            </p>
          </div>

          {/* Color-Blocked Terminal Card */}
          <div className="border-2 border-[#303132] bg-[#0E0F10] overflow-hidden">
            {/* Terminal Window Header */}
            <div className="h-12 border-b border-[#303132] bg-[#141516] px-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="font-mono text-xs uppercase tracking-wider text-[#B8B9B9] pl-3 border-l border-[#303132]">
                  session://autojob-playwright-worker.pid-14820
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono text-[#CCF2DF]">
                <span className="w-2 h-2 rounded-full bg-[#CCF2DF] animate-ping" />
                <span>STREAM: 200 OK</span>
              </div>
            </div>

            {/* Split Console Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#303132]">
              {/* Left Column: Log Feed */}
              <div className="lg:col-span-8 p-6 font-mono text-xs space-y-3.5 bg-[#0A0B0C] min-h-[380px]">
                <div className="flex items-start gap-3">
                  <span className="text-[#B8B9B9]/50 select-none">09:14:02</span>
                  <span className="text-sky-400 font-semibold">[INITIALIZATION]</span>
                  <span className="text-white">
                    Engine dispatched. Operating Mode: INTERNSHIP | Workplace: REMOTE
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-[#B8B9B9]/50 select-none">09:14:04</span>
                  <span className="text-[#CCF2DF] font-semibold">[BROWSER]</span>
                  <span className="text-white">
                    Launching Google Chrome (Session: data/browser_profile | Headless: false)
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-[#B8B9B9]/50 select-none">09:14:12</span>
                  <span className="text-sky-400 font-semibold">[LINKEDIN]</span>
                  <span className="text-white">
                    Searching query: "Full Stack Developer" in India (Remote) — 32 listings discovered
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-[#B8B9B9]/50 select-none">09:14:28</span>
                  <span className="text-purple-400 font-semibold">[GEMINI REASONING]</span>
                  <span className="text-[#CCF2DF]">
                    Evaluating "Full Stack Engineer" at Wing Assistant — Match Score: 88% (≥ 65% threshold)
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-[#B8B9B9]/50 select-none">09:14:35</span>
                  <span className="text-amber-400 font-semibold">[LLM LETTER]</span>
                  <span className="text-white">
                    Generated bespoke tailored cover letter emphasizing TypeScript, Next.js, and Python projects
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-[#B8B9B9]/50 select-none">09:14:48</span>
                  <span className="text-emerald-400 font-semibold">[PLAYWRIGHT]</span>
                  <span className="text-white">
                    Filling Easy Apply form fields • Uploading candidate resume PDF • Verifying contact details
                  </span>
                </div>

                <div className="flex items-start gap-3 bg-[#131415] p-2.5 border-l-2 border-[#CCF2DF]">
                  <span className="text-[#CCF2DF] select-none">09:15:02</span>
                  <span className="text-emerald-400 font-bold">[SUBMISSION SUCCESS]</span>
                  <span className="text-white">
                    Application successfully landed! Quota updated: 1/5 used. Telegram dispatch notification sent.
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-[#B8B9B9]/50 select-none">09:15:05</span>
                  <span className="text-[#CCF2DF] font-semibold">[SMART PACING]</span>
                  <span className="text-[#B8B9B9]">
                    Entering randomized safety cooling rest (32 minutes). Next scheduled application cycle at 09:47 AM.
                  </span>
                </div>
              </div>

              {/* Right Column: Active Run Diagnostics */}
              <div className="lg:col-span-4 p-6 space-y-6 bg-[#131415]">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#B8B9B9] block">
                    CURRENT EVALUATION
                  </span>
                  <div className="font-serif text-2xl text-white font-normal">
                    Wing Assistant
                  </div>
                  <div className="text-xs text-[#CCF2DF] font-mono">
                    Role: Full Stack Developer (Remote)
                  </div>
                </div>

                {/* Match Score Gauge */}
                <div className="p-4 border border-[#303132] bg-[#141516] space-y-2">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-[#B8B9B9]">FIT PROBABILITY</span>
                    <span className="text-[#CCF2DF] font-bold text-sm">88% MATCH</span>
                  </div>
                  <div className="w-full bg-[#262728] h-2">
                    <div className="bg-[#CCF2DF] h-full w-[88%]" />
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 border border-[#303132] bg-[#262728] text-white">
                      TypeScript
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 border border-[#303132] bg-[#262728] text-white">
                      Next.js
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 border border-[#303132] bg-[#262728] text-white">
                      Python
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 border border-[#303132] bg-[#262728] text-white">
                      Playwright
                    </span>
                  </div>
                </div>

                {/* Quota Gauge */}
                <div className="p-4 border border-[#303132] bg-[#141516] space-y-2">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-[#B8B9B9]">DAILY SAFETY QUOTA</span>
                    <span className="text-white font-bold">1 / 10 USED</span>
                  </div>
                  <div className="w-full bg-[#262728] h-2">
                    <div className="bg-sky-400 h-full w-[10%]" />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-[#B8B9B9] pt-1">
                    <span>LinkedIn: 1/5</span>
                    <span>Internshala: 0/5</span>
                  </div>
                </div>

                <Link href="/runner" className="block">
                  <Button
                    size="sm"
                    className="w-full h-11 text-[11px] uppercase tracking-wider font-semibold border-2 border-white bg-transparent text-white hover:bg-white hover:text-[#141516]"
                  >
                    Open Live Runner Console
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 03: Four Architectural Pillars (Color-Blocked 4-Column Grid) */}
      <section id="features" className="px-6 sm:px-12 py-24 border-b border-[#303132]">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="space-y-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#CCF2DF]">
              [ 03 // CORE CAPABILITIES ]
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light uppercase tracking-tight text-white">
              ENGINEERED FOR{" "}
              <span className="font-serif italic font-normal text-white">
                PRECISION
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Pillar 01 */}
            <div className="p-8 border-2 border-[#303132] bg-[#131415] space-y-5 hover:border-white transition-colors duration-200">
              <div className="w-10 h-10 border-2 border-white flex items-center justify-center text-white">
                <Sparkles className="w-5 h-5 text-[#CCF2DF]" />
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#B8B9B9] block">
                  MODULE 01
                </span>
                <h3 className="text-base font-bold uppercase tracking-wider text-white">
                  Contextual LLM Tailoring
                </h3>
              </div>
              <p className="text-xs text-[#B8B9B9] leading-relaxed font-light">
                Leverages Gemini Flash to parse real recruiter requirements and
                draft targeted, custom cover letters highlighting your relevant
                experience for every single job submission.
              </p>
            </div>

            {/* Pillar 02 */}
            <div className="p-8 border-2 border-[#303132] bg-[#131415] space-y-5 hover:border-white transition-colors duration-200">
              <div className="w-10 h-10 border-2 border-white flex items-center justify-center text-white">
                <Eye className="w-5 h-5 text-[#CCF2DF]" />
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#B8B9B9] block">
                  MODULE 02
                </span>
                <h3 className="text-base font-bold uppercase tracking-wider text-white">
                  Stealth Human Emulation
                </h3>
              </div>
              <p className="text-xs text-[#B8B9B9] leading-relaxed font-light">
                Automates real Google Chrome with your saved persistent profiles.
                Features organic mouse curves, typing delays, and headless
                evasion so your accounts never trigger security flags.
              </p>
            </div>

            {/* Pillar 03 */}
            <div className="p-8 border-2 border-[#303132] bg-[#131415] space-y-5 hover:border-white transition-colors duration-200">
              <div className="w-10 h-10 border-2 border-white flex items-center justify-center text-white">
                <Shield className="w-5 h-5 text-amber-400" />
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#B8B9B9] block">
                  MODULE 03
                </span>
                <h3 className="text-base font-bold uppercase tracking-wider text-white">
                  Human-In-The-Loop Alerts
                </h3>
              </div>
              <p className="text-xs text-[#B8B9B9] leading-relaxed font-light">
                Intercepts CAPTCHAs, OTPs, and authentication obstacles. Takes a
                live screenshot, notifies your Telegram bot, and waits for your
                one-click confirmation to resume execution.
              </p>
            </div>

            {/* Pillar 04 */}
            <div className="p-8 border-2 border-[#303132] bg-[#131415] space-y-5 hover:border-white transition-colors duration-200">
              <div className="w-10 h-10 border-2 border-white flex items-center justify-center text-white">
                <Clock className="w-5 h-5 text-[#CCF2DF]" />
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#B8B9B9] block">
                  MODULE 04
                </span>
                <h3 className="text-base font-bold uppercase tracking-wider text-white">
                  Strict Pacing Defense
                </h3>
              </div>
              <p className="text-xs text-[#B8B9B9] leading-relaxed font-light">
                Enforces hard daily quotas (e.g. 5 on LinkedIn, 5 on Internshala)
                with 20-60 minute randomized rest pauses within operating hours
                so platform algorithms recognize you as a natural user.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 04: Execution Pipeline Stepper */}
      <section
        id="architecture"
        className="px-6 sm:px-12 py-24 border-b border-[#303132] bg-[#111213]"
      >
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#CCF2DF]">
                [ 04 // PIPELINE ARCHITECTURE ]
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light uppercase tracking-tight text-white">
                THE 4-STAGE{" "}
                <span className="font-serif italic font-normal text-white">
                  LIFECYCLE
                </span>
              </h2>
            </div>
            <p className="text-xs text-[#B8B9B9] max-w-md leading-relaxed font-light">
              From resume skill extraction to verified job landing, every step
              is executed systematically with zero hallucination.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="p-6 border border-[#303132] bg-[#131415] space-y-4 relative">
              <span className="font-serif text-5xl text-[#303132] font-semibold block">
                01
              </span>
              <h4 className="text-sm font-bold uppercase tracking-wider text-white">
                Skill Query Extraction
              </h4>
              <p className="text-xs text-[#B8B9B9] leading-relaxed font-light">
                Parses your uploaded PDF resume and configured roles to generate
                targeted platform search queries (e.g. "Generative AI", "Full
                Stack", "Python").
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 border border-[#303132] bg-[#131415] space-y-4 relative">
              <span className="font-serif text-5xl text-[#303132] font-semibold block">
                02
              </span>
              <h4 className="text-sm font-bold uppercase tracking-wider text-white">
                Semantic Match Gate
              </h4>
              <p className="text-xs text-[#B8B9B9] leading-relaxed font-light">
                Scrapes the detailed job listing and runs an LLM evaluation
                pass. If candidate skills match &lt; 65%, the job is skipped to
                save your quota.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 border border-[#303132] bg-[#131415] space-y-4 relative">
              <span className="font-serif text-5xl text-[#303132] font-semibold block">
                03
              </span>
              <h4 className="text-sm font-bold uppercase tracking-wider text-white">
                Automated Submission
              </h4>
              <p className="text-xs text-[#B8B9B9] leading-relaxed font-light">
                Playwright drives the form submission, attaches the tailored
                letter, selects screening choices, and confirms the "Application
                Sent" modal.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-6 border border-[#303132] bg-[#131415] space-y-4 relative">
              <span className="font-serif text-5xl text-[#303132] font-semibold block">
                04
              </span>
              <h4 className="text-sm font-bold uppercase tracking-wider text-white">
                Audit & Push Alert
              </h4>
              <p className="text-xs text-[#B8B9B9] leading-relaxed font-light">
                Saves the company, title, score, and tailored letter into local
                SQLite, updates the daily quota, and sends a markdown summary to
                Telegram.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 05: Quantitative Performance Metrics Band */}
      <section className="px-6 sm:px-12 py-20 border-b border-[#303132]">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center md:text-left">
          <div className="space-y-2 border-l-2 border-[#303132] pl-6">
            <span className="font-serif text-5xl sm:text-6xl text-white font-normal block">
              100%
            </span>
            <span className="text-xs font-mono uppercase tracking-widest text-[#CCF2DF] block">
              Native Chrome
            </span>
            <p className="text-[11px] text-[#B8B9B9] font-light">
              Zero artificial automation signatures.
            </p>
          </div>

          <div className="space-y-2 border-l-2 border-[#303132] pl-6">
            <span className="font-serif text-5xl sm:text-6xl text-white font-normal block">
              10/10
            </span>
            <span className="text-xs font-mono uppercase tracking-widest text-[#CCF2DF] block">
              Daily Safety Cap
            </span>
            <p className="text-[11px] text-[#B8B9B9] font-light">
              Strict pacing to protect your accounts.
            </p>
          </div>

          <div className="space-y-2 border-l-2 border-[#303132] pl-6">
            <span className="font-serif text-5xl sm:text-6xl text-white font-normal block">
              &lt; 40s
            </span>
            <span className="text-xs font-mono uppercase tracking-widest text-[#CCF2DF] block">
              Tailoring Latency
            </span>
            <p className="text-[11px] text-[#B8B9B9] font-light">
              High-speed Gemini Flash inference.
            </p>
          </div>

          <div className="space-y-2 border-l-2 border-[#303132] pl-6">
            <span className="font-serif text-5xl sm:text-6xl text-white font-normal block">
              0
            </span>
            <span className="text-xs font-mono uppercase tracking-widest text-[#CCF2DF] block">
              Security Flags
            </span>
            <p className="text-[11px] text-[#B8B9B9] font-light">
              Flawless human emulation rate.
            </p>
          </div>
        </div>
      </section>

      {/* Section 06: Protocols & FAQ Accordion */}
      <section id="faq" className="px-6 sm:px-12 py-24 border-b border-[#303132]">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="space-y-2 text-center">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#CCF2DF]">
              [ 05 // SYSTEM PROTOCOLS ]
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light uppercase tracking-tight text-white">
              FREQUENTLY ASKED{" "}
              <span className="font-serif italic font-normal text-white">
                QUESTIONS
              </span>
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div
                  key={index}
                  className="border-2 border-[#303132] bg-[#131415] transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                    className="w-full py-5 px-6 flex items-center justify-between text-left focus:outline-none"
                  >
                    <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-white">
                      {faq.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#CCF2DF] transition-transform duration-200 shrink-0 ml-4 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 text-xs text-[#B8B9B9] font-light leading-relaxed border-t border-[#303132]/60 pt-4">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 07: Closing Hero CTA */}
      <section className="px-6 sm:px-12 py-28 text-center bg-[#111213] relative overflow-hidden">
        <div className="max-w-3xl mx-auto space-y-8 relative z-10">
          <div className="space-y-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#CCF2DF]">
              [ READY TO AUTOMATE? ]
            </span>
            <h2 className="text-4xl sm:text-6xl font-normal tracking-[-0.03em] uppercase text-white leading-tight">
              PREPARE YOUR CAREER{" "}
              <span className="font-serif italic font-normal text-white">
                FOR AUTONOMY
              </span>
            </h2>
            <p className="text-sm text-[#B8B9B9] font-light max-w-xl mx-auto leading-relaxed pt-2">
              Step into the command center, configure your targeting parameters,
              and watch verified applications land on your screen.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link href="/dashboard">
              <Button
                size="lg"
                className="h-14 px-8 text-xs uppercase tracking-widest font-semibold rounded-[8px] border-2 border-white bg-white text-[#141516] hover:bg-transparent hover:text-white transition-all duration-200"
              >
                Enter Command Center <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>

            <Link href="/runner">
              <Button
                variant="outline"
                size="lg"
                className="h-14 px-8 text-xs uppercase tracking-widest font-semibold rounded-[8px] border-2 border-[#303132] bg-transparent text-white hover:border-white hover:bg-white hover:text-[#141516] transition-all duration-200"
              >
                Launch Automation Runner
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 80px+ Aronya Studio Footer */}
      <footer className="border-t border-[#303132] bg-[#141516] px-6 sm:px-12 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-[8px] border-2 border-white flex items-center justify-center text-white">
            <span className="font-serif font-semibold text-xs">A</span>
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-white block">
              AutoJob Studio
            </span>
            <span className="text-[10px] text-[#B8B9B9] font-mono">
              © {new Date().getFullYear()} Autonomous Career Systems. All rights reserved.
            </span>
          </div>
        </div>

        {/* Quick Nav Links */}
        <div className="flex flex-wrap items-center gap-6 text-[11px] font-mono uppercase tracking-wider text-[#B8B9B9]">
          <Link href="/dashboard" className="hover:text-white transition-colors">
            Dashboard
          </Link>
          <Link href="/runner" className="hover:text-white transition-colors">
            Runner
          </Link>
          <Link href="/applications" className="hover:text-white transition-colors">
            Ledger
          </Link>
          <Link href="/profile" className="hover:text-white transition-colors">
            Profile
          </Link>
          <Link href="/settings" className="hover:text-white transition-colors">
            Settings
          </Link>
          <Link href="/alerts" className="hover:text-white transition-colors">
            Alerts
          </Link>
        </div>

        <div className="text-[10px] font-mono uppercase tracking-widest text-[#CCF2DF] px-3 py-1 border border-[#303132] bg-[#131415]">
          Aronya Design System v1.0
        </div>
      </footer>
    </div>
  );
}
