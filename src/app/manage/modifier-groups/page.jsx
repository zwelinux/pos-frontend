// app/manage/modifier-groups/page.jsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { getApiBase } from "@/lib/api";
import { authFetch } from "@/lib/auth";

function hasManager(me) {
  const g = me?.groups || [];
  return (
    g.some((x) => String(x?.name ?? x).toLowerCase() === "manager") ||
    me?.is_staff ||
    me?.is_superuser
  );
}

function moveOption(options, fromIndex, toIndex) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= options.length ||
    toIndex >= options.length
  ) {
    return options;
  }

  const next = [...options];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function makeOptionDraft(option = {}) {
  return {
    id: option.id,
    client_key: option.client_key || option.id || `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: option.name || "",
    price_delta: option.price_delta ?? 0,
    is_default: !!option.is_default,
    is_removable: option.is_removable ?? true,
    multi_click: !!option.multi_click,
  };
}

function OptionRow({
  opt,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  dragProps,
  isDragging,
  isDragOver,
}) {
  return (
    <div
      draggable
      {...dragProps}
      className={`grid grid-cols-1 md:grid-cols-8 gap-3 items-center group/row p-1.5 rounded-2xl border transition-all duration-300 ${
        isDragging
          ? "border-indigo-300 bg-indigo-100/70 shadow-lg shadow-indigo-100"
          : isDragOver
            ? "border-indigo-200 bg-indigo-50/80"
            : "border-transparent hover:bg-indigo-50/30"
      }`}
    >
      <div className="md:col-span-1 flex items-center justify-center md:justify-start">
        <div className="flex items-center gap-2">
          <div
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-slate-400 cursor-grab active:cursor-grabbing select-none"
            title="Drag to reorder"
          >
            <span className="text-sm font-black leading-none">☰</span>
            <span className="text-[10px] font-black uppercase tracking-widest">Move</span>
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-300">
            #{index + 1}
          </div>
        </div>
      </div>
      <div className="md:col-span-3 relative">
        <input
          value={opt.name}
          onChange={(e) => onChange({ ...opt, name: e.target.value })}
          placeholder="Option display name (e.g. Extra Cheese)"
          className="w-full glass border-white/60 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm font-bold outline-none transition-all"
        />
      </div>
      <div className="md:col-span-1 relative">
        <input
          type="number"
          step="0.01"
          value={opt.price_delta}
          onChange={(e) => onChange({ ...opt, price_delta: e.target.value })}
          placeholder="+฿0.00"
          className="w-full glass border-white/60 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm font-black text-emerald-600 outline-none transition-all placeholder:text-emerald-300"
        />
      </div>
      <label className="md:col-span-1 flex items-center gap-3 px-2 cursor-pointer group/check">
        <div className="relative inline-flex items-center">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={!!opt.is_default}
            onChange={(e) => onChange({ ...opt, is_default: e.target.checked })}
          />
          <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-indigo-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover/check:text-indigo-600 transition-colors">Default</span>
      </label>
      <label className="md:col-span-1 flex items-center gap-3 px-2 cursor-pointer group/check">
        <div className="relative inline-flex items-center">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={!!opt.multi_click}
            onChange={(e) => onChange({ ...opt, multi_click: e.target.checked })}
          />
          <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover/check:text-amber-600 transition-colors">Multi</span>
      </label>
      <div className="md:col-span-1 text-right flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          className="p-2 rounded-xl text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300"
          title="Move up"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="p-2 rounded-xl text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300"
          title="Move down"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
        </button>
        <button 
          type="button" 
          onClick={onRemove} 
          className="p-2 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50 transition-all opacity-0 group-hover/row:opacity-100"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  );
}

function GroupForm({ initial, onSaved, onCancel }) {
  const [form, setForm] = useState(() => ({
    id: initial?.id,
    name: initial?.name || "",
    selection_type: initial?.selection_type || "multi",
    min_required: initial?.min_required ?? 0,
    max_allowed: initial?.max_allowed ?? 99,
    options: (initial?.options || []).map((o) => makeOptionDraft(o)),
    product_ids: (initial?.active_products || []).map(p => p.id),
  }));
  const isEdit = !!form.id;
  const [saving, setSaving] = useState(false);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await authFetch(`${getApiBase()}/admin/products/?page_size=1000&is_active=true`);
        const j = await r.json();
        setAvailableProducts(Array.isArray(j) ? j : j.results || []);
      } catch (e) {
        console.error("Failed to load products", e);
      }
    })();
  }, []);

  const toggleProduct = (pid) => {
    setForm(prev => {
        const current = prev.product_ids || [];
        if (current.includes(pid)) {
            return { ...prev, product_ids: current.filter(id => id !== pid) };
        } else {
            return { ...prev, product_ids: [...current, pid] };
        }
    });
  };

  const filtered = availableProducts.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const updateOptionAt = (index, nextOption) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((option, optionIndex) =>
        optionIndex === index ? nextOption : option
      ),
    }));
  };

  const removeOptionAt = (index) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.filter((_, optionIndex) => optionIndex !== index),
    }));
    setDraggedIndex((current) => (current === index ? null : current));
    setDragOverIndex((current) => (current === index ? null : current));
  };

  const moveOptionAt = (fromIndex, toIndex) => {
    setForm((prev) => ({
      ...prev,
      options: moveOption(prev.options, fromIndex, toIndex),
    }));
    setDraggedIndex(toIndex);
    setDragOverIndex(toIndex);
  };

  const handleDragStart = (index) => (event) => {
    setDraggedIndex(index);
    setDragOverIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragEnter = (index) => (event) => {
    event.preventDefault();
    setDragOverIndex(index);
    setDraggedIndex((currentIndex) => {
      if (currentIndex === null || currentIndex === index) {
        return currentIndex;
      }

      setForm((prev) => ({
        ...prev,
        options: moveOption(prev.options, currentIndex, index),
      }));
      return index;
    });
  };

  const handleDrop = (index) => (event) => {
    event.preventDefault();
    setDragOverIndex(index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        selection_type: form.selection_type,
        min_required: Number(form.min_required ?? 0),
        max_allowed: Number(form.max_allowed ?? 99),
        options: (form.options || []).map((o) => ({
          id: o.id,
          name: o.name,
          price_delta: o.price_delta || 0,
          is_default: !!o.is_default,
          is_removable: o.is_removable ?? true,
          multi_click: !!o.multi_click,
        })),
        product_ids: form.product_ids || [],
      };
      const r = await authFetch(
        `${getApiBase()}/admin/modifier-groups/${isEdit ? form.id + "/" : ""}`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert("Save failed\n" + JSON.stringify(j, null, 2));
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <div className="grid md:grid-cols-2 gap-8">
        <label className="block space-y-2">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Group Title</div>
          <input
            className="w-full glass border-white/60 focus:border-indigo-500 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 outline-none transition-all shadow-sm"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Choice of Protein"
            required
          />
        </label>
        <label className="block space-y-2">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Selection Logic</div>
          <div className="relative">
            <select
              className="w-full glass border-white/60 focus:border-indigo-500 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 outline-none transition-all appearance-none cursor-pointer"
              value={form.selection_type}
              onChange={(e) => setForm({ ...form, selection_type: e.target.value })}
            >
              <option value="single">Single Pick (Radio)</option>
              <option value="multi">Multiple Picks (Checkbox)</option>
            </select>
            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
               <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </label>
        
        <div className="md:col-span-2 grid grid-cols-2 gap-6 bg-indigo-50/30 rounded-[2rem] p-6 border border-white/40">
           <label className="block space-y-2">
             <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 ml-1">Min Required</div>
             <input
               type="number"
               className="w-full glass border-white/60 focus:border-indigo-500 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 outline-none transition-all"
               value={form.min_required}
               onChange={(e) => setForm({ ...form, min_required: e.target.value })}
             />
           </label>
           <label className="block space-y-2">
             <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 ml-1">Max Allowed</div>
             <input
               type="number"
               className="w-full glass border-white/60 focus:border-indigo-500 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 outline-none transition-all"
               value={form.max_allowed}
               onChange={(e) => setForm({ ...form, max_allowed: e.target.value })}
             />
           </label>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
           <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Attached Products</div>
           <div className="text-[10px] font-bold text-indigo-600">
             {form.product_ids?.length || 0} Products Selected
           </div>
        </div>
        <div className="glass rounded-[2rem] border-white/40 p-6 space-y-4">
            <div className="relative">
                <input 
                    className="w-full bg-white/50 border border-white/60 focus:border-indigo-500 rounded-xl px-4 py-3 text-xs font-bold outline-none transition-all"
                    placeholder="Search products to attach..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
            </div>
            
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                {filtered.map(p => {
                    const active = form.product_ids?.includes(p.id);
                    return (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleProduct(p.id)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                active 
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                                : "bg-white/60 text-slate-400 hover:bg-white hover:text-slate-600 border border-white/60"
                            }`}
                        >
                            {p.name}
                        </button>
                    );
                })}
                {filtered.length === 0 && (
                    <div className="w-full py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-300">
                        No products match your search
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
           <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Customize Options</div>
           <button
             type="button"
             className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition-colors"
             onClick={() =>
               setForm({
                 ...form,
                 options: [
                   ...(form.options || []),
                   makeOptionDraft(),
                 ],
               })
             }
           >
             <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
             Add Row
           </button>
        </div>
        <div className="glass rounded-[2rem] border-white/40 p-4 space-y-1">
          <div className="px-2 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-300">
            Drag rows by the move handle or use the arrow buttons to reorder modifier options.
          </div>
          {(form.options || []).map((o, i) => (
            <OptionRow
              key={o.client_key}
              opt={o}
              index={i}
              total={form.options.length}
              onChange={(no) => updateOptionAt(i, no)}
              onRemove={() => removeOptionAt(i)}
              onMoveUp={() => moveOptionAt(i, i - 1)}
              onMoveDown={() => moveOptionAt(i, i + 1)}
              dragProps={{
                onDragStart: handleDragStart(i),
                onDragEnter: handleDragEnter(i),
                onDragOver: (event) => event.preventDefault(),
                onDrop: handleDrop(i),
                onDragEnd: handleDragEnd,
              }}
              isDragging={draggedIndex === i}
              isDragOver={dragOverIndex === i && draggedIndex !== i}
            />
          ))}
          {form.options.length === 0 && (
             <div className="py-8 text-center text-[10px] font-black uppercase tracking-widest text-slate-300">
               No modifiers added yet
             </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 pt-4">
        <button
          disabled={saving}
          className="flex-1 px-8 py-5 rounded-[2rem] bg-indigo-600 text-white text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-100/50 hover:bg-indigo-500 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50"
        >
          {saving ? "Processing..." : isEdit ? "Sync Changes" : "Confirm & Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-8 py-5 rounded-[2rem] glass border-white/60 text-slate-500 text-xs font-black uppercase tracking-[0.2em] hover:bg-white/60 transition-all"
        >
          Dismiss
        </button>
      </div>
    </form>
  );
}

function ModifierGroupsManagePageInner() {
  const [me, setMe] = useState(null);
  const [denied, setDenied] = useState(false);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState(null);

  useEffect(() => {
    if (!showForm) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowForm(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showForm]);

  useEffect(() => {
    (async () => {
      try {
        const r = await authFetch(`${getApiBase()}/me/`);
        if (!r.ok) { setDenied(true); return; }
        const j = await r.json();
        setMe(j);
        setDenied(!hasManager(j));
      } catch (e) { setDenied(true); }
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q) p.set("search", q);
      const r = await authFetch(`${getApiBase()}/admin/modifier-groups/?${p.toString()}`);
      const j = await r.json();
      setItems(Array.isArray(j) ? j : j.results || j.items || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (!denied) load(); }, [denied]);

  const onSaved = async () => {
    setShowForm(false);
    await load();
  };

  const onDelete = async (row) => {
    if (!confirm(`Delete "${row.name}"?`)) return;
    const r = await authFetch(`${getApiBase()}/admin/modifier-groups/${row.id}/`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert("Delete failed\n" + JSON.stringify(j, null, 2));
    } else { await load(); }
  };

  if (denied) return (
    <main className="mesh-bg min-h-screen flex items-center justify-center p-6">
      <div className="glass p-12 rounded-[3rem] border-white/40 max-w-lg text-center">
        <div className="h-16 w-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-rose-500">
           <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Access Denied</h1>
        <p className="text-slate-500 font-bold mb-8">Manager or higher role is required to modify group logic.</p>
        <a href="/" className="px-8 py-3 bg-slate-900 text-white rounded-full text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform active:scale-95 inline-block">Return Home</a>
      </div>
    </main>
  );

  if (!me) return (
    <main className="mesh-bg min-h-screen flex flex-col items-center justify-center gap-4">
       <div className="h-1.5 w-24 glass rounded-full bg-indigo-500/10 overflow-hidden">
         <div className="h-full bg-indigo-500 w-1/3 animate-[progress_1.5s_ease-in-out_infinite]" />
       </div>
       <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Security Gate...</div>
       <style jsx>{` @keyframes progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } } `}</style>
    </main>
  );

  return (
    <main className="mesh-bg min-h-screen py-12 pb-24">
      <div className="max-w-7xl mx-auto px-4 space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
           <div className="space-y-1">
             <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/10 bg-indigo-50/50 px-3 py-1 mb-2 shadow-sm">
               <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
               <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-indigo-600">Dynamic Modifiers</span>
             </div>
             <h1 className="text-4xl font-black text-slate-900 tracking-tight">Modifier Groups</h1>
           </div>
           <div className="flex items-center gap-4">
             <a href="/manage/products" className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">Back to Products</a>
             <button
               className="px-8 py-4 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0 transition-all"
               onClick={() => { setEditRow(null); setShowForm(true); }}
             >
               + Create New Group
             </button>
           </div>
        </header>

        {/* Editor Form Modal */}
        {showForm && (
          <div
            className="fixed inset-0 z-[1200] flex items-start justify-center overflow-y-auto bg-slate-950/45 backdrop-blur-md p-4 pt-20 sm:p-6 sm:pt-24"
            onClick={() => setShowForm(false)}
          >
            <section
              className="glass my-4 w-full max-w-6xl rounded-[2.5rem] border-white/50 p-1.5 shadow-2xl shadow-indigo-200/40"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="bg-white/75 backdrop-blur-md rounded-[2.35rem] max-h-[calc(100vh-7rem)] overflow-y-auto p-6 sm:p-8 lg:p-10">
                <div className="mb-8 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">{editRow ? "Edit Modifier Group" : "Construct New Group"}</h2>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{editRow ? `Editing ID #${editRow.id}` : "Configure selection rules and options"}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowForm(false)}
                    className="p-3 bg-slate-100 rounded-2xl text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-all shrink-0"
                    aria-label="Close modifier group editor"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <GroupForm
                  key={editRow?.id ?? "new"}
                  initial={editRow}
                  onSaved={onSaved}
                  onCancel={() => setShowForm(false)}
                />
              </div>
            </section>
          </div>
        )}

        {/* Groups List */}
        <section className="glass rounded-[2.5rem] border-white/40 shadow-2xl shadow-indigo-100/30 overflow-hidden">
          {/* Search Bar / Controls */}
          <div className="bg-white/40 p-6 border-b border-white/20 flex flex-col md:flex-row items-center gap-4">
             <div className="relative flex-1 group">
               <input
                 value={q}
                 onChange={(e) => setQ(e.target.value)}
                 placeholder="Search by group name..."
                 className="w-full glass border-white/60 focus:border-indigo-500 rounded-2xl px-12 py-4 text-sm font-bold text-slate-900 outline-none transition-all"
               />
               <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
             </div>
             <button onClick={load} className="w-full md:w-auto px-10 py-4 rounded-2xl bg-indigo-50 text-indigo-600 text-xs font-black uppercase tracking-[0.2em] hover:bg-indigo-100 transition-all">
                Sync List
             </button>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
               <div className="p-20 text-center text-[10px] font-black uppercase tracking-widest text-indigo-300 animate-pulse">Refreshing Dataset...</div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left">
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/40">ID</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/40">Group Identity</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/40">Logic</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/40">Coverage</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/40">Requirement</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/40 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/20">
                  {items.map((row) => (
                    <tr key={row.id} className="group hover:bg-white/50 transition-colors duration-300">
                      <td className="px-8 py-6 text-xs font-black text-slate-300">#{row.id}</td>
                      <td className="px-8 py-6">
                         <div className="font-black text-slate-900 text-base">{row.name}</div>
                         <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{(row.options || []).length} options configured</div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${row.selection_type === "single" ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-indigo-50 text-indigo-600 border border-indigo-100"}`}>
                           {row.selection_type}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex flex-wrap gap-1 max-w-[200px]">
                            <div className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-200">
                                {(row.active_products || []).length} Products
                            </div>
                            {(row.active_products || []).slice(0, 2).map(p => (
                                <div key={p.id} className="px-2 py-0.5 rounded-md bg-indigo-50 text-[10px] font-bold text-indigo-500 border border-indigo-100">
                                    {p.name}
                                </div>
                            ))}
                            {(row.active_products || []).length > 2 && (
                                <div className="px-2 py-0.5 rounded-md bg-indigo-50 text-[10px] font-bold text-indigo-500 border border-indigo-100">
                                    +{(row.active_products || []).length - 2}
                                </div>
                            )}
                         </div>
                      </td>
                      <td className="px-8 py-6">
                         <div className="text-xs font-black text-slate-600">{row.min_required}–{row.max_allowed} <span className="text-[10px] text-slate-400">picks</span></div>
                      </td>
                      <td className="px-8 py-6 text-right space-x-2">
                        <button
                          onClick={() => { setEditRow(row); setShowForm(true); }}
                          className="px-4 py-2 rounded-xl bg-white shadow-sm border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-200 hover:text-indigo-600 transition-all"
                        >
                          Configure
                        </button>
                        <button
                          onClick={() => onDelete(row)}
                          className="p-2 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50 transition-all"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td className="p-20 text-center" colSpan={5}>
                        <div className="text-sm font-bold text-slate-400 mb-1">No modifier logic defined</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-300">Create your first modifier group above</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className="mesh-bg min-h-screen flex items-center justify-center"><div className="text-sm font-bold animate-pulse">Loading Environment...</div></main>}>
      <ModifierGroupsManagePageInner />
    </Suspense>
  );
}
