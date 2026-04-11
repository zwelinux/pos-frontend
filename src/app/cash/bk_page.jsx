// src/app/cash/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import Link from "next/link";

function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Section({ title, children, right = null }) {
  return (
    <section className="rounded-2xl border p-4 md:p-5 bg-white shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="ml-auto">{right}</div>
      </div>
      {children}
    </section>
  );
}

export default function CashPage() {
  // -------- state
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  const [openStart, setOpenStart] = useState("0.00");
  const [openNote, setOpenNote] = useState("");
  const [closingCounted, setClosingCounted] = useState("");

  const [expAmt, setExpAmt] = useState("");
  const [expCat, setExpCat] = useState("");
  const [expNote, setExpNote] = useState("");
  const [postingExpense, setPostingExpense] = useState(false);

  const [reportDate, setReportDate] = useState(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  });
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportMode, setReportMode] = useState("day"); // "day" | "session"

  // accordion open flags
  const [open, setOpen] = useState({
    actual: false,
    tabToday: false,
    tabPrevious: false,
    expenses: false,
  });
  function toggle(k) {
    setOpen((o) => ({ ...o, [k]: !o[k] }));
  }

  // detail lists (populated when any accordion opens)
  const [orders, setOrders] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // -------- derived
  const openSession = useMemo(
    () => sessions.find((s) => !s.closed_at) || null,
    [sessions]
  );
  const lastClosed = useMemo(
    () => sessions.find((s) => !!s.closed_at) || null,
    [sessions]
  );

  // -------- loaders
  async function loadSessions() {
    setLoadingSessions(true);
    try {
      const r = await authFetch(`${API}/cash-sessions/?ordering=-id`);
      const js = r.ok ? await r.json() : [];
      setSessions(Array.isArray(js) ? js : js?.results || []);
    } catch {
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }

  // ✅ Auto-detect current open session to set default mode
  async function loadCurrentSession() {
    try {
      const r = await authFetch(`${API}/cash-sessions/current/`);
      const js = r.ok ? await r.json() : {};
      if (js.active && js.session?.id) {
        setReportMode("session"); // auto switch to "By Session"
      } else {
        setReportMode("day");
      }
    } catch {
      setReportMode("day");
    }
  }

  async function loadReport() {
    setReportLoading(true);
    try {
      let url = `${API}/report/cash-daily/`;
      if (reportMode === "day") {
        url += `?date=${encodeURIComponent(reportDate)}`;
      } else if (reportMode === "session" && openSession?.id) {
        url += `?session_id=${openSession.id}`;
      } else if (reportMode === "session" && lastClosed?.id) {
        url += `?session_id=${lastClosed.id}`;
      }
      const r = await authFetch(url);
      setReport(r.ok ? await r.json() : null);
    } catch {
      setReport(null);
    } finally {
      setReportLoading(false);
    }
  }

  // load details for accordions (session or day)
  async function loadDetailsForAccordions() {
    setDetailLoading(true);
    try {
      if (reportMode === "session") {
        const sid = openSession?.id || lastClosed?.id;
        if (!sid) {
          setOrders([]);
          setExpenses([]);
        } else {
          const [oRes, eRes] = await Promise.all([
            authFetch(`${API}/cash-sessions/${sid}/orders/`),
            authFetch(`${API}/cash-sessions/${sid}/expenses/`),
          ]);
          setOrders(oRes.ok ? await oRes.json() : []);
          setExpenses(eRes.ok ? await eRes.json() : []);
        }
      } else {
        // Daily (by date)
        const [oRes, eRes] = await Promise.all([
          authFetch(
            `${API}/report/cash-daily/orders/?date=${encodeURIComponent(
              reportDate
            )}`
          ),
          authFetch(
            `${API}/report/cash-daily/expenses/?date=${encodeURIComponent(
              reportDate
            )}`
          ),
        ]).catch(() => [null, null]);
        setOrders(oRes?.ok ? await oRes.json() : []);
        setExpenses(eRes?.ok ? await eRes.json() : []);
      }
    } catch {
      setOrders([]);
      setExpenses([]);
    } finally {
      setDetailLoading(false);
    }
  }

  // ✅ Load sessions AND detect current mode
  useEffect(() => {
    loadSessions();
    loadCurrentSession(); // detect open session and set default mode
  }, []);

  useEffect(() => {
    loadReport();
    // reset accordions + details on scope change
    setOpen({
      actual: false,
      tabToday: false,
      tabPrevious: false,
      expenses: false,
    });
    setOrders(null);
    setExpenses(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportDate, reportMode, openSession?.id, lastClosed?.id]);

  // when user opens any accordion for the first time, fetch detail if not loaded
  useEffect(() => {
    const anyOpen =
      open.actual || open.tabToday || open.tabPrevious || open.expenses;
    if (anyOpen && orders === null && expenses === null && !detailLoading) {
      loadDetailsForAccordions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // -------- actions
  async function openCashSession(e) {
    e?.preventDefault?.();
    try {
      const body = {
        starting_balance: String(openStart || "0"),
        note: openNote || "",
      };
      const r = await authFetch(`${API}/cash-sessions/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setOpenStart("0.00");
      setOpenNote("");
      await loadSessions();
      await loadReport();
      setReportMode("session"); // after opening → switch to session mode
    } catch (err) {
      alert(`Failed to open session: ${err.message}`);
    }
  }

  async function closeCashSession(e) {
    e?.preventDefault?.();
    if (!openSession?.id) return;
    try {
      const r = await authFetch(
        `${API}/cash-sessions/${openSession.id}/close/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ counted_cash: String(closingCounted || "0") }),
        }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setClosingCounted("");
      await loadSessions();
      await loadReport();
    } catch (err) {
      alert(`Failed to close session: ${err.message}`);
    }
  }

  async function postExpense(e) {
    e?.preventDefault?.();
    if (!expAmt) {
      alert("Amount is required");
      return;
    }
    setPostingExpense(true);
    try {
      const r = await authFetch(`${API}/expenses/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: String(expAmt),
          category: expCat || "",
          note: expNote || "",
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setExpAmt("");
      setExpCat("");
      setExpNote("");
      await loadReport();
      if (open.expenses) loadDetailsForAccordions();
    } catch (err) {
      alert(`Failed to add expense: ${err.message}`);
    } finally {
      setPostingExpense(false);
    }
  }

  // -------- helpers for breakdowns
  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
  function parseDate(d) {
    try {
      return d ? new Date(d) : null;
    } catch {
      return null;
    }
  }

  // Session-mode reference date
  const sessionOpenDate = useMemo(() => {
    const sid = openSession?.id ? openSession : lastClosed;
    return sid ? new Date(sid.opened_at) : null;
  }, [openSession, lastClosed]);

  // Session-mode buckets
  const actualOrders = useMemo(() => {
    if (!orders || reportMode !== "session") return orders || [];
    return orders;
  }, [orders, reportMode]);

  const tabTodayOrders = useMemo(() => {
    if (!orders || reportMode !== "session" || !sessionOpenDate) return [];
    return orders.filter(
      (o) =>
        o.tab_opened_at &&
        isSameDay(new Date(o.tab_opened_at), sessionOpenDate)
    );
  }, [orders, reportMode, sessionOpenDate]);

  const tabPreviousOrders = useMemo(() => {
    if (!orders || reportMode !== "session" || !sessionOpenDate) return [];
    return orders.filter(
      (o) =>
        o.tab_opened_at &&
        !isSameDay(new Date(o.tab_opened_at), sessionOpenDate)
    );
  }, [orders, reportMode, sessionOpenDate]);

  // Day-mode reference date
  const reportDayDate = useMemo(() => {
    try {
      return new Date(reportDate);
    } catch {
      return null;
    }
  }, [reportDate]);

  // Day-mode buckets
  const dayActualOrders = useMemo(() => {
    if (reportMode !== "day" || !Array.isArray(orders)) return [];
    return orders.filter((o) => !o.tab_opened_at);
  }, [orders, reportMode]);

  const dayTabTodayOrders = useMemo(() => {
    if (reportMode !== "day" || !Array.isArray(orders) || !reportDayDate)
      return [];
    return orders.filter(
      (o) =>
        o.tab_opened_at &&
        isSameDay(parseDate(o.tab_opened_at), reportDayDate)
    );
  }, [orders, reportMode, reportDayDate]);

  const dayTabPrevOrders = useMemo(() => {
    if (reportMode !== "day" || !Array.isArray(orders) || !reportDayDate)
      return [];
    return orders.filter(
      (o) =>
        o.tab_opened_at &&
        !isSameDay(parseDate(o.tab_opened_at), reportDayDate)
    );
  }, [orders, reportMode, reportDayDate]);

  const sum = (arr, field) =>
    Array.isArray(arr)
      ? arr.reduce((t, x) => t + Number(x?.[field] || 0), 0)
      : 0;

  // -------- UI bits
  const sessionCard = (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Open */}
      <div className="rounded-xl border p-4">
        <div className="font-medium mb-3">Open Session</div>
        {openSession ? (
          <p className="text-sm text-gray-600">
            A session is already open (#{openSession.id}). You can add expenses
            below or close it.
          </p>
        ) : (
          <form onSubmit={openCashSession} className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-sm text-gray-600">
                Starting Balance (cash in drawer)
              </span>
              <input
                type="number"
                step="0.01"
                className="border rounded-lg px-3 py-2"
                value={openStart}
                onChange={(e) => setOpenStart(e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm text-gray-600">Note (optional)</span>
              <input
                type="text"
                className="border rounded-lg px-3 py-2"
                placeholder="Morning shift / Cashier A"
                value={openNote}
                onChange={(e) => setOpenNote(e.target.value)}
              />
            </label>
            <button
              className="justify-center inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-medium hover:bg-gray-50"
              type="submit"
            >
              Open Session
            </button>
          </form>
        )}
      </div>

      {/* Close */}
      <div className="rounded-xl border p-4">
        <div className="font-medium mb-3">Close Session</div>
        {!openSession ? (
          <p className="text-sm text-gray-600">No open session.</p>
        ) : (
          <form onSubmit={closeCashSession} className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Info label="Session #" value={`#${openSession.id}`} />
              <Info
                label="Opened"
                value={new Date(openSession.opened_at).toLocaleString()}
              />
              <Info
                label="Starting Balance"
                value={`฿ ${money(openSession.starting_balance)}`}
              />
              <Info
                label="Expected Cash (now)"
                value={`฿ ${money(openSession.expected_cash)}`}
              />
              <Info
                label="Actual Sales"
                value={`฿ ${money(openSession.sales_actual)}`}
              />
              <Info
                label="Tab Sales (Today)"
                value={`฿ ${money(openSession.sales_tab_today)}`}
              />
              <Info
                label="From Previous Tabs"
                value={`฿ ${money(openSession.sales_tab_previous)}`}
              />
              <Info
                label="Expenses"
                value={`฿ ${money(openSession.expenses_total)}`}
              />
            </div>
            <label className="grid gap-1">
              <span className="text-sm text-gray-600">
                Counted Cash (physical)
              </span>
              <input
                type="number"
                step="0.01"
                className="border rounded-lg px-3 py-2"
                value={closingCounted}
                onChange={(e) => setClosingCounted(e.target.value)}
                placeholder="e.g., 5,230.00"
              />
            </label>
            <button
              className="justify-center inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-medium hover:bg-gray-50"
              type="submit"
            >
              Close Session
            </button>
          </form>
        )}
      </div>
    </div>
  );

  const expenseCard = (
    <form onSubmit={postExpense} className="grid md:grid-cols-4 gap-3">
      <label className="grid gap-1">
        <span className="text-sm text-gray-600">Amount</span>
        <input
          type="number"
          step="0.01"
          className="border rounded-lg px-3 py-2"
          value={expAmt}
          onChange={(e) => setExpAmt(e.target.value)}
          placeholder="e.g., 150.00"
        />
      </label>
      <label className="grid gap-1">
        <span className="text-sm text-gray-600">Category</span>
        <input
          type="text"
          className="border rounded-lg px-3 py-2"
          value={expCat}
          onChange={(e) => setExpCat(e.target.value)}
          placeholder="Ingredients / Petty cash"
        />
      </label>
      <label className="grid gap-1 md:col-span-2">
        <span className="text-sm text-gray-600">Note</span>
        <input
          type="text"
          className="border rounded-lg px-3 py-2"
          value={expNote}
          onChange={(e) => setExpNote(e.target.value)}
          placeholder="Milk & eggs"
        />
      </label>
      <div className="md:col-span-4">
        <button
          disabled={postingExpense}
          className="justify-center inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-medium hover:bg-gray-50 disabled:opacity-50"
          type="submit"
        >
          Add Expense {postingExpense ? "…" : ""}
        </button>
      </div>
    </form>
  );

  const reportCard = (
    <div className="grid gap-4">
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="reportMode"
              className="accent-black"
              checked={reportMode === "day"}
              onChange={() => setReportMode("day")}
            />
            <span>Daily (by date)</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="reportMode"
              className="accent-black"
              checked={reportMode === "session"}
              onChange={() => setReportMode("session")}
            />
            <span>By Session</span>
          </label>
        </div>

        {reportMode === "day" && (
          <label className="grid gap-1">
            <span className="text-sm text-gray-600">Pick date</span>
            <input
              type="date"
              className="border rounded-lg px-3 py-2"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
            />
          </label>
        )}
        {reportMode === "session" && (
          <div className="text-sm text-gray-600">
            Showing{" "}
            {openSession
              ? `Open Session #${openSession.id}`
              : lastClosed
              ? `Last Closed #${lastClosed.id}`
              : "—"}
          </div>
        )}
        <button
          onClick={loadReport}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-medium hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {reportLoading ? (
        <div className="text-sm text-gray-500">Loading report…</div>
      ) : report ? (
        <div className="rounded-xl border divide-y">
          <Row k="1. Starting Balance" v={`฿ ${money(report.starting_balance)}`} />

          {/* 2. Actual Sales */}
          <AccordionRow
            order="2."
            title="Sales Money – Actual Sales"
            amount={report.sales_money_actual}
            open={open.actual}
            onToggle={() => toggle("actual")}
            loading={detailLoading && open.actual}
          >
            {renderOrdersTable(reportMode === "session" ? actualOrders : dayActualOrders)}
          </AccordionRow>

          {/* 3. Tab Sales (Today) */}
          <AccordionRow
            order="3."
            title="Sales Money – Tab Sales (Today)"
            amount={report.sales_money_tab_today}
            open={open.tabToday}
            onToggle={() => toggle("tabToday")}
            loading={detailLoading && open.tabToday}
          >
            {renderOrdersTable(reportMode === "session" ? tabTodayOrders : dayTabTodayOrders)}
          </AccordionRow>

          {/* 4. Sales from Previous Tab */}
          <AccordionRow
            order="4."
            title="Sales Money from Previous Tab"
            amount={report.sales_money_from_previous_tab}
            open={open.tabPrevious}
            onToggle={() => toggle("tabPrevious")}
            loading={detailLoading && open.tabPrevious}
          >
            {renderOrdersTable(reportMode === "session" ? tabPreviousOrders : dayTabPrevOrders)}
          </AccordionRow>

          {/* 5. Expenses */}
          <AccordionRow
            order="5."
            title="Expense Money"
            amount={report.expense_money}
            open={open.expenses}
            onToggle={() => toggle("expenses")}
            loading={detailLoading && open.expenses}
          >
            {renderExpensesTable(expenses)}
          </AccordionRow>

          <Row k="6. Total Money" v={`฿ ${money(report.total_money)}`} bold />

          {"over_short" in report && report.over_short !== null && (
            <>
              <div className="bg-gray-50 px-4 py-2 text-sm text-gray-600">
                Session Close Summary
              </div>
              <Row k="Counted Cash" v={`฿ ${money(report.counted_cash)}`} />
              <Row
                k="Over / Short (Counted − Expected)"
                v={`฿ ${money(report.over_short)}`}
                bold
              />
            </>
          )}
        </div>
      ) : (
        <div className="text-sm text-gray-500">No data.</div>
      )}
    </div>
  );

  // -------- render
  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Cash Drawer & Daily Cash Report</h1>

      <h4>
        <Link
          href="/cash/sessions"
          className="text-blue-400 hover:text-blue-600 underline"
        >
          Manage Sessions
        </Link>
      </h4>
      <br />

      <Section title="Session">
        {loadingSessions ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : (
          sessionCard
        )}
      </Section>

      <Section title="Expense (Cash)">{expenseCard}</Section>

      <Section
        title="Daily Cash Balance Report"
        right={
          <span className="text-xs text-gray-500">
            Scope:&nbsp;
            {report?.scope ||
              (reportMode === "day"
                ? `day:${reportDate}`
                : openSession
                ? `session:${openSession.id}`
                : "—")}
          </span>
        }
      >
        {reportCard}
      </Section>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="grid gap-1">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Row({ k, v, bold = false }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="text-sm">{k}</div>
      <div className={`tabular-nums ${bold ? "font-semibold" : ""}`}>{v}</div>
    </div>
  );
}

// ---------- Accordion + Detail Tables

function AccordionRow({ order, title, amount, open, onToggle, loading, children }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
      >
        <span className="text-sm text-gray-500">{order}</span>
        <span className="font-medium flex-1">{title}</span>
        <span className="tabular-nums">฿ {money(amount)}</span>
        <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full border">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div className="border-t">
          {loading ? (
            <div className="p-4 text-sm text-gray-500">Loading…</div>
          ) : (
            <div className="p-3 overflow-x-auto">{children}</div>
          )}
        </div>
      )}
    </div>
  );
}

