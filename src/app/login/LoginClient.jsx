"use client";

import { useState, useMemo } from "react";
import { API } from "@/lib/api";
import { setAuth } from "@/lib/auth";
import { useRouter, useSearchParams } from "next/navigation";

function detectScheme(token, explicit) {
  if (explicit) return explicit;
  if (!token) return "";
  return token.split(".").length === 3 ? "Bearer" : "Token";
}

export default function LoginClient() {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const sp = useSearchParams();
  const nextPath = useMemo(() => sp?.get("next") || "/tables", [sp]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setSubmitting(true);

    try {
      const r = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        setErr(txt || "Invalid credentials provided.");
        setSubmitting(false);
        return;
      }

      const j = await r.json();
      const token = j.token || j.access || j.key || j.auth_token;
      const roles = j.roles || j.groups || [];
      const scheme = j.scheme || detectScheme(token);

      if (!token) {
        setErr("Authentication successful but no session token received.");
        setSubmitting(false);
        return;
      }

      setAuth({ token, roles, scheme });
      router.replace(nextPath);
    } catch {
      setErr("Connection error. Please check your network or API status.");
      setSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center login-mesh px-4 py-20 overflow-hidden">
      {/* Decorative Blur Elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 -top-20 h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[120px] animate-pulse" />
        <div className="absolute -right-20 -bottom-20 h-[500px] w-[500px] rounded-full bg-rose-600/10 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative w-full max-w-4xl grid md:grid-cols-2 gap-0 overflow-hidden rounded-[2.5rem] border border-white/10 glass-dark shadow-[0_32px_120px_rgba(0,0,0,0.4)] backdrop-blur-3xl">
        
        {/* Left Side: Branding/Intro */}
        <section className="hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-indigo-600/20 to-transparent border-r border-white/5">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xl shadow-indigo-500/20">
              <span className="text-2xl font-black text-indigo-600 tracking-tighter">J</span>
            </div>
            <h1 className="mt-8 text-5xl font-black tracking-tight text-white leading-[1.1]">
              Management <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-rose-400">Simplified.</span>
            </h1>
            <p className="mt-6 text-slate-400 text-lg leading-relaxed max-w-xs">
              Empowering your service with real-time analytics, table management, and seamless kitchen integration.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4 group cursor-default">
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white transition-all group-hover:bg-indigo-600/20 group-hover:border-indigo-500/30">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div>
                <div className="text-sm font-bold text-white uppercase tracking-wider">Fast Execution</div>
                <div className="text-xs text-slate-500">Optimized for high-volume shifts</div>
              </div>
            </div>
            <div className="flex items-center gap-4 group cursor-default">
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white transition-all group-hover:bg-rose-600/20 group-hover:border-rose-500/30">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <div>
                <div className="text-sm font-bold text-white uppercase tracking-wider">Secure Access</div>
                <div className="text-xs text-slate-500">End-to-end tokenized auth</div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Side: Login Form */}
        <section className="p-8 md:p-12 lg:p-16 flex flex-col justify-center bg-slate-900/40">
          <div className="mb-10 text-center md:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 mb-4">
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400">System Secure</span>
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight">Staff Sign In</h2>
            <p className="text-slate-400 mt-2 font-medium">Enter credentials to begin shift</p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Username</label>
              <div className="group relative transition-all">
                <input
                  className="w-full rounded-2xl border border-white/5 bg-white/5 px-5 py-4 text-sm text-white placeholder-slate-600 outline-none ring-0 transition-all focus:border-indigo-500/50 focus:bg-indigo-500/5 focus:shadow-[0_0_20px_rgba(79,70,229,0.15)] focus:ring-1 focus:ring-indigo-500/50"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setU(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Password</label>
              <div className="group relative transition-all">
                <input
                  className="w-full rounded-2xl border border-white/5 bg-white/5 px-5 py-4 text-sm text-white placeholder-slate-600 outline-none ring-0 transition-all focus:border-indigo-500/50 focus:bg-indigo-500/5 focus:shadow-[0_0_20px_rgba(79,70,229,0.15)] focus:ring-1 focus:ring-indigo-500/50"
                  placeholder="Enter password"
                  type="password"
                  value={password}
                  onChange={(e) => setP(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {err && (
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-xs font-bold text-rose-400 animate-slide-down">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="group relative mt-4 w-full overflow-hidden rounded-2xl bg-indigo-600 px-6 py-4 text-sm font-bold uppercase tracking-widest text-white shadow-xl shadow-indigo-600/20 transition-all hover:bg-indigo-500 hover:-translate-y-1 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="relative z-10 flex items-center justify-center gap-2">
                {submitting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Enter POS Dashboard</span>
                    <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </>
                )}
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-opacity opacity-0 group-hover:opacity-100" />
            </button>

            <p className="mt-8 text-center text-[10px] font-bold leading-relaxed text-slate-600 uppercase tracking-widest">
              Access is restricted to authorized staff. <br />
              Device audit logging is active.
            </p>
          </form>
        </section>
      </div>

      {/* Footer Meta */}
      <div className="absolute bottom-8 text-[11px] font-bold text-slate-700 uppercase tracking-[0.3em]">
        JusPOS <span className="opacity-30 mx-2">|</span> v2.0 Platform
      </div>
    </main>
  );
}
