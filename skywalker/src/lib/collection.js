import { delay, readJSON, writeJSON } from "./storage";
import { supabase, unwrap, fromRows } from "./supabase";

// One `{ id, data jsonb }` table (Supabase) or one localStorage array (mock),
// behind the same Promise API. photoStore, pinStore and blogStore (posts and
// templates) all sit on it. `toRow` adds real columns (foreign keys, filter
// fields) next to `data` on Supabase writes; `orderBy` is the column `list`
// sorts on; `label` names one item in error messages.
//
// RLS turns a forbidden update or delete into a silent no-op, so both check
// that a row really changed and throw a readable error when none did. Mock
// mode throws the same error for an id that isn't there.
export function createCollection({ table, storageKey, seed = null, toRow = null, orderBy = "created_at", label = "item" }) {
  const row = (item) => ({ id: item.id, data: item, ...toRow?.(item) });
  const gone = (verb) => new Error(`This ${label} may already be gone, or you don't have permission to ${verb} it.`);

  const readLocal = () => {
    if (seed && localStorage.getItem(storageKey) == null) writeJSON(storageKey, seed);
    return readJSON(storageKey, []);
  };

  return {
    async list() {
      if (supabase) return fromRows(unwrap(await supabase.from(table).select("data").order(orderBy)));
      return delay(readLocal());
    },

    async get(id) {
      if (supabase) {
        const row = unwrap(await supabase.from(table).select("data").eq("id", id).maybeSingle());
        return row?.data ?? null;
      }
      return delay(readLocal().find((item) => item.id === id) ?? null);
    },

    async insert(item) {
      if (supabase) {
        // Triggers may fill in derived fields (e.g. a gallery item's location), so read back.
        return unwrap(await supabase.from(table).insert(row(item)).select("data").single()).data;
      }
      writeJSON(storageKey, [...readLocal(), item]);
      return delay(item);
    },

    async update(item) {
      if (supabase) {
        const saved = unwrap(await supabase.from(table).update(row(item)).eq("id", item.id).select("data").maybeSingle());
        if (!saved) throw gone("change");
        return saved.data;
      }
      const items = readLocal();
      if (!items.some((existing) => existing.id === item.id)) throw gone("change");
      writeJSON(storageKey, items.map((existing) => (existing.id === item.id ? item : existing)));
      return delay(item);
    },

    /** @returns the removed item, so callers can clean up its files */
    async remove(id) {
      if (supabase) {
        const deleted = unwrap(await supabase.from(table).delete().eq("id", id).select("data"));
        if (deleted.length === 0) throw gone("delete");
        return deleted[0].data;
      }
      const items = readLocal();
      const removed = items.find((item) => item.id === id);
      if (!removed) throw gone("delete");
      writeJSON(storageKey, items.filter((item) => item.id !== id));
      return delay(removed);
    },
  };
}
