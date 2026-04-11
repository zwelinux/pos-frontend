"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getApiBase } from "@/lib/api";
import { authFetch, hasRole } from "@/lib/auth";

// =====================
// Small UI primitives
// =====================
function cn(...cls) {
  return cls.filter(Boolean).join(" ");
}

function Section({ title, subtitle, right, children, className = "" }) {
  return (
    <section className={cn("rounded-2xl border bg-white shadow-sm", className)}>
      <div className="flex items-start gap-3 px-4 py-3 border-b">
        <div>
          <h2 className="text-lg font-semibold leading-tight">{title}</h2>
          {subtitle ? (
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          ) : null}
        </div>
        <div className="ml-auto">{right}</div>
      </div>
      <div className="p-4 md:p-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  error,
  className = "",
  children,
}) {
  return (
    <label className={cn("grid gap-1", className)}>
      {label ? <span className="text-sm text-gray-700">{label}</span> : null}
      {children}
      <div className="min-h-[1.25rem]">
        {error ? (
          <span className="text-xs text-red-600">{error}</span>
        ) : hint ? (
          <span className="text-xs text-gray-500">{hint}</span>
        ) : null}
      </div>
    </label>
  );
}

function PillTabs({ value, onChange, items }) {
  return (
    <div className="inline-flex rounded-xl border bg-white p-1 shadow-sm">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          onClick={() => onChange(it.value)}
          className={cn(
            "px-3 py-1.5 text-sm rounded-lg transition",
            value === it.value
              ? "bg-black text-white"
              : "hover:bg-gray-50 text-gray-700"
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function IconButton({ title, onClick, children, className = "", type = "button" }) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border px-2.5 py-1 text-xs font-medium",
        "hover:bg-gray-50 active:scale-[.99] transition",
        className
      )}
    >
      {children}
    </button>
  );
}

// ---------- helpers ----------
const money = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function toLocalISO(date, time) {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0);
  return dt.toISOString();
}

function nowParts() {
  const dt = new Date();
  const pad = (x) => String(x).padStart(2, "0");
  return {
    date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
    time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
  };
}

// ============================================
// Page
// ============================================
export default function BackfillPage() {
  const [tab, setTab] = useState("order");
  const [mounted, setMounted] = useState(false);
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsManager(hasRole("Manager"));
  }, []);

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">Backfill (Offline Catch‑Up)</h1>
        <div className="ml-auto">
          <PillTabs
            value={tab}
            onChange={setTab}
            items={[
              { value: "order", label: "Order" },
              // { value: "expense", label: "Expense" },
              // { value: "session", label: "Cash Session" },
            ]}
          />
        </div>
      </div>

      {!mounted ? (
        <Section title="Loading">
          <p className="text-sm text-gray-600">Checking permissions…</p>
        </Section>
      ) : !isManager ? (
        <Section title="Backfill (Managers only)">
          <p className="text-sm text-gray-600">You must be a Manager to access this page.</p>
        </Section>
      ) : (
        <>
          {tab === "order" && <BackfillOrder />}
          {tab === "expense" && <BackfillExpense />}
          {tab === "session" && <BackfillSession />}
        </>
      )}
    </main>
  );
}

