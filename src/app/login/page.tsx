"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Lock, Mail, Loader2, Sparkles, ArrowLeft } from "lucide-react";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sign in");
      }

      router.push(redirectPath);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md w-full mx-auto my-auto py-12 z-10 space-y-8">
      <div className="space-y-3 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[8px] bg-[#262728] border border-[#303132] text-xs font-mono text-[#CCF2DF] uppercase tracking-widest">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Secure Access</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-normal tracking-[-0.03em] text-white">
          SIGN IN TO <span className="font-serif italic font-normal text-white">AUTOJOB</span>
        </h1>
        <p className="text-sm text-[#B8B9B9] font-light leading-relaxed">
          Enter your credentials to access your autonomous job automation dashboard.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-[8px] bg-rose-500/10 border-2 border-rose-500/50 text-rose-300 text-xs font-mono">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs uppercase font-mono tracking-widest text-[#B8B9B9]">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-[#B8B9B9] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="developer@example.com"
              className="w-full h-12 bg-[#131415] border-2 border-[#303132] rounded-[8px] pl-10 pr-4 text-sm text-white placeholder:text-[#B8B9B9]/40 focus:border-white focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase font-mono tracking-widest text-[#B8B9B9]">
              Password
            </label>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#B8B9B9] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full h-12 bg-[#131415] border-2 border-[#303132] rounded-[8px] pl-10 pr-4 text-sm text-white placeholder:text-[#B8B9B9]/40 focus:border-white focus:outline-none transition-colors"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-[8px] border-2 border-white bg-white text-[#141516] font-mono text-xs uppercase tracking-widest font-semibold hover:bg-transparent hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Authenticating...</span>
            </>
          ) : (
            <>
              <span>Enter Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="pt-4 border-t border-[#303132] text-center text-xs font-mono text-[#B8B9B9]">
        Don&apos;t have an account yet?{" "}
        <Link
          href="/register"
          className="text-[#CCF2DF] underline underline-offset-4 hover:text-white transition-colors"
        >
          Create free account
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col justify-between p-6 sm:p-12 relative overflow-hidden bg-[#141516]">
      {/* Decorative gradient overlay */}
      <div className="absolute top-0 right-0 w-96 h-96 pointer-events-none opacity-20 bg-[radial-gradient(circle,_#CCF2DF_0%,_transparent_70%)]" />

      {/* Top Bar */}
      <div className="flex items-center justify-between z-10">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#B8B9B9] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Home</span>
        </Link>
        <span className="font-mono text-xs text-[#CCF2DF] uppercase tracking-widest">
          AUTOJOB SAAS
        </span>
      </div>

      <Suspense
        fallback={
          <div className="max-w-md w-full mx-auto my-auto py-12 z-10 text-center font-mono text-xs text-[#B8B9B9] flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#CCF2DF]" />
            <span>Loading authentication gateway...</span>
          </div>
        }
      >
        <LoginFormContent />
      </Suspense>

      {/* Footer */}
      <div className="text-center z-10 text-[11px] font-mono text-[#B8B9B9]/60">
        AutoJob Autonomous Application System • End-to-End Encrypted BYOK
      </div>
    </div>
  );
}
