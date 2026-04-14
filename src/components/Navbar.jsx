// src/components/Navbar.jsx
"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";

// Icons (using basic text for this example, replace with icons like Lucide/React Icons if available)
const MenuIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>;
const CloseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM7 13a3 3 0 006 0v-.091a1.002 1.002 0 01.815-.993 3.003 3.003 0 00-2.57-2.671A5 5 0 009 9.385V13z" clipRule="evenodd" /></svg>;


/** Lightweight header while Suspense resolves (and also as SSR fallback) */
function BareBar({ brand = "JusPOS" }) {
  return (
    <header className="sticky top-0 z-[100] border-b border-white/10 glass shadow-sm">
      <div className="mx-auto max-w-7xl px-4 py-3.5 flex items-center justify-between">
        <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-indigo-600 to-rose-500 bg-clip-text text-transparent">
          {brand}
        </span>
        <div className="h-9 w-20 animate-pulse rounded-lg bg-indigo-50" />
      </div>
    </header>
  );
}

/** The actual nav logic (uses useSearchParams, so keep it inside Suspense) */
function NavbarInner({
  me,
  onLogout,
  brand = "JusPOS",
  nextAfterTables = "/?showOrder=1",
  session,
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // close menu on navigation/search change
  useEffect(() => setOpen(false), [pathname, searchParams?.toString()]);

  // lock body scroll while menu open
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [open]);

  // --- Links and logic (unchanged) ---
  const coreLinks = [
    {
      href: "/kds/by-table",
      label: "KDS",
      sub: [
        { href: "/kds/by-table", label: "By Table" },
        { href: "/kds/all", label: "Original KDS" },
      ],
    },
    {
      href: `/tables?next=${encodeURIComponent(nextAfterTables)}`,
      label: "Tables",
    },
    { href: "/tabs", label: "Tabs" },
  ];

  const managerLinks = [
    { href: "/manage/products", label: "Products" },
    { href: "/manage/tables", label: "Tables" },
    {
      href: "/reports/daily",
      label: "Reports",
      sub: [
        { href: "/reports/daily", label: "Daily Sales" },
        { href: "/reports/dashboard", label: "Analytics" },
        { href: "/orders", label: "Orders" },
      ],
    },
    { href: "/cash", label: "Cash", sub: [{ href: "/cash/sessions", label: "Sessions" }] },
  ];

  const NavLink = ({ href, children, className = "", active = false }) => (
    <Link
      href={href}
      className={`px-3.5 py-2 text-sm font-semibold rounded-xl transition-all duration-200 ${active
          ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200/50"
          : "text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/50"
        } ${className}`}
      onClick={() => setOpen(false)}
    >
      {children}
    </Link>
  );

  // Desktop Navigation Renderer
  const renderNav = (links) =>
    links.map((l) => {
      const isActive = pathname.startsWith(l.href) && l.href !== "/";

      return (
        <div key={l.href} className="relative group/nav">
          <NavLink href={l.href} active={isActive}>
            {l.label}
          </NavLink>
          {l.sub && (
            <div className="absolute left-0 mt-2 hidden group-hover/nav:block animate-slide-down pointer-events-auto">
              <div className="min-w-[180px] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-200/50 ring-1 ring-slate-900/5 backdrop-blur-xl">
                {l.sub.map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="flex rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-indigo-600"
                    onClick={() => setOpen(false)}
                  >
                    {s.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    });

  // Mobile Link Renderer
  const renderMobileLinks = (links, groupTitle) => (
    <div className="space-y-1">
      <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {groupTitle}
      </div>
      {links.map((l) => (
        <div key={l.href}>
          <Link
            href={l.href}
            className={`flex px-4 py-3 text-base font-semibold transition-colors ${
              pathname.startsWith(l.href) ? "bg-indigo-50 text-indigo-600" : "text-slate-700 hover:bg-slate-50"
            }`}
            onClick={() => setOpen(false)}
          >
            {l.label}
          </Link>
          {l.sub ? (
            <div className="pb-2">
              {l.sub.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className={`flex px-8 py-2 text-sm font-medium transition-colors ${
                    pathname.startsWith(s.href) ? "text-indigo-600" : "text-slate-500 hover:text-indigo-600"
                  }`}
                  onClick={() => setOpen(false)}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );

  const isAuthenticated = !!me;
  const isManager = useMemo(
    () =>
      Array.isArray(me?.groups) &&
      me.groups.some((g) => String(g?.name ?? g).toLowerCase() === "manager"),
    [me]
  );

  return (
    <header className="sticky top-0 z-[100] border-b border-white/20 glass shadow-sm transition-all duration-300">
      <div className="mx-auto max-w-7xl px-4 py-3.5 flex items-center justify-between">

        <div className="flex items-center gap-8">
          <Link href="/" className="group flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-lg shadow-indigo-200 transition-transform group-hover:scale-105">
              <span className="text-lg font-black text-white">J</span>
            </div>
            <span className="text-2xl font-black tracking-tight text-slate-900">
              {brand}<span className="text-indigo-600">.</span>
            </span>
          </Link>

          {isAuthenticated && (
            <nav className="hidden lg:flex items-center gap-1">
              {renderNav(coreLinks)}
              <div className="mx-2 h-4 w-px bg-slate-200" />
              {isManager && renderNav(managerLinks)}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 pr-2">
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                  <UserIcon />
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-900 leading-none truncate max-w-[100px]">
                    {me.username}
                  </div>
                  <div className="text-[10px] font-medium text-slate-500">
                    {isManager ? "Manager" : "Staff"}
                  </div>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="hidden md:inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-slate-200 transition-all hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-500 hover:-translate-y-0.5 active:translate-y-0"
            >
              Sign In
            </Link>
          )}

          {isAuthenticated && (
            <button
              aria-label="Open menu"
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              onClick={() => setOpen((s) => !s)}
            >
              <MenuIcon />
            </button>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      {isAuthenticated && (
        <>
          <div
            className={`fixed inset-0 z-[1000] bg-slate-900/40 transition-opacity duration-300 lg:hidden ${open ? "opacity-100 pointer-events-auto backdrop-blur-sm" : "opacity-0 pointer-events-none"
              }`}
            onClick={() => setOpen(false)}
          />

          <aside
            className={`fixed top-0 right-0 z-[1001] h-full w-80 bg-white lg:hidden transition-transform duration-500 ease-out ${open ? "translate-x-0" : "translate-x-full"
              } shadow-2xl overflow-hidden flex flex-col`}
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">
                  {me.username?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-slate-900">{me.username}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                    {isManager ? "Manager" : "Staff Account"}
                  </div>
                </div>
              </div>
              <button
                className="h-10 w-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 transition-colors shadow-sm"
                onClick={() => setOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-6">
              {renderMobileLinks(coreLinks, "Main Operations")}
              <div className="my-4 border-t border-slate-50 mx-4" />
              {isManager && renderMobileLinks(managerLinks, "Management")}

              <div className="p-4 mt-4">
                <button
                  onClick={onLogout}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-rose-50 text-rose-600 px-4 py-4 text-sm font-bold hover:bg-rose-100 transition-colors"
                >
                  Terminate Session
                </button>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                JusPOS v2.0 Redesign
              </div>
            </div>
          </aside>
        </>
      )}
    </header>
  );
}

/** Export a Suspense-wrapped Navbar to safely use useSearchParams */
export default function Navbar(props) {
  return (
    <Suspense fallback={<BareBar brand={props.brand} />}>
      <NavbarInner {...props} />
    </Suspense>
  );
}
