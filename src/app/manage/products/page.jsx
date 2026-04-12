// app/manage/products/page.jsx
"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { formatMoney } from "@/lib/money";

function hasManager(me) {
  const g = me?.groups || [];
  return (
    g.some((x) => String(x?.name ?? x).toLowerCase() === "manager") ||
    me?.is_staff ||
    me?.is_superuser
  );
}

function VariantRow({ v, onChange, onRemove }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center group/row p-2 hover:bg-white/40 rounded-2xl transition-all duration-300">
      <div className="md:col-span-3">
        <input
          value={v.name ?? ""}
          onChange={(e) => onChange({ ...v, name: e.target.value })}
          placeholder="Size / Choice (e.g. Large)"
          className="w-full glass border-white/60 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm font-bold outline-none transition-all"
        />
      </div>
      <div className="md:col-span-2">
        <div className="relative">
          <input
            type="number"
            step="0.01"
            value={v.price_delta ?? ""}
            onChange={(e) => onChange({ ...v, price_delta: e.target.value })}
            placeholder="+฿0.00"
            className="w-full glass border-white/60 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm font-black text-emerald-600 outline-none transition-all placeholder:text-emerald-300"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-400 opacity-40">Extra</div>
        </div>
      </div>
      <div className="md:col-span-1 text-right">
        <button type="button" onClick={onRemove} className="p-2 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50 transition-all opacity-0 group-hover/row:opacity-100">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  );
}