// ============================================
// Backfill: Order
// ============================================
function BackfillOrder() {
  const [createdDate, setCreatedDate] = useState("");
  const [createdTime, setCreatedTime] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [paidTime, setPaidTime] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [tableLabel, setTableLabel] = useState("");
  const [taxRate, setTaxRate] = useState("0.00");
  const [externalRef, setExternalRef] = useState("");
  const [silent, setSilent] = useState(true);

  const [items, setItems] = useState([
    { product_name: "", variant_name: "", qty: 1, unit_price: "" },
  ]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [errors, setErrors] = useState({});
  const lastQtyRef = useRef(null);

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + Number(it.unit_price || 0) * Number(it.qty || 0), 0),
    [items]
  );
  const tax = useMemo(() => (subtotal * Number(taxRate || 0)) / 100, [subtotal, taxRate]);
  const total = useMemo(() => subtotal + tax, [subtotal, tax]);

  function setNow(setDate, setTime) {
    const { date, time } = nowParts();
    setDate(date);
    setTime(time);
  }

  function updateItem(i, patch) {
    setItems((prev) => {
      const clone = prev.slice();
      clone[i] = { ...clone[i], ...patch };
      return clone;
    });
  }

  function addRow(copyLast = false) {
    setItems((prev) => {
      const base = copyLast && prev.length ? prev[prev.length - 1] : { product_name: "", variant_name: "", qty: 1, unit_price: "" };
      return [...prev, { ...base }];
    });
    // focus qty of the new row after paint
    setTimeout(() => lastQtyRef.current?.focus(), 0);
  }

  function removeRow(i) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function validate() {
    const e = {};
    if (!createdDate || !paidDate) e.datetime = "Created At and Paid At are required.";
    if (!items.length || items.some((it) => !it.product_name || !it.qty || !it.unit_price)) {
      e.items = "Each item needs product, qty, and unit price.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(e) {
    e?.preventDefault?.();
    setMsg("");
    if (!validate()) return;

    const payload = {
      created_at: toLocalISO(createdDate, createdTime),
      paid_at: toLocalISO(paidDate, paidTime),
      payment_method: paymentMethod,
      table_name: tableLabel,
      items: items.map((it) => ({
        product_name: it.product_name,
        variant_name: it.variant_name || "",
        qty: Number(it.qty || 0),
        unit_price: String(it.unit_price || "0"),
        notes: "",
      })),
      tax_rate: String(taxRate || "0"),
      external_ref: externalRef || "",
      silent: !!silent,
    };

    setBusy(true);
    try {
      const r = await authFetch(`${getApiBase()}/backfill/orders/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const js = await r.json();
      setMsg(`✅ Backfilled order #${js.number ?? js.id} • ฿ ${money(total)}`);
      setItems([{ product_name: "", variant_name: "", qty: 1, unit_price: "" }]);
      setExternalRef("");
    } catch (err) {
      setMsg(`❌ Failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Backfill Order (Paid)"
      subtitle="Store ledger orders quickly. Snapshot only—won’t ping the KDS if Silent is on."
      right={<span className="text-xs text-gray-500">source="backfill"</span>}
      className="relative"
    >
      {/* Sticky summary bar */}
      <div className="sticky top-14 z-10 -mx-4 md:-mx-5 px-4 md:px-5 py-2 bg-white/90 backdrop-blur border-b">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-600">Total</span>
          <span className="font-semibold">฿ {money(total)}</span>
          <span className="text-gray-400">(Subtotal ฿ {money(subtotal)} · Tax {Number(taxRate || 0)}%)</span>
          <div className="ml-auto flex gap-2">
            <IconButton onClick={() => setNow(setCreatedDate, setCreatedTime)}>Now → Created</IconButton>
            <IconButton onClick={() => setNow(setPaidDate, setPaidTime)}>Now → Paid</IconButton>
            <IconButton onClick={() => addRow(true)}>Copy last row</IconButton>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="grid gap-5">
        {/* Datetimes & meta */}
        <div className="grid md:grid-cols-2 gap-3 my-5">
          <Field label="Created At (local)" error={errors.datetime}>
            <div className="flex gap-2">
              <input type="date" className="border rounded-lg px-3 py-2 w-full" value={createdDate} onChange={(e) => setCreatedDate(e.target.value)} />
              <input type="time" className="border rounded-lg px-3 py-2 w-full" value={createdTime} onChange={(e) => setCreatedTime(e.target.value)} />
            </div>
          </Field>

          <Field label="Paid At (local)">
            <div className="flex gap-2">
              <input type="date" className="border rounded-lg px-3 py-2 w-full" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
              <input type="time" className="border rounded-lg px-3 py-2 w-full" value={paidTime} onChange={(e) => setPaidTime(e.target.value)} />
            </div>
          </Field>

          <Field label="Payment Method">
            <div className="flex flex-wrap gap-2">
              {[
                { v: "cash", l: "Cash" },
                { v: "card", l: "Card" },
                { v: "qr", l: "QR" },
                { v: "other", l: "Other" },
              ].map((x) => (
                <button
                  key={x.v}
                  type="button"
                  onClick={() => setPaymentMethod(x.v)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm",
                    paymentMethod === x.v ? "bg-black text-white" : "hover:bg-gray-50"
                  )}
                >
                  {x.l}
                </button>
              ))}
            </div>
          </Field>

          <br />

          <Field label="Table Label (snapshot only)" hint="e.g., Takeaway, Table 5">
            <input className="border rounded-lg px-3 py-2" value={tableLabel} onChange={(e) => setTableLabel(e.target.value)} />
          </Field>

          <Field label="Tax Rate %">
            <input type="number" step="0.01" className="border rounded-lg px-3 py-2" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
          </Field>

          <Field label="External Ref (ledger no.)">
            <input className="border rounded-lg px-3 py-2" value={externalRef} onChange={(e) => setExternalRef(e.target.value)} />
          </Field>

          <label className="inline-flex items-center gap-2 mt-1">
            <input type="checkbox" className="accent-black" checked={silent} onChange={(e) => setSilent(e.target.checked)} />
            <span className="text-sm text-gray-700">Silent (no KDS sound/broadcast)</span>
          </label>
        </div>

        {/* Items table */}
        <div className="rounded-xl border overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 text-sm font-medium">Items</div>
          <div className="p-3">
            <div className="grid grid-cols-12 gap-2 text-xs text-gray-600 mb-1">
              <div className="col-span-4">Product Name</div>
              <div className="col-span-3">Variant (optional)</div>
              <div className="col-span-2">Qty</div>
              <div className="col-span-2">Unit Price</div>
              <div className="col-span-1" />
            </div>

            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                <input
                  className="col-span-4 border rounded-lg px-3 py-2"
                  value={it.product_name}
                  onChange={(e) => updateItem(i, { product_name: e.target.value })}
                  placeholder="e.g., Iced Latte"
                />
                <input
                  className="col-span-3 border rounded-lg px-3 py-2"
                  value={it.variant_name}
                  onChange={(e) => updateItem(i, { variant_name: e.target.value })}
                  placeholder="e.g., Large"
                />
                <input
                  ref={i === items.length - 1 ? lastQtyRef : null}
                  type="number"
                  min="1"
                  className="col-span-2 border rounded-lg px-3 py-2"
                  value={it.qty}
                  onChange={(e) => updateItem(i, { qty: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRow();
                    }
                    if (e.key === "Backspace" && !String(it.qty)) {
                      removeRow(i);
                    }
                  }}
                />
                <input
                  type="number"
                  step="0.01"
                  className="col-span-2 border rounded-lg px-3 py-2"
                  value={it.unit_price}
                  onChange={(e) => updateItem(i, { unit_price: e.target.value })}
                  placeholder="0.00"
                />
                <div className="col-span-1 flex items-center justify-end">
                  <IconButton title="Remove" onClick={() => removeRow(i)}>✕</IconButton>
                </div>
              </div>
            ))}

            <div className="flex items-center gap-2 mt-2">
              <IconButton onClick={() => addRow()}>+ Add Row</IconButton>
              <IconButton onClick={() => addRow(true)}>Copy last</IconButton>
              {errors.items ? (
                <span className="text-xs text-red-600">{errors.items}</span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>฿ {money(subtotal)}</span></div>
              <div className="flex justify-between"><span>Tax ({Number(taxRate || 0)}%)</span><span>฿ {money(tax)}</span></div>
              <div className="flex justify-between font-semibold"><span>Total</span><span>฿ {money(total)}</span></div>
            </div>
          </div>
        </div>

        {msg ? (
          <div className={cn(
            "text-sm px-3 py-2 rounded border",
            msg.startsWith("✅") ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
          )}>
            {msg}
          </div>
        ) : null}

        <div className="bottom-4 self-end flex justify-end">
          <button
            disabled={busy}
            className="rounded-xl border px-4 py-2.5 font-medium shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {busy ? "Saving…" : `Save Backfilled Order (฿ ${money(total)})`}
          </button>
        </div>
      </form>
    </Section>
  );
}

// ============================================
// Backfill: Expense
// ============================================
function BackfillExpense() {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function setNow() {
    const { date: d, time: t } = nowParts();
    setDate(d);
    setTime(t);
  }

  async function submit(e) {
    e?.preventDefault?.();
    setMsg("");
    if (!amount) {
      setMsg("Amount is required.");
      return;
    }
    const payload = {
      amount: String(amount),
      category: category || "",
      note: note || "",
      created_at: date ? toLocalISO(date, time) : null,
      external_ref: externalRef || "",
    };
    setBusy(true);
    try {
      const r = await authFetch(`${getApiBase()}/backfill/expenses/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setMsg("✅ Backfilled expense saved.");
      setAmount("");
      setCategory("");
      setNote("");
      setExternalRef("");
    } catch (err) {
      setMsg(`❌ Failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Backfill Expense" subtitle="Record out-of-band spend.">
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-3">
        <Field label="Amount">
          <input type="number" step="0.01" className="border rounded-lg px-3 py-2" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Category">
          <input className="border rounded-lg px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ingredients / Petty cash" />
        </Field>
        <Field label="Note">
          <input className="border rounded-lg px-3 py-2" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Date (optional)">
            <input type="date" className="border rounded-lg px-3 py-2" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Time (optional)">
            <input type="time" className="border rounded-lg px-3 py-2" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <Field label="External Ref (ledger no.)">
          <input className="border rounded-lg px-3 py-2" value={externalRef} onChange={(e) => setExternalRef(e.target.value)} />
        </Field>

        {msg && (
          <div className={cn(
            "md:col-span-2 text-sm px-3 py-2 rounded border",
            msg.startsWith("✅") ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
          )}>
            {msg}
          </div>
        )}

        <div className="md:col-span-2 flex gap-2 items-center">
          <IconButton onClick={setNow}>Now</IconButton>
          <button disabled={busy} className="ml-auto rounded-lg border px-3 py-2 font-medium hover:bg-gray-50 disabled:opacity-50">
            {busy ? "Saving…" : "Save Backfilled Expense"}
          </button>
        </div>
      </form>
    </Section>
  );
}

// ============================================
// Backfill: Cash Session
// ============================================
function BackfillSession() {
  const [openedDate, setOpenedDate] = useState("");
  const [openedTime, setOpenedTime] = useState("");
  const [startingBalance, setStartingBalance] = useState("0.00");
  const [closedDate, setClosedDate] = useState("");
  const [closedTime, setClosedTime] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function setOpenNow() {
    const { date, time } = nowParts();
    setOpenedDate(date);
    setOpenedTime(time);
  }
  function setCloseNow() {
    const { date, time } = nowParts();
    setClosedDate(date);
    setClosedTime(time);
  }

  async function submit(e) {
    e?.preventDefault?.();
    setMsg("");
    if (!openedDate) {
      setMsg("Opened date is required.");
      return;
    }

    const payload = {
      opened_at: toLocalISO(openedDate, openedTime),
      starting_balance: String(startingBalance || "0"),
      note: note || "",
      closed_at: closedDate ? toLocalISO(closedDate, closedTime) : null,
      counted_cash: countedCash === "" ? null : String(countedCash),
    };

    setBusy(true);
    try {
      const r = await authFetch(`${getApiBase()}/backfill/sessions/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const js = await r.json();
      setMsg(`✅ Backfilled session #${js.id}`);
    } catch (err) {
      setMsg(`❌ Failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Backfill Cash Session" subtitle="Recreate open/close sessions.">
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Opened Date">
            <input type="date" className="border rounded-lg px-3 py-2" value={openedDate} onChange={(e) => setOpenedDate(e.target.value)} />
          </Field>
          <Field label="Opened Time">
            <input type="time" className="border rounded-lg px-3 py-2" value={openedTime} onChange={(e) => setOpenedTime(e.target.value)} />
          </Field>
        </div>

        <Field label="Starting Balance">
          <input type="number" step="0.01" className="border rounded-lg px-3 py-2" value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Closed Date (optional)">
            <input type="date" className="border rounded-lg px-3 py-2" value={closedDate} onChange={(e) => setClosedDate(e.target.value)} />
          </Field>
          <Field label="Closed Time (optional)">
            <input type="time" className="border rounded-lg px-3 py-2" value={closedTime} onChange={(e) => setClosedTime(e.target.value)} />
          </Field>
        </div>

        <Field label="Counted Cash (optional)">
          <input type="number" step="0.01" className="border rounded-lg px-3 py-2" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} />
        </Field>

        <Field label="Note (e.g., Ledger reference)">
          <input className="border rounded-lg px-3 py-2" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        {msg && (
          <div className={cn(
            "md:col-span-2 text-sm px-3 py-2 rounded border",
            msg.startsWith("✅") ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
          )}>
            {msg}
          </div>
        )}

        <div className="md:col-span-2 flex flex-wrap items-center gap-2">
          <IconButton onClick={setOpenNow}>Now → Open</IconButton>
          <IconButton onClick={setCloseNow}>Now → Close</IconButton>
          <button disabled={busy} className="ml-auto rounded-lg border px-3 py-2 font-medium hover:bg-gray-50 disabled:opacity-50">
            {busy ? "Saving…" : "Save Backfilled Session"}
          </button>
        </div>
      </form>
    </Section>
  );
}
