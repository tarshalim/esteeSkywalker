import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Bridges TopNav's search field and whichever page is on screen. The nav owns
 * the input; the page owns what a query means. A page opts in with
 * `usePageSearch`, handing over its placeholder, live dropdown results and
 * what picking one does. Pages without a handler keep the old behaviour:
 * submitting jumps to /gallery?q=.
 *
 * @typedef {{
 *   id: string,
 *   kind: "signpost"|"photo"|"pin"|"customPin"|"trip"|"blog"|"country"|"place",
 *   label: string,
 *   sublabel?: string,
 *   group?: string,
 * }} SearchResult
 *
 * @typedef {{
 *   placeholder: string,
 *   results: SearchResult[],
 *   pending?: boolean,
 *   onSelect: function(SearchResult): void,
 * }} PageSearch
 */

const SearchContext = createContext(null);

const queryFromUrl = (search) => {
  const params = new URLSearchParams(search);
  return params.get("q") || params.get("location") || "";
};

export function SearchProvider({ children }) {
  const { pathname, search } = useLocation();
  // Tagged with the page it was typed on, so navigating elsewhere starts
  // fresh (or from that page's ?q=) without a reset effect racing the page.
  const [typed, setTyped] = useState({ path: null, query: "" });
  const [page, setPage] = useState(null);

  const query = typed.path === pathname ? typed.query : queryFromUrl(search);
  const setQuery = useCallback((q) => setTyped({ path: pathname, query: q }), [pathname]);

  const value = useMemo(() => ({ query, setQuery, page, setPage }), [query, setQuery, page]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearch must be used inside <SearchProvider>");
  return ctx;
}

/**
 * Registers the current page as the nav search's target while `enabled`.
 * Returns the live query for the page to filter by.
 * @param {PageSearch & { enabled?: boolean }} config
 */
// eslint-disable-next-line react-refresh/only-export-components
export function usePageSearch({ enabled = true, placeholder, results, pending = false, onSelect }) {
  const { query, setQuery, setPage } = useSearch();

  useEffect(() => {
    if (!enabled) return;
    const config = { placeholder, results, pending, onSelect };
    setPage(config);
    return () => setPage((current) => (current === config ? null : current));
  }, [enabled, placeholder, results, pending, onSelect, setPage]);

  return { query: enabled ? query : "", setQuery };
}
