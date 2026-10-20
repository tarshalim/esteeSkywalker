import { delay, readJSON, writeJSON } from "./storage";
import { supabase, unwrap, fromRows } from "./supabase";

// One `{ id, data jsonb }` table (Supabase) or one localStorage array (mock),
// behind the same Promise API. photoStore, pinStore and blogStore's templates
// were each hand-rolling this same branch.
export function createCollection({ table, storageKey, seed = null }) {
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
        unwrap(await supabase.from(table).insert({ id: item.id, data: item }));
        return item;
      }
      writeJSON(storageKey, [...readLocal(), item]);
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
