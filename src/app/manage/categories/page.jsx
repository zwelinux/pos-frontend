"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { authFetch } from "@/lib/auth";

export default function ManageCategories() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [sort, setSort] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await authFetch(`${API}/admin/categories/?ordering=sort`);
      const j = await r.json();
      const rows = Array.isArray(j) ? j : (j.results || j.items || []);
      setItems(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createCat = async () => {
    if (!name.trim()) return alert("Name is required");
    const r = await authFetch(`${API}/admin/categories/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        sort: sort ? Number(sort) : undefined,
        is_active: isActive,
      }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return alert("Create failed\n" + JSON.stringify(j, null, 2));
    }
    setName(""); setSort(""); setIsActive(true);
    await load();
  };

  const update = async (row, patch) => {
    const r = await authFetch(`${API}/admin/categories/${row.id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return alert("Update failed\n" + JSON.stringify(j, null, 2));
    }
    await load();
  };

  const remove = async (row) => {
    if (!confirm(`Delete "${row.name}"?`)) return;
    const r = await authFetch(`${API}/admin/categories/${row.id}/`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return alert("Delete failed\n" + JSON.stringify(j, null, 2));
    }
    await load();
  };

  return (
    <main className="mesh-bg min-h-screen py-12 pb-24">
      <div className="max-w-7xl mx-auto px-4 space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
           <div className="space-y-1">
             <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/10 bg-indigo-50/50 px-3 py-1 mb-2 shadow-sm">
               <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
               <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-indigo-600">Product Organization</span>
             </div>
             <h1 className="text-4xl font-black text-slate-900 tracking-tight">Categories</h1>
           </div>
           <a 
             href="/manage/products" 
             className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors group"
           >
             <svg className="h-4 w-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
             </svg>
             Back to Product Management
           </a>
        </header>

        {/* Quick Add Bar */}
        <section className="glass rounded-[2rem] border-white/40 p-1.5 shadow-xl shadow-indigo-100/20">
          <div className="bg-white/40 rounded-[1.75rem] p-6 lg:p-4 flex flex-col lg:flex-row items-center gap-4">
             <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                <div className="md:col-span-2 relative group">
                  <input 
                    className="w-full glass border-white/60 focus:border-indigo-500 rounded-2xl px-5 py-4 text-sm font-bold placeholder:text-slate-400 outline-none transition-all" 
                    placeholder="New Category Name"
                    value={name} 
                    onChange={(e)=>setName(e.target.value)} 
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-slate-300 pointer-events-none group-focus-within:opacity-0 transition-opacity">Name</div>
                </div>
                
                <div className="relative group">
                  <input 
                    className="w-full glass border-white/60 focus:border-indigo-500 rounded-2xl px-5 py-4 text-sm font-bold placeholder:text-slate-400 outline-none transition-all" 
                    placeholder="Sort Order"
                    type="number" 
                    value={sort} 
                    onChange={(e)=>setSort(e.target.value)} 
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-slate-300 pointer-events-none group-focus-within:opacity-0 transition-opacity">Order</div>
                </div>

                <label className="flex items-center gap-3 px-4 py-2 cursor-pointer select-none">
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={isActive} 
                      onChange={e=>setIsActive(e.target.checked)} 
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 shadow-sm"></div>
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Active Status</span>
                </label>
             </div>

             <button 
               onClick={createCat} 
               className="w-full lg:w-auto px-10 py-4 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-slate-200 hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0 transition-all"
             >
               + Create Category
             </button>
          </div>
        </section>

        {/* Categories List */}
        <section className="glass rounded-[2.5rem] border-white/40 shadow-2xl shadow-indigo-100/30 overflow-hidden">
          <div className="bg-slate-50/50 backdrop-blur-sm px-8 py-5 border-b border-white/40 flex items-center justify-between">
             <div className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Manage Existing Records</div>
             {items.length > 0 && (
               <div className="text-[10px] font-bold text-slate-400 bg-white shadow-sm border border-slate-100 rounded-full px-3 py-1">
                 {items.length} Total Categories
               </div>
             )}
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-4">
                <div className="h-1.5 w-24 glass rounded-full bg-indigo-500/10 overflow-hidden">
                  <div className="h-full bg-indigo-500 w-1/3 animate-[progress_1.5s_ease-in-out_infinite]" />
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Synchronizing...</div>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left">
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/40">ID</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/40">Display Name</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/40">Sort Order</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/40">Is Active</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/40 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/20">
                  {items.map(row => (
                    <tr key={row.id} className="group hover:bg-white/50 transition-colors duration-300">
                      <td className="px-8 py-6">
                        <span className="text-xs font-black text-slate-300">#{row.id}</span>
                      </td>
                      <td className="px-8 py-6">
                        <input 
                          className="bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 rounded-lg px-2 py-1 -ml-2 text-base font-black text-slate-900 w-full transition-all outline-none"
                          defaultValue={row.name}
                          onBlur={(e)=>update(row,{name:e.target.value})}
                        />
                      </td>
                      <td className="px-8 py-6 text-sm">
                        <input 
                          className="bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 rounded-lg px-2 py-1 -ml-2 text-sm font-black text-slate-600 w-24 transition-all outline-none"
                          type="number"
                          defaultValue={row.sort}
                          onBlur={(e)=>update(row,{sort:Number(e.target.value)||0})}
                        />
                      </td>
                      <td className="px-8 py-6">
                         <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              defaultChecked={row.is_active}
                              onChange={(e)=>update(row,{is_active:e.target.checked})}
                            />
                            <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 shadow-sm"></div>
                          </label>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button 
                          onClick={()=>remove(row)} 
                          className="p-2 rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50 transition-all active:scale-95"
                          title="Delete Category"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length===0 && (
                    <tr>
                      <td className="p-20 text-center" colSpan={5}>
                        <div className="text-sm font-bold text-slate-400 mb-1">No categories found in registry</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-300">Add your first category above to begin</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      <style jsx>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </main>
  );
}