function Th({ children }) {
  return <th className="px-3 py-2 font-medium">{children}</th>;
}
function Td({ children, className = "", ...rest }) {
  return (
    <td className={`px-3 py-2 ${className}`} {...rest}>
      {children}
    </td>
  );
}

function renderOrdersTable(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return <div className="p-2 text-sm text-gray-500">No orders.</div>;
  }
  const total = list.reduce((t, o) => t + Number(o.total || 0), 0);
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 text-left">
        <tr>
          <Th>#</Th>
          <Th>Paid At</Th>
          <Th>Total</Th>
          <Th>Customer</Th>
          <Th>Tab Opened</Th>
        </tr>
      </thead>
      <tbody>
        {list.map((o) => (
          <tr key={o.id} className="border-t">
            <Td>{o.number}</Td>
            <Td>{o.paid_at ? new Date(o.paid_at).toLocaleString() : "—"}</Td>
            <Td>฿ {money(o.total)}</Td>
            <Td>{o.customer_name || "—"}</Td>
            <Td>
              {o.tab_opened_at ? new Date(o.tab_opened_at).toLocaleString() : "—"}
            </Td>
          </tr>
        ))}
        <tr className="border-t bg-gray-50 font-medium">
          <Td colSpan={2}>Subtotal</Td>
          <Td>฿ {money(total)}</Td>
          <Td colSpan={2}></Td>
        </tr>
      </tbody>
    </table>
  );
}

function renderExpensesTable(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return <div className="p-2 text-sm text-gray-500">No expenses.</div>;
  }
  const total = list.reduce((t, e) => t + Number(e.amount || 0), 0);
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 text-left">
        <tr>
          <Th>Time</Th>
          <Th>Amount</Th>
          <Th>Category</Th>
          <Th>Note</Th>
        </tr>
      </thead>
      <tbody>
        {list.map((e) => (
          <tr key={e.id} className="border-t">
            <Td>{e.created_at ? new Date(e.created_at).toLocaleString() : "—"}</Td>
            <Td>฿ {money(e.amount)}</Td>
            <Td>{e.category || "—"}</Td>
            <Td>{e.note || "—"}</Td>
          </tr>
        ))}
        <tr className="border-t bg-gray-50 font-medium">
          <Td>Total</Td>
          <Td>฿ {money(total)}</Td>
          <Td colSpan={2}></Td>
        </tr>
      </tbody>
    </table>
  );
}
