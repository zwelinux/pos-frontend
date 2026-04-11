// src/components/Navbar.jsx
"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";

export default function Navbar({
  me,
  onLogout,
  brand = "Jus Food & Drinks",
  nextAfterTables = "/?showOrder=1",
  session, // ✅ added prop
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    setOpen(false);
  }, [pathname, searchParams?.toString()]);

  const isAuthenticated = !!me;
  const isManager = useMemo(
    () =>
      Array.isArray(me?.groups) &&
      me.groups.some(
        (g) => String(g?.name ?? g).toLowerCase() === "manager"
      ),
    [me]
  );

  // --- Title mapping for breadcrumbs ---
  const titleMap = {
    "": "Home",
    menu: "Menu",
    kds: "KDS",
    tables: "Tables",
    manage: "Manage",
    products: "Products",
    reports: "Reports",
    daily: "Daily Report",
    dashboard: "Summary",
    tabs: "Tabs",
    orders: "Orders",
    cash: "Cash",
    sessions: "Sessions",
    backfill: "Backfill",
  };

  // --- Breadcrumbs ---
  const crumbs = (() => {
    const parts = pathname?.split("/").filter(Boolean) ?? [];
    const acc = [];
    let running = "";
    for (let i = 0; i < parts.length; i++) {
      running += "/" + parts[i];
      acc.push({
        href: running || "/",
        label: titleMap[parts[i]] || decodeURIComponent(parts[i]),
      });
    }
    return acc.length ? acc : [{ href: "/", label: "Home" }];
  })();

  // --- Core links ---
  const coreLinks = [
    { href: "/", label: "Main" },
    { href: "/menu", label: "Menu" },
    { href: "/kds", label: "KDS" },
    {
      href: `/tables?next=${encodeURIComponent(nextAfterTables)}`,
      label: "Tables",
      sub: [{ href: "/tables/manage", label: "Manage Tables" }],
    },
    { href: "/tabs", label: "Tabs" },
  ];

  // --- Manager links ---
  const managerLinks = [
    { href: "/manage/products", label: "Products" },
    { href: "/orders", label: "Orders" },
    {
      href: "/reports",
      label: "Reports",
      sub: [
        { href: "/reports/daily", label: "Daily" },
        { href: "/reports/dashboard", label: "Dashboard" },
      ],
    },
    {
      href: "/cash",
      label: "Cash",
      sub: [{ href: "/cash/sessions", label: "Sessions" }],
    },
    { href: "/backfill", label: "Backfill" },
  ];

  const NavLink = ({ href, children }) => (
    <Link
      href={href}
      className="rounded-full border px-3 py-1.5 text-sm hover:bg-neutral-50 active:scale-[0.98] transition"
    >
      {children}
    </Link>
  );

  const renderNav = (links) =>
    links.map((l) => (
      <div key={l.href} className="relative group">
        <NavLink href={l.href}>{l.label}</NavLink>
        {l.sub && (
          <div className="absolute hidden group-hover:block mt-1 bg-white border rounded-lg shadow-md min-w-[140px] z-50">
            {l.sub.map((sublink) => (
              <Link
                key={sublink.href}
                href={sublink.href}
                className="block px-3 py-1.5 text-sm hover:bg-neutral-50"
              >
                {sublink.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    ));

  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        {/* Brand + Session status */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-lg">{brand}</span>

          {/* Role tag */}
          {isManager && (
            <span className="hidden md:inline-flex text-[11px] rounded-full border px-2 py-0.5 bg-amber-50 border-amber-200 text-amber-800">
              Manager
            </span>
          )}

          {/* 💰 Cash session badge */}
          {isAuthenticated && (
            <span
              className={`text-[11px] ml-2 rounded-full px-2 py-0.5 border ${
                session
                  ? "bg-green-50 border-green-300 text-green-800"
                  : "bg-red-50 border-red-300 text-red-800"
              }`}
            >
              {session ? "Session Active" : "No Session"}
            </span>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Desktop Nav */}
          {isAuthenticated && (
            <nav className="hidden md:flex gap-2 items-center relative">
              {renderNav(coreLinks)}
              {isManager && renderNav(managerLinks)}
            </nav>
          )}

          {/* Close session (Manager only) */}
          {isManager && session && (
            <button
              onClick={async () => {
                const counted = prompt("Enter counted cash amount:");
                if (!counted) return;
                const r = await authFetch(
                  `${API}/cash-sessions/${session.id}/close/`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ counted_cash: counted }),
                  }
                );
                if (r.ok) {
                  alert("Session closed successfully!");
                  window.location.reload();
                } else {
                  alert("Error closing session.");
                }
              }}
              className="rounded-full border px-3 py-1.5 text-sm hover:bg-neutral-50 active:scale-[0.98] transition"
            >
              Close Session
            </button>
          )}

          {/* Logout/Login */}
          {isAuthenticated ? (
            <button
              onClick={onLogout}
              className="rounded-full border px-3 py-1.5 text-sm hover:bg-neutral-50 active:scale-[0.98] transition"
            >
              Logout
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-full border px-3 py-1.5 text-sm hover:bg-neutral-50 active:scale-[0.98] transition"
            >
              Login
            </Link>
          )}

          {/* Mobile menu */}
          {isAuthenticated && (
            <button
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-neutral-50 transition"
              onClick={() => setOpen((s) => !s)}
            >
              ☰
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumbs (desktop) */}
      {isAuthenticated && (
        <div className="mx-auto max-w-6xl px-4 pb-2 hidden md:block">
          <nav className="text-xs text-neutral-600">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link
                  href="/"
                  className="rounded px-1.5 py-0.5 hover:bg-neutral-100"
                >
                  Home
                </Link>
              </li>
              {crumbs.map((c, i) => (
                <li key={c.href} className="flex items-center gap-1">
                  <span className="text-neutral-400">/</span>
                  {i === crumbs.length - 1 ? (
                    <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-800">
                      {c.label}
                    </span>
                  ) : (
                    <Link
                      href={c.href}
                      className="rounded px-1.5 py-0.5 hover:bg-neutral-100"
                    >
                      {c.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </div>
      )}
    </header>
  );
}