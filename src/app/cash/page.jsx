"use client";

import React, { useEffect, useMemo, useState } from "react";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import Link from "next/link";

// -----------------------------------------------------
// Helpers
// -----------------------------------------------------
function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toLocalDateOnly(d) {
  if (!d) return null;
  const dt = new Date(d);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// -----------------------------------------------------
// Section Layout Component
// -----------------------------------------------------
function Section({ title, icon, children, right = null }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="p-4 md:p-5">
        <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            {icon}
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
          </div>
          <div className="ml-auto">{right}</div>
        </div>
        {children}
      </div>
    </section>
  );
}

// -----------------------------------------------------
// Main Cash Page
// -----------------------------------------------------
export default function CashPage() {
  // sessions
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // open + close session fields
  const [openStart, setOpenStart] = useState("0.00");
  const [openNote, setOpenNote] = useState("");
  const [closingCounted, setClosingCounted] = useState("");

  // expense fields
  const [expAmt, setExpAmt] = useState("");
  const [expCat, setExpCat] = useState("");
  const [expNote, setExpNote] = useState("");
  const [postingExpense, setPostingExpense] = useState(false);

  // withdraw fields
  const [wdAmt, setWdAmt] = useState("");
  const [wdNote, setWdNote] = useState("");
  const [postingWithdraw, setPostingWithdraw] = useState(false);
  const [cashActionTab, setCashActionTab] = useState("expense");

  // report mode
  const [reportDate, setReportDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [reportMode, setReportMode] = useState("day");
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // accordion toggles
  const [open, setOpen] = useState({
    actual: false,
    tabToday: false,
    tabPrevious: false,
    expenses: false,
    withdrawals: false,
  });

  const toggle = (k) =>
    setOpen((o) => ({
      ...o,
      [k]: !o[k],
    }));

  // order/expense detail lists for accordions
  const [orders, setOrders] = useState({
    actual: [],
    tab_today: [],
    previous_tab: [],
  });
  const [expenses, setExpenses] = useState([]);
  const [withdraws, setWithdraws] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // -------------------------------------------------
  // Derived session references
  // -------------------------------------------------
  const openSession = useMemo(
    () => sessions.find((s) => !s.closed_at) || null,
    [sessions]
  );
  const lastClosed = useMemo(
    () => sessions.find((s) => s.closed_at) || null,
    [sessions]
  );

  const sessionOpenDate = useMemo(() => {
    const s = openSession || lastClosed;
    return s ? toLocalDateOnly(s.opened_at) : null;
  }, [openSession, lastClosed]);

  // -------------------------------------------------
  // Loaders
  // -------------------------------------------------
  async function loadSessions() {
    setLoadingSessions(true);
    try {
      const r = await authFetch(`${API}/cash-sessions/?ordering=-id`);
      const js = r.ok ? await r.json() : [];
      setSessions(Array.isArray(js) ? js : js.results || []);
    } catch {
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }

  async function detectOpenSession() {
    try {
      const r = await authFetch(`${API}/cash-sessions/current`);
      const js = r.ok ? await r.json() : {};
      if (js.active) setReportMode("session");
    } catch {
      setReportMode("day");
    }
  }

  async function loadReport() {
    setReportLoading(true);
    try {
      let url = `${API}/report/cash-daily/`;

      if (reportMode === "day") {
        url += `?date=${reportDate}`;
      } else {
        const sid = openSession?.id || lastClosed?.id;
        if (sid) url += `?session_id=${sid}`;
      }

      const r = await authFetch(url);
      setReport(r.ok ? await r.json() : null);
    } catch {
      setReport(null);
    } finally {
      setReportLoading(false);
    }
  }

  // -------------------------------------------------
  // Load details for accordions
  // -------------------------------------------------
  async function loadDetailsForAccordions() {
    setDetailLoading(true);
    try {
      if (reportMode === "session") {
        const sid = openSession?.id || lastClosed?.id;
        if (!sid) {
          setOrders({ actual: [], tab_today: [], previous_tab: [] });
          setExpenses([]);
          return;
        }

        const [oRes, eRes, wRes] = await Promise.all([
          authFetch(`${API}/cash-sessions/${sid}/orders/`),
          authFetch(`${API}/cash-sessions/${sid}/expenses/`),
          authFetch(`${API}/withdraws/?session=${sid}`),
        ]);

        const js = oRes.ok ? await oRes.json() : {};

        setOrders({
          actual: js.actual || [],
          tab_today: js.tab_today || [],
          previous_tab: js.previous_tab || [],
        });

        setExpenses(eRes.ok ? await eRes.json() : []);
        setWithdraws(wRes.ok ? await wRes.json() : []);
        return;
      }

      const [paidRes, tabRes, eRes, wRes] = await Promise.all([
        authFetch(`${API}/report/cash-daily/orders/?date=${reportDate}`),
        authFetch(`${API}/report/cash-daily/tabs/?date=${reportDate}`),
        authFetch(`${API}/report/cash-daily/expenses/?date=${reportDate}`),
        authFetch(`${API}/withdraws/?date=${reportDate}`),
      ]);

      const paid = paidRes.ok ? await paidRes.json() : [];
      const tabs = tabRes.ok ? await tabRes.json() : [];
      const reportDay = new Date(reportDate + "T00:00:00");

      const actual = paid.filter((o) => !o.tab_opened_at);
      const tab_today = tabs.filter((o) => {
        if (!o.tab_opened_at) return false;
        const opened = new Date(o.tab_opened_at);
        return sameDay(opened, reportDay);
      });
      const previous_tab = paid.filter((o) => {
        if (!o.tab_opened_at || !o.paid_at) return false;
        const opened = new Date(o.tab_opened_at);
        const paidAt = new Date(o.paid_at);
        return opened < reportDay && sameDay(paidAt, reportDay);
      });

      setOrders({ actual, tab_today, previous_tab });
      setExpenses(eRes.ok ? await eRes.json() : []);
      setWithdraws(wRes.ok ? await wRes.json() : []);
    } catch (err) {
      console.error("loadDetailsForAccordions ERROR:", err);
      setOrders({ actual: [], tab_today: [], previous_tab: [] });
      setExpenses([]);
      setWithdraws([]);
    } finally {
      setDetailLoading(false);
    }
  }

  // -------------------------------------------------
  // Effects
  // -------------------------------------------------
  useEffect(() => {
    loadSessions();
    detectOpenSession();
  }, []);

  useEffect(() => {
    loadReport();
    setOpen({
      actual: false,
      tabToday: false,
      tabPrevious: false,
      expenses: false,
    });
    setOrders({ actual: [], tab_today: [], previous_tab: [] });
    setExpenses([]);
  }, [reportDate, reportMode, openSession?.id, lastClosed?.id]);

  useEffect(() => {
    const anyOpen = open.actual || open.tabToday || open.tabPrevious || open.expenses || open.withdrawals;
    if (anyOpen && !detailLoading) {
      loadDetailsForAccordions();
    }
  }, [open]);

  // -------------------------------------------------
  // Actions
  // -------------------------------------------------
  async function openCashSession(e) {
    e.preventDefault();
    try {
      const body = {
        starting_balance: openStart || "0",
        note: openNote || "",
      };
      const r = await authFetch(`${API}/cash-sessions/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Cannot open session");
      setOpenStart("0.00");
      setOpenNote("");
      await loadSessions();
      setReportMode("session");
      await loadReport();
    } catch {
      alert("Failed to open session");
    }
  }

  async function closeCashSession(e) {
    e.preventDefault();
    if (!openSession) return;
    try {
      await authFetch(`${API}/cash-sessions/${openSession.id}/close/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counted_cash: closingCounted }),
      });
      setClosingCounted("");
      await loadSessions();
      await loadReport();
    } catch {
      alert("Failed to close session");
    }
  }

  async function postExpense(e) {
    e.preventDefault();
    if (!expAmt) return alert("Amount required");
    setPostingExpense(true);
    try {
      const r = await authFetch(`${API}/expenses/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: expAmt,
          category: expCat,
          note: expNote,
        }),
      });
      if (!r.ok) throw new Error("expense post fail");
      setExpAmt("");
      setExpCat("");
      setExpNote("");
      await Promise.all([loadSessions(), loadReport()]);
    } catch {
      alert("Failed to add expense");
    } finally {
      setPostingExpense(false);
    }
  }

  async function postWithdraw(e) {
    e.preventDefault();
    if (!wdAmt) return alert("Amount required");
    setPostingWithdraw(true);
    try {
      const r = await authFetch(`${API}/withdraws/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: wdAmt,
          note: wdNote,
        }),
      });
      if (!r.ok) throw new Error("withdraw fail");
      setWdAmt("");
      setWdNote("");
      await Promise.all([loadSessions(), loadReport()]);
    } catch {
      alert("Failed to withdraw");
    } finally {
      setPostingWithdraw(false);
    }
  }

  // -----------------------------------------------------
  // UI Blocks
  // -----------------------------------------------------

  const sessionCard = (
    <div className="grid grid-cols-1 gap-4">
      {/* Open Session */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-800">New Session</div>
        </div>
        
        {openSession ? (
          <div className="space-y-4">
            <p className="text-sm font-bold text-slate-500">A session is currently active.</p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-100 animate-pulse">
              Active Session #{openSession.id}
            </div>
          </div>
        ) : (
          <form onSubmit={openCashSession} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <label className="group/field relative block rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition-all focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-50">
                <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500 group-focus-within/field:text-slate-700">Starting Balance</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold">฿</span>
                  <input
                    type="number"
                    value={openStart}
                    onChange={(e) => setOpenStart(e.target.value)}
                    className="w-full bg-transparent p-0 border-none text-sm font-black tabular-nums text-slate-800 outline-none transition-all"
                  />
                </div>
              </label>
              
              <label className="group/field relative block rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition-all focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-50">
                <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500 group-focus-within/field:text-slate-700">Session Note</span>
                <input
                  type="text"
                  placeholder="Optional note..."
                  value={openNote}
                  onChange={(e) => setOpenNote(e.target.value)}
                  className="w-full bg-transparent p-0 border-none text-sm font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-300"
                />
              </label>
            </div>
            
            <button
              type="submit"
              className="h-10 w-full rounded-lg bg-slate-900 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-slate-700"
            >
              <span className="relative z-20 flex items-center justify-center gap-2">
                Open Session
                <svg className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </span>
            </button>
          </form>
        )}
      </div>

      {/* Close Session */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700 text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-800">Close Session</div>
        </div>
        
        {!openSession ? (
          <p className="text-sm font-bold text-slate-400 px-2 italic">Ready for new business. Connect a session first.</p>
        ) : (
          <form onSubmit={closeCashSession} className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Info label="Session #" value={`#${openSession.id}`} />
              <Info
                label="Opened"
                value={new Date(openSession.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              />
              <Info label="Starting" value={`฿${money(openSession.starting_balance)}`} />
              <Info label="Expected" value={`฿${money(openSession.expected_cash)}`} highlight />
              <Info label="Actual Sales" value={`฿${money(openSession.sales_actual)}`} />
              <Info label="Expenses" value={`฿${money(openSession.expenses_total)}`} danger />
              <Info label="Tab Today" value={`฿${money(openSession.sales_tab_today)}`} />
              <Info label="Prev Tabs" value={`฿${money(openSession.sales_tab_previous)}`} />
            </div>

            <div className="border-t border-rose-100/50 pt-3">
              <label className="group/field relative block rounded-xl border border-rose-200 bg-white px-3 py-2.5 transition-all focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-50">
                <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 group-focus-within/field:text-rose-600">Counted Cash Amount</span>
                <div className="flex items-center gap-2">
                  <span className="text-rose-300 font-bold">฿</span>
                  <input
                    type="number"
                    required
                    value={closingCounted}
                    onChange={(e) => setClosingCounted(e.target.value)}
                    className="w-full bg-transparent p-0 border-none text-sm font-black tabular-nums text-rose-900 outline-none transition-all"
                  />
                </div>
              </label>
            </div>

            <button
              type="submit"
              className="h-10 w-full rounded-lg bg-slate-800 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-slate-700"
            >
              <span className="relative z-20 flex items-center justify-center gap-2">
                Settled & Close
                <svg className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </span>
            </button>
          </form>
        )}
      </div>
    </div>
  );

  const expenseCard = (
    <form onSubmit={postExpense} className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <label className="group/field relative block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition-all md:col-span-2 focus-within:bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-50">
        <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 transition-colors group-focus-within/field:text-emerald-600">Amount</span>
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-slate-300">฿</span>
          <input
            type="number"
            required
            placeholder="0.00"
            value={expAmt}
            onChange={(e) => setExpAmt(e.target.value)}
            className="w-full bg-transparent p-0 border-none text-sm font-black tabular-nums text-slate-800 outline-none transition-all placeholder:text-slate-300"
          />
        </div>
      </label>

      <label className="group/field relative block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition-all md:col-span-2 focus-within:bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-50">
        <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 transition-colors group-focus-within/field:text-emerald-600">Category</span>
        <input
          type="text"
          placeholder="e.g. Supplies"
          value={expCat}
          onChange={(e) => setExpCat(e.target.value)}
          className="w-full bg-transparent p-0 border-none text-sm font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-300"
        />
      </label>

      <label className="group/field relative block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition-all md:col-span-4 focus-within:bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-50">
        <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 transition-colors group-focus-within/field:text-emerald-600">Internal Note</span>
        <input
          type="text"
          placeholder="Reason for expense..."
          value={expNote}
          onChange={(e) => setExpNote(e.target.value)}
          className="w-full bg-transparent p-0 border-none text-sm font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-300"
        />
      </label>

      <div className="mt-1 md:col-span-4">
        <button
          disabled={postingExpense}
          type="submit"
          className="h-10 w-full rounded-lg bg-slate-900 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          <span className="relative z-20 flex items-center justify-center gap-3">
            {postingExpense ? "Processing..." : "Confirm & Add Expense"}
            {!postingExpense && <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>}
          </span>
        </button>
      </div>
    </form>
  );

  const withdrawCard = (
    <form onSubmit={postWithdraw} className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <label className="group/field relative block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition-all focus-within:bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-50">
        <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 transition-colors group-focus-within/field:text-indigo-600">Withdraw Amount</span>
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-slate-300">฿</span>
          <input
            type="number"
            required
            placeholder="0.00"
            value={wdAmt}
            onChange={(e) => setWdAmt(e.target.value)}
            className="w-full bg-transparent p-0 border-none text-sm font-black tabular-nums text-slate-800 outline-none transition-all placeholder:text-slate-300"
          />
        </div>
      </label>

      <label className="group/field relative block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition-all md:col-span-2 focus-within:bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-50">
        <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 transition-colors group-focus-within/field:text-indigo-600">Withdrawal Note</span>
        <input
          type="text"
          placeholder="E.g. Cash drop to safe..."
          value={wdNote}
          onChange={(e) => setWdNote(e.target.value)}
          className="w-full bg-transparent p-0 border-none text-sm font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-300"
        />
      </label>

      <div className="mt-1 md:col-span-3">
        <button
          disabled={postingWithdraw}
          type="submit"
          className="h-10 w-full rounded-lg bg-slate-900 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          <span className="relative z-20 flex items-center justify-center gap-3">
            {postingWithdraw ? "Processing..." : "Confirm Withdrawal"}
            {!postingWithdraw && <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 13l-3 3m0 0l-3-3m3 3V8m0 13a9 9 0 110-18 9 9 0 010 18z" /></svg>}
          </span>
        </button>
      </div>
    </form>
  );

  function renderOrdersTable(list) {
    if (!list || !Array.isArray(list) || list.length === 0)
      return <div className="text-sm p-8 text-center text-slate-300 italic">No orders found.</div>;
    const total = list.reduce((s, o) => s + Number(o.total || 0), 0);
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <Th>#</Th>
              <Th>Paid At</Th>
              <Th>Total</Th>
              <Th>Customer</Th>
              <Th>Tab Opened</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {list.map((o) => (
              <React.Fragment key={o.id}>
                <tr className="group/row hover:bg-white transition-colors">
                  <Td>{o.number}</Td>
                  <Td>{o.paid_at ? new Date(o.paid_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}</Td>
                  <Td className="font-black">฿ {money(o.total)}</Td>
                  <Td>{o.customer_name || "—"}</Td>
                  <Td>{o.tab_opened_at ? new Date(o.tab_opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}</Td>
                </tr>
              </React.Fragment>
            ))}
            <tr className="bg-slate-50/50">
              <Td colSpan={2} className="font-black text-slate-400">SUBTOTAL</Td>
              <Td className="font-black text-indigo-600">฿ {money(total)}</Td>
              <Td colSpan={2}></Td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  function renderExpensesTable(list) {
    if (!list || !Array.isArray(list) || list.length === 0)
      return <div className="text-sm p-8 text-center text-slate-300 italic">No expenses recorded.</div>;
    const total = list.reduce((s, e) => s + Number(e.amount || 0), 0);
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <Th>Time</Th>
              <Th>Amount</Th>
              <Th>Category</Th>
              <Th>Note</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {list.map((e) => (
              <tr key={e.id} className="hover:bg-white transition-colors">
                <Td>{e.created_at ? new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}</Td>
                <Td className="font-black text-rose-600">฿ {money(e.amount)}</Td>
                <Td>{e.category}</Td>
                <Td className="text-slate-400">{e.note}</Td>
              </tr>
            ))}
            <tr className="bg-rose-50/20">
              <Td className="font-black text-slate-400">TOTAL</Td>
              <Td className="font-black text-rose-600">฿ {money(total)}</Td>
              <Td colSpan={2}></Td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  function renderWithdrawsTable(list) {
    if (!list || !Array.isArray(list) || list.length === 0)
      return <div className="text-sm p-8 text-center text-slate-300 italic">No withdrawals recorded.</div>;
    const total = list.reduce((s, e) => s + Number(e.amount || 0), 0);
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <Th>Time</Th>
              <Th>Amount</Th>
              <Th>Note</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {list.map((e) => (
              <tr key={e.id} className="hover:bg-white transition-colors">
                <Td>{e.created_at ? new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}</Td>
                <Td className="font-black text-rose-600">฿ {money(e.amount)}</Td>
                <Td className="text-slate-400">{e.note}</Td>
              </tr>
            ))}
            <tr className="bg-rose-50/20">
              <Td className="font-black text-slate-400">TOTAL</Td>
              <Td className="font-black text-rose-600">฿ {money(total)}</Td>
              <Td></Td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  const summaryCards = [
    {
      label: "Session",
      value: openSession ? `#${openSession.id}` : lastClosed ? `#${lastClosed.id}` : "None",
      tone: "text-slate-900",
    },
    {
      label: "Starting",
      value: `฿ ${money(report?.starting_balance ?? openSession?.starting_balance ?? 0)}`,
      tone: "text-slate-900",
    },
    {
      label: "Net Cash",
      value: `฿ ${money(report?.total_money ?? openSession?.expected_cash ?? 0)}`,
      tone: "text-indigo-600",
    },
    {
      label: "Variance",
      value: report?.over_short == null ? "Pending" : `฿ ${money(report.over_short)}`,
      tone: report?.over_short == null
        ? "text-slate-500"
        : report.over_short < 0
          ? "text-rose-600"
          : "text-emerald-600",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-4 md:px-6 md:py-5">
      <div className="mx-auto max-w-7xl space-y-5 p-5">
        <header className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white px-4 py-4 shadow-sm md:px-6 md:py-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
              <Link href="/" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
              <span className="opacity-30">/</span>
              <span className="text-slate-800">Finance</span>
              </div>
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Cash Operations</h1>
                <p className="max-w-2xl text-sm text-slate-500">
                  Open and close sessions, record cash movements, and reconcile the drawer from one place.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/cash/sessions"
                className="flex h-10 items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 transition hover:bg-slate-100"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Session History
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                  {card.label}
                </div>
                <div className={`mt-1 text-lg font-black tracking-tight ${card.tone}`}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="space-y-5">
            <Section 
              title="Daily Operations" 
              icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
            >
              {loadingSessions ? (
                <div className="flex items-center justify-center py-20">
                  <div className="h-8 w-8 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                </div>
              ) : (
                sessionCard
              )}
            </Section>

            <Section
              title={cashActionTab === "expense" ? "Expense (Cash)" : "Withdraw (Cash)"}
              icon={
                cashActionTab === "expense" ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 13l-3 3m0 0l-3-3m3 3V8m0 13a9 9 0 110-18 9 9 0 010 18z" /></svg>
                )
              }
              right={
                <div className="inline-flex rounded-xl border border-slate-300 bg-white p-1">
                  <button
                    onClick={() => setCashActionTab("expense")}
                    className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${
                      cashActionTab === "expense" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    onClick={() => setCashActionTab("withdraw")}
                    className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${
                      cashActionTab === "withdraw" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Withdraw
                  </button>
                </div>
              }
            >
              {cashActionTab === "expense" ? expenseCard : withdrawCard}
            </Section>
          </div>

          <Section
            title="Cash Balance Report"
            icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
            right={
              <div className="flex items-center gap-3">
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-300">Reporting Scope</span>
                  <span className="text-[11px] font-bold text-indigo-600">
                    {report?.scope ?? (reportMode === "day" ? `day:${reportDate}` : openSession ? `session:${openSession.id}` : "—")}
                  </span>
                </div>
              </div>
            }
          >
          {/* Report Controls */}
          <div className="mb-4 flex flex-col justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 lg:flex-row lg:items-center">
            <div className="flex self-start rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <button
                onClick={() => setReportMode("day")}
                className={`rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition-all ${reportMode === "day" ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"}`}
              >
                Daily Scope
              </button>
              <button
                onClick={() => setReportMode("session")}
                className={`rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition-all ${reportMode === "session" ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"}`}
              >
                Session Scope
              </button>
            </div>

            <div className="flex flex-1 items-center gap-3 lg:max-w-md">
              {reportMode === "day" ? (
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold tabular-nums text-slate-700 outline-none transition-all focus:border-indigo-500"
                />
              ) : (
                <div className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold italic text-slate-500">
                  Currently active session #
                  <span className="text-indigo-600 ml-1">
                    {openSession ? openSession.id : lastClosed ? lastClosed.id : "—"}
                  </span>
                </div>
              )}

              <button
                onClick={loadReport}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-all hover:border-indigo-100 hover:text-indigo-600 hover:shadow-md active:scale-95"
              >
                <svg className={`h-5 w-5 ${reportLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
            </div>
          </div>

          {reportLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-8 w-8 rounded-full border-4 border-slate-100 border-t-indigo-600 animate-spin" />
            </div>
          ) : !report ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-100 py-10 text-center">
              <p className="text-sm font-bold text-slate-300 italic uppercase tracking-widest">No report found</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-[1.5rem] border border-slate-100 bg-slate-50/30 divide-y divide-slate-100 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/20">
                <Row k="1. Starting Balance" v={`฿ ${money(report.starting_balance)}`} />
                <AccordionRow order="2." title="Sales – Actual" amount={report.sales_money_actual} open={open.actual} onToggle={() => toggle("actual")} loading={detailLoading && open.actual}>
                  {renderOrdersTable(orders.actual)}
                </AccordionRow>
                <AccordionRow order="3." title="Sales – Tab Today" amount={report.sales_money_tab_today} open={open.tabToday} onToggle={() => toggle("tabToday")} loading={detailLoading && open.tabToday}>
                  {renderOrdersTable(orders.tab_today)}
                </AccordionRow>
                <AccordionRow order="4." title="Previous Tab Sales" amount={report.sales_money_from_previous_tab} open={open.tabPrevious} onToggle={() => toggle("tabPrevious")} loading={detailLoading && open.tabPrevious}>
                  {renderOrdersTable(orders.previous_tab)}
                </AccordionRow>
                <AccordionRow order="5." title="Expense Money" amount={report.expense_money} open={open.expenses} onToggle={() => toggle("expenses")} loading={detailLoading && open.expenses} isDanger>
                  {renderExpensesTable(expenses)}
                </AccordionRow>
                
                <AccordionRow order="6." title="Withdraw Money" amount={report.withdraw_money} open={open.withdrawals} onToggle={() => toggle("withdrawals")} loading={detailLoading && open.withdrawals} isDanger>
                  {renderWithdrawsTable(withdraws)}
                </AccordionRow>

                <Row k="7. Net Cash Total" v={`฿ ${money(report.total_money)}`} bold />

                {"over_short" in report && report.over_short !== null && (
                  <div className="bg-slate-50/80 mt-2 border-t-2 border-slate-200 pt-2 pb-2">
                    <div className="px-5 py-2.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 opacity-60">Reconciliation Summary</div>
                    <Row k="Counted Cash" v={`฿ ${money(report.counted_cash)}`} />
                    <Row k="Over / Short Variance" v={`฿ ${money(report.over_short)}`} bold isDanger={report.over_short < 0} isSuccess={report.over_short >= 0} />
                  </div>
                )}
              </div>
            </div>
          )}
          </Section>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------
// Reusable UI Components
// -----------------------------------------------------
function Info({ label, value, highlight = false, danger = false }) {
  return (
    <div className="grid gap-1">
      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className={`text-[13px] font-black tabular-nums transition-colors ${
        highlight ? "text-indigo-600" : danger ? "text-rose-600 font-black" : "text-slate-700"
      }`}>
        {value}
      </div>
    </div>
  );
}

function Row({ k, v, bold = false, isDanger = false, isSuccess = false }) {
  return (
    <div className={`flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-white/50 ${bold ? "bg-slate-50/30" : ""}`}>
      <span className={`text-[10px] font-black uppercase tracking-[0.16em] ${isDanger ? "text-rose-600" : isSuccess ? "text-emerald-600" : "text-slate-500"}`}>{k}</span>
      <span className={`text-[13px] tabular-nums tracking-tight ${
        bold ? "font-black text-slate-900 border-b-2 border-indigo-500 pb-0.5" : 
        isDanger ? "font-black text-rose-600" : 
        isSuccess ? "font-black text-emerald-600" : 
        "font-bold text-slate-700"
      }`}>
        {v}
      </span>
    </div>
  );
}

function AccordionRow({ order, title, amount, open, onToggle, loading, isDanger = false, children }) {
  return (
    <div className="group/accordion">
      <button
        className={`flex w-full items-center gap-4 px-5 py-4 text-left transition-all hover:bg-indigo-50/30 ${open ? "bg-white shadow-[0_-1px_0_rgba(0,0,0,0.05),0_1px_0_rgba(0,0,0,0.05)]" : ""}`}
        onClick={onToggle}
      >
        <span className="text-[9px] font-black text-slate-300 transition-colors group-hover/accordion:text-indigo-400">{order}</span>
        <span className={`flex-1 text-[10px] font-black uppercase tracking-[0.16em] ${isDanger ? "text-rose-500" : "text-slate-700"} transition-transform group-hover/accordion:translate-x-1`}>{title}</span>
        <span className={`text-[13px] font-black tabular-nums ${isDanger ? "text-rose-600" : "text-slate-900"}`}>฿ {money(amount)}</span>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all ${open ? "rotate-180 border-indigo-600 bg-indigo-600 text-white" : "border-slate-100 text-slate-400 group-hover/accordion:border-indigo-200 group-hover/accordion:text-indigo-600"}`}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </button>
      {open && (
        <div className="bg-slate-50/30 border-y border-slate-100">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 rounded-full border-2 border-indigo-100 border-t-indigo-600 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto p-3">{children}</div>
          )}
        </div>
      )}
    </div>
  );
}

function Th({ children }) {
  return <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{children}</th>;
}

function Td({ children, className = "", ...props }) {
  return (
    <td className={`px-4 py-3 text-[12px] font-semibold text-slate-700 ${className}`} {...props}>
      {children}
    </td>
  );
}
