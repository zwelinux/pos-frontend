export function setSelectedTable(t) { localStorage.setItem("tableSel", JSON.stringify(t)); }
export function getSelectedTable() { try { return JSON.parse(localStorage.getItem("tableSel")||"null"); } catch { return null; } }
export function clearSelectedTable() { localStorage.removeItem("tableSel"); }
