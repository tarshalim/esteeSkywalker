import { delay, readJSON, writeJSON } from "./storage";
import { supabase, unwrap, fromRows } from "./supabase";

// One `{ id, data jsonb }` table (Supabase) or one localStorage array (mock),
// behind the same Promise API. photoStore, pinStore and blogStore's templates
// were each hand-rolling this same branch. `toRow` adds real columns (foreign
// keys, filter fields) next to `data` on Supabase writes.
export function createCollection({ table, storageKey, seed = null, toRow = null }) {
  const row = (item) => ({ id: item.id, data: item, ...toRow?.(item) });

  const readLocal = () => {
    if (seed && localStorage.getItem(storageKey) == null) writeJSON(storageKey, seed);
    return readJSON(storageKey, []);
  };

  return {
    async list() {
      if (supabase) return fromRows(unwrap(await supabase.from(table).select("data").order("created_at")));
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
        return unwrap(await supabase.from(table).update(row(item)).eq("id", item.id).select("data").single()).data;
      }
      writeJSON(storageKey, readLocal().map((existing) => (existing.id === item.id ? item : existing)));
      return delay(item);
    },

    async remove(id) {
      if (supabase) {
        unwrap(await supabase.from(table).delete().eq("id", id));
        return true;
      }
      writeJSON(storageKey, readLocal().filter((item) => item.id !== id));
      return delay(true);
    },
  };
}