function ProductForm({ categories, allGroups, initial, onCancel, onSaved }) {
  const [form, setForm] = useState(() => ({
    id: initial?.id,
    category: initial?.category ?? initial?.category_id ?? initial?.category_obj?.id ?? "",
    name: initial?.name || "",
    base_price: initial?.base_price ?? "",
    kitchen_station: initial?.kitchen_station || "",
    is_active: initial?.is_active ?? true,
    sop_text: initial?.sop_text || "",
    sop_audio_url: initial?.sop_audio_url || "",
    variants: (initial?.variants || []).map((v) => ({
      id: v.id,
      name: v.name,
      price_delta: v.price_delta,
    })),
    image: initial?.image || null,
    image_file: null, // NEW: for newly selected file
    image_preview: initial?.image || null, // NEW: for previewing selected file
    modifier_group_ids: (initial?.modifier_groups || []).map((g) => g.id),
    modifier_links: Object.fromEntries(
      (initial?.modifier_groups || []).map((g) => [
        g.id,
        {
          show_title: g.show_title,
          show_group: g.show_group,
          required_variant: g.required_variant ?? null,
          required_options: g.required_options || [],
        }
      ])
    ),
  }));

  const [saving, setSaving] = useState(false);
  const [modifierGroupSearch, setModifierGroupSearch] = useState("");
  const [showAllModifierGroups, setShowAllModifierGroups] = useState(false);
  const isEdit = Boolean(form.id);

  const normalizedModifierSearch = modifierGroupSearch.trim().toLowerCase();
  const selectedGroupIds = new Set(form.modifier_group_ids || []);
  const filteredGroups = (allGroups || []).filter((group) =>
    !normalizedModifierSearch ||
    group.name.toLowerCase().includes(normalizedModifierSearch)
  );
  const selectedFilteredGroups = filteredGroups.filter((group) => selectedGroupIds.has(group.id));
  const unselectedFilteredGroups = filteredGroups.filter((group) => !selectedGroupIds.has(group.id));
  const visibleUnselectedGroups = showAllModifierGroups || normalizedModifierSearch
    ? unselectedFilteredGroups
    : unselectedFilteredGroups.slice(0, 6);
  const visibleGroups = [...selectedFilteredGroups, ...visibleUnselectedGroups];
  const hiddenGroupCount = unselectedFilteredGroups.length - visibleUnselectedGroups.length;

  const toggleGroup = (gid) => {
    const ids = new Set(form.modifier_group_ids || []);
    if (ids.has(gid)) ids.delete(gid);
    else ids.add(gid);
    setForm({ ...form, modifier_group_ids: Array.from(ids) });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("category", String(form.category));
      formData.append("name", form.name);
      formData.append("base_price", form.base_price);
      formData.append("kitchen_station", form.kitchen_station);
      formData.append("is_active", String(form.is_active));
      formData.append("sop_text", form.sop_text);
      formData.append("sop_audio_url", form.sop_audio_url);
      formData.append("variants", JSON.stringify((form.variants || []).map((v) => ({
        id: v.id ?? null,
        name: v.name,
        price_delta: v.price_delta,
      }))));
      formData.append("modifier_group_ids", JSON.stringify(form.modifier_group_ids || []));
      formData.append("modifier_links", JSON.stringify(form.modifier_links || {}));

      if (form.image_file) {
        formData.append("image", form.image_file);
      }

      const url = `${API}/admin/products/${isEdit ? form.id + "/" : ""}`;
      const r = await authFetch(url, {
        method: isEdit ? "PUT" : "POST",
        body: formData,
      });

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
    <form onSubmit={save} className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* 0. Image Upload */}
      <div className="space-y-6">
        <div className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400 border-b border-indigo-100 pb-4">00. Product Visual</div>
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="relative group overflow-hidden rounded-[2.5rem] w-full md:w-64 aspect-square glass border-white/60 flex items-center justify-center bg-white/40">
            {form.image_preview ? (
              <img src={form.image_preview} alt="Preview" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
            ) : (
              <div className="text-center space-y-2 p-6">
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-400 flex items-center justify-center mx-auto mb-4">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300">No Image Uploaded</div>
              </div>
            )}
            <label className="absolute inset-0 bg-indigo-600/60 backdrop-blur-sm flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
              <input 
                type="file" 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    setForm({ 
                      ...form, 
                      image_file: file, 
                      image_preview: URL.createObjectURL(file) 
                    });
                  }
                }}
              />
              <svg className="h-8 w-8 text-white mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Click to Upload</span>
            </label>
            {form.image_preview && (
                <button 
                  type="button" 
                  onClick={() => setForm({ ...form, image_file: null, image_preview: initial?.image || null })}
                  className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-xl text-white transition-all shadow-lg"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            )}
          </div>
          <div className="flex-1 space-y-4">
            <h3 className="text-xl font-black text-slate-800">Visual Identity</h3>
            <p className="text-slate-400 text-xs font-bold leading-relaxed max-w-md">
              High-quality product images increase conversion by up to 40%. We recommend a square aspect ratio (1:1) and at least 800x800px.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100 text-[10px] font-black uppercase tracking-widest text-emerald-600">
               <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
               Auto-Optimized to WebP
            </div>
          </div>
        </div>
      </div>

      {/* 1. Basic Details */}
      <div className="space-y-6">
        <div className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400 border-b border-indigo-100 pb-4">01. Basic Configuration</div>
        <div className="grid md:grid-cols-2 gap-6">
          <label className="block space-y-2">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Assigned Category</div>
            <div className="relative">
              <select
                required
                className="w-full glass border-white/60 focus:border-indigo-500 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 outline-none transition-all appearance-none cursor-pointer"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="">Choose Category...</option>
                {(categories || []).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </label>
          <label className="block space-y-2">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Product Name</div>
            <input
              required
              className="w-full glass border-white/60 focus:border-indigo-500 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 outline-none transition-all"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Classic Margherita"
            />
          </label>
        </div>
      </div>

      {/* 2. Pricing & Kitchen */}
      <div className="space-y-6">
        <div className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400 border-b border-indigo-100 pb-4">02. Workflow & Value</div>
        <div className="grid md:grid-cols-3 gap-6">
          <label className="block space-y-2">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Standard Market Price</div>
            <div className="relative">
              <input
                required
                type="number"
                step="0.01"
                className="w-full glass border-white/60 focus:border-emerald-500 rounded-2xl px-5 py-4 text-sm font-black text-emerald-600 outline-none transition-all pl-10"
                value={form.base_price}
                onChange={(e) => setForm({ ...form, base_price: e.target.value })}
                placeholder="0.00"
              />
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-400 font-black">฿</div>
            </div>
          </label>
          <label className="block space-y-2">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Station Route</div>
            <input
              className="w-full glass border-white/60 focus:border-indigo-500 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 outline-none transition-all"
              value={form.kitchen_station}
              onChange={(e) => setForm({ ...form, kitchen_station: e.target.value })}
              placeholder="e.g. GRILL"
            />
          </label>
          <label className="flex items-center gap-3 px-2 pt-8 cursor-pointer select-none">
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Available for Sale</span>
          </label>
        </div>
      </div>

      {/* 3. Variants */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-indigo-100 pb-4">
          <div className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400">03. Variation Options</div>
          <button
            type="button"
            onClick={() => setForm({ ...form, variants: [...form.variants, { id: null, name: "", price_delta: 0 }] })}
            className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            + Add Variant Row
          </button>
        </div>
        <div className="glass border-white/40 p-4 rounded-[2rem] space-y-2">
          {(form.variants || []).map((v, i) => (
            <VariantRow
              key={v.id ?? `new-${i}`}
              v={v}
              onChange={(nv) => setForm({ ...form, variants: form.variants.map((x, idx) => (idx === i ? nv : x)) })}
              onRemove={() => setForm({ ...form, variants: form.variants.filter((_, idx) => idx !== i) })}
            />
          ))}
          {form.variants.length === 0 && (
            <div className="py-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-300">No variants configured</div>
          )}
        </div>
      </div>

      {/* 4. Modifiers */}
      <div className="space-y-6">
        <div className="space-y-4 border-b border-indigo-100 pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400">04. Modifier Logic</div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-[260px]">
                <input
                  value={modifierGroupSearch}
                  onChange={(e) => {
                    setModifierGroupSearch(e.target.value);
                    setShowAllModifierGroups(false);
                  }}
                  placeholder="Search modifier groups..."
                  className="w-full glass border-white/60 focus:border-indigo-500 rounded-2xl px-11 py-3 text-xs font-bold text-slate-900 outline-none transition-all"
                />
                <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {selectedFilteredGroups.length} selected visible
              </div>
            </div>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
            Selected groups stay pinned. Unselected groups are condensed until you expand them.
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {visibleGroups.map((g) => {
            const checked = (form.modifier_group_ids || []).includes(g.id);
            const link = form.modifier_links?.[g.id] || { show_title: true, show_group: true };
            const updateLink = (patch) => {
              setForm((f) => ({
                ...f,
                modifier_links: { ...f.modifier_links, [g.id]: { ...link, ...patch } },
              }));
            };

            return (
              <div key={g.id} className={`p-6 rounded-[2rem] border transition-all duration-300 ${checked ? "bg-white glass border-indigo-200 shadow-lg shadow-indigo-100/30" : "bg-slate-50/50 border-white opacity-60 grayscale-[0.5]"
                }`}>
                <label className="flex items-center justify-between cursor-pointer mb-4">
                  <span className="text-sm font-black text-slate-900">{g.name}</span>
                  <div className="relative inline-flex items-center">
                    <input type="checkbox" className="sr-only peer" checked={checked} onChange={() => toggleGroup(g.id)} />
                    <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                  </div>
                </label>

                {checked && (
                  <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600" checked={link.show_title} onChange={(e) => updateLink({ show_title: e.target.checked })} />
                        <span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-slate-600">Show Title</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600" checked={link.show_group} onChange={(e) => updateLink({ show_group: e.target.checked })} />
                        <span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-slate-600">Show Group</span>
                      </label>
                    </div>
                    <label className="block space-y-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Only show if variant selected</div>
                      <select
                        className="w-full glass border-white focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer"
                        value={link.required_variant ?? ""}
                        onChange={(e) => updateLink({ required_variant: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">Independent (Always show)</option>
                        {(form.variants || []).map((v, i) => (<option key={v.id ?? `tmp-${i}`} value={v.id}>{v.name}</option>))}
                      </select>
                    </label>
                    
                    <label className="block space-y-1 mt-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Only show if ANY of these options are selected</div>
                      <select
                        multiple
                        className="w-full glass border-white focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer h-32"
                        value={link.required_options || []}
                        onChange={(e) => updateLink({ required_options: Array.from(e.target.selectedOptions, o => Number(o.value)) })}
                      >
                        {allGroups.map(grp => (
                          <optgroup key={grp.id} label={grp.name}>
                            {(grp.options || []).map(o => (
                              <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <div className="text-[10px] text-slate-400 font-bold opacity-70">Hold Cmd/Ctrl to select multiple.</div>
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {visibleGroups.length === 0 && (
          <div className="rounded-[2rem] border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
            No modifier groups match this search
          </div>
        )}
        {!normalizedModifierSearch && hiddenGroupCount > 0 && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShowAllModifierGroups((current) => !current)}
              className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 transition-all hover:bg-indigo-100"
            >
              {showAllModifierGroups ? "Show Less" : `Show ${hiddenGroupCount} More Groups`}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 pt-6 border-t border-indigo-100">
        <button
          disabled={saving}
          className="flex-1 px-10 py-5 rounded-[2rem] bg-slate-900 text-white text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50"
        >
          {saving ? "Executing Sync..." : isEdit ? "Update Registry" : "Store New Product"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-10 py-5 rounded-[2rem] glass border-white/60 text-slate-500 text-xs font-black uppercase tracking-[0.2em] hover:bg-white/60 transition-all"
        >
          Dismiss
        </button>
      </div>
    </form>
  );
}

export default function ProductsManagePage() {
  const [me, setMe] = useState(null);
  const [denied, setDenied] = useState(false);
  const [categories, setCategories] = useState([]);
  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState("");
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
        const r = await authFetch(`${API}/me/`);
        if (!r.ok) throw new Error();
        const j = await r.json();
        setMe(j);
        setDenied(!hasManager(j));
      } catch { setDenied(true); }
    })();
  }, []);

  const parseRows = (j) => {
    if (Array.isArray(j)) return j;
    return j.results || j.items || [];
  };

  const loadCategories = async () => {
    const r = await authFetch(`${API}/categories/`);
    const j = await r.json();
    setCategories(parseRows(j));
  };

  const loadGroups = async () => {
    const r = await authFetch(`${API}/admin/modifier-groups/`);
    const j = await r.json();
    setGroups(parseRows(j));
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q) p.set("search", q);
      if (catFilter) p.set("category", catFilter);
      if (isActiveFilter !== "") p.set("is_active", isActiveFilter);
      const r = await authFetch(`${API}/admin/products/?${p.toString()}`);
      const j = await r.json();
      setItems(parseRows(j));
    } catch { setItems([]); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!denied) {
      loadCategories();
      loadGroups();
      loadProducts();
    }
  }, [denied]);

  const onEdit = (row) => {
    setEditRow(row);
    setShowForm(true);
  };

  const onSaved = async () => {
    setShowForm(false);
    await loadProducts();
  };

  const onDelete = async (row) => {
    if (!confirm(`Permanently remove "${row.name}"?`)) return;
    const r = await authFetch(`${API}/admin/products/${row.id}/`, { method: "DELETE" });
    if (!r.ok) { alert("Delete failed"); return; }
    await loadProducts();
  };

  if (denied) return (
    <main className="mesh-bg min-h-screen py-12 px-4 flex items-center justify-center">
      <div className="glass p-12 rounded-[3rem] border-white/40 max-w-lg text-center">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Access Denied</h1>
        <p className="text-slate-500 font-bold mb-8">Management privileges are required here.</p>
        <a href="/" className="px-10 py-4 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest">Return Home</a>
      </div>
    </main>
  );

  if (!me) return (
    <main className="mesh-bg min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="h-1.5 w-24 glass rounded-full bg-indigo-500/10 overflow-hidden"><div className="h-full bg-indigo-500 w-1/3 animate-[progress_1.5s_ease-in-out_infinite]" /></div>
      <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 tracking-[0.4em]">Initializing...</div>
      <style jsx>{` @keyframes progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } } `}</style>
    </main>
  );

  return (
    <main className="mesh-bg min-h-screen py-12 pb-24">
      <div className="max-w-7xl mx-auto px-4 space-y-8">

        {/* Modern Header */}
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/10 bg-indigo-50/50 px-3 py-1 mb-2 shadow-sm">
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-indigo-600">Product Registry</span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Manage Inventory</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">

            <a href="/manage/categories" className="px-6 py-3 rounded-2xl glass border-white/60 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-white/60 transition-all">Categories</a>
            <a href="/manage/modifier-groups" className="px-6 py-3 rounded-2xl glass border-white/60 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-white/60 transition-all">Modifiers</a>
            <button onClick={() => { setEditRow(null); setShowForm(true); }} className="px-8 py-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all">+ New Product</button>
          </div>
        </header>

        {/* Form Modal */}
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
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">{editRow ? "Update Catalog Item" : "Create Catalog Item"}</h2>
                    <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                      {editRow ? `Editing product #${editRow.id}` : "Build a new product record"}
                    </p>
                  </div>
                  <button onClick={() => setShowForm(false)} className="p-3 bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 transition-all shrink-0" aria-label="Close product editor">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <ProductForm
                  key={editRow?.id ?? "new"}
                  categories={categories}
                  allGroups={groups}
                  initial={editRow}
                  onCancel={() => setShowForm(false)}
                  onSaved={onSaved}
                />
              </div>
            </section>
          </div>
        )}

        {/* Enhanced Filtering Control Center */}
        <section className="glass rounded-[2rem] border-white/40 p-6 shadow-xl shadow-indigo-100/20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative group">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products..."
                className="w-full glass border-white/60 focus:border-indigo-500 rounded-2xl px-12 py-4 text-sm font-bold text-slate-900 outline-none transition-all"
              />
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="glass border-white/60 focus:border-indigo-500 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 outline-none cursor-pointer appearance-none">
              <option value="">All Categories</option>
              {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
            <select value={isActiveFilter} onChange={(e) => setIsActiveFilter(e.target.value)} className="glass border-white/60 focus:border-indigo-500 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 outline-none cursor-pointer appearance-none">
              <option value="">All Statuses</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
            <button onClick={loadProducts} className="px-10 py-4 rounded-2xl bg-indigo-50 text-indigo-600 text-xs font-black uppercase tracking-[0.2em] hover:bg-indigo-100 transition-all">Apply Filter</button>
          </div>
        </section>

        {/* Refined Glass Table */}
        <section className="glass rounded-[2.5rem] border-white/40 shadow-2xl shadow-indigo-100/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left bg-slate-50/50 backdrop-blur-sm">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/40">Item Details</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/40">Category</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/40">Price</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/40">Config</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/40 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/20">
                {loading ? (
                  <tr><td colSpan={5} className="p-20 text-center text-[10px] font-black uppercase tracking-[0.4em] text-indigo-300 animate-pulse">Syncing catalog...</td></tr>
                ) : items.map((row) => (
                  <tr key={row.id} className="group hover:bg-white/50 transition-colors duration-300">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="h-16 w-16 min-w-[4rem] rounded-2xl overflow-hidden glass border-white/40 bg-white/20 shadow-sm flex items-center justify-center">
                          {row.image ? (
                            <img src={row.image} alt={row.name} className="h-full w-full object-cover" />
                          ) : (
                            <svg className="h-6 w-6 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          )}
                        </div>
                        <div>
                          <div className="font-black text-slate-900 text-base">{row.name}</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mt-1">
                            <span className="text-slate-300">#{row.id}</span>
                            {row.kitchen_station && <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-500">{row.kitchen_station}</span>}
                            {row.is_active ? <span className="text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-md">Live</span> : <span className="text-rose-400 bg-rose-50 px-2 py-0.5 rounded-md">Disabled</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xs font-black px-4 py-2 rounded-xl bg-white border border-slate-100 text-slate-600 shadow-sm">
                        {row.category_obj?.name || row.category?.name || "Uncategorized"}
                      </span>
                    </td>
                    <td className="px-8 py-6 font-black text-emerald-600 text-lg">฿{formatMoney(row.base_price ?? 0)}</td>
                    <td className="px-8 py-6">
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{(row.variants || []).length} Variants</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{(row.modifier_groups || []).length} Modifiers</div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right space-x-2">
                      <button onClick={() => onEdit(row)} className="px-5 py-2.5 rounded-xl bg-white shadow-sm border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-200 hover:text-indigo-600 transition-all">Edit Item</button>
                      <button onClick={() => onDelete(row)} className="p-2.5 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50 transition-all"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </td>
                  </tr>
                ))}
                {!loading && items.length === 0 && (
                  <tr><td colSpan={5} className="p-20 text-center text-slate-400 font-bold">No products matching filters found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
