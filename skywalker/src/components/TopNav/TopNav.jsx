import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sun,
  Moon,
  UserRound,
  CircleHelp,
  BookOpen,
  Images,
  Plus,
  Search,
  X,
  Globe2,
  Signpost,
  MapPin,
  MapPinPlus,
  Flag,
  Image as ImageIcon,
  Luggage,
  Menu,
  LogOut,
  Settings,
} from "lucide-react";
import { useTheme } from "../../lib/theme";
import { GLOBE_HASH, GLOBE_PATH } from "../../lib/routes";
import { ROLE_LABELS, useAuth } from "../../lib/auth";
import { useTour } from "../../lib/tour";
import { useSearch } from "../../lib/search";
import Avatar from "../Avatar/Avatar";

// 44px hit areas on phones and any touch screen; mouse users keep the
// compact 36px bar. (Tailwind 4.0 has no `pointer-coarse:` variant yet.)
const TAP_SQUARE = "max-sm:h-11 max-sm:w-11 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11";
const TAP_PILL = "max-sm:h-11 max-sm:min-w-11 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:min-w-11";

// Icon-only until lg, where the text label fits too (`keepIcon` shows both).
// Same 36px height, 1px border and hover lift as the `.theme-toggle` buttons;
// only the fill tells primary / active / idle apart.
function NavPill({ to, icon: Icon, label, active, primary, tour, keepIcon, className = "" }) {
  const style = primary
    ? { background: "linear-gradient(135deg, var(--yellow-bright), var(--yellow))", color: "var(--blue-deep)", borderColor: "var(--border)" }
    : active
      ? { background: "var(--blue)", color: "#ffffff", borderColor: "var(--blue)" }
      : { background: "var(--bg-panel)", color: "var(--text)", borderColor: "var(--border)" };
  return (
    <Link
      to={to}
      data-tour={tour}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 ${className}`}
    >
      <motion.span
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.97 }}
        className={`inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full border text-sm transition-colors lg:px-4 ${TAP_PILL} ${
          primary ? "font-semibold" : "font-medium"
        }`}
        style={style}
      >
        <Icon size={17} strokeWidth={2.25} className={keepIcon ? undefined : "lg:hidden"} aria-hidden="true" />
        <span className="hidden lg:inline">{label}</span>
      </motion.span>
    </Link>
  );
}

const SEARCH_LABEL = "Search destinations, dates, moments";

const RESULT_ICON = {
  signpost: { icon: Signpost, color: "var(--yellow)" },
  photo: { icon: ImageIcon, color: "var(--blue)" },
  pin: { icon: MapPin, color: "#dc2626" },
  customPin: { icon: MapPin, color: "#dc2626" },
  blog: { icon: BookOpen, color: "var(--blue)" },
  country: { icon: Flag, color: "var(--text-muted)" },
  place: { icon: MapPinPlus, color: "#dc2626" },
  trip: { icon: Luggage, color: "var(--yellow)" },
};

const RESULT_KIND_LABEL = { blog: "Blog post", signpost: "Signpost", trip: "Trip", customPin: "Location" };
const NO_RESULTS = [];

/**
 * Live hits under the nav search, from the page's usePageSearch. Rows keep
 * focus in the input (mousedown is swallowed) so arrow keys keep working.
 */
function SearchResults({ id, results, pending, highlight, onHighlight, onSelect }) {
  return (
    <ul
      id={id}
      role="listbox"
      className="glass-panel absolute top-full right-0 left-0 mt-2 max-h-[min(60vh,420px)] overflow-y-auto rounded-2xl border p-1.5 shadow-xl"
      style={{ borderColor: "var(--border-strong)", background: "var(--bg-panel-strong)" }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {results.map((r, i) => {
        const { icon: Icon, color } = RESULT_ICON[r.kind] ?? RESULT_ICON.pin;
        const active = i === highlight;
        return (
          <li key={`${r.kind}-${r.id}`} role="presentation">
            {r.group && r.group !== results[i - 1]?.group && (
              <div
                className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide uppercase"
                style={{ color: "var(--text-muted)" }}
              >
                {r.group}
              </div>
            )}
            <div
              id={`${id}-${i}`}
              role="option"
              aria-selected={active}
              onMouseEnter={() => onHighlight(i)}
              onClick={() => onSelect(r)}
              className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors"
              style={{ background: active ? "color-mix(in srgb, var(--blue) 12%, transparent)" : undefined }}
            >
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
                aria-hidden="true"
              >
                <Icon size={16} strokeWidth={2.25} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                  {r.label}
                </span>
                <span className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                  {[RESULT_KIND_LABEL[r.kind], r.sublabel].filter(Boolean).join(" · ")}
                </span>
              </span>
            </div>
          </li>
        );
      })}
      {results.length === 0 && (
        <li className="px-3 py-2.5 text-sm" style={{ color: "var(--text-muted)" }}>
          {pending ? "Searching…" : "No matches"}
        </li>
      )}
    </ul>
  );
}

const MENU_ROW =
  "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors hover:bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] disabled:cursor-wait disabled:opacity-60";
const DANGER_ROW_STYLE = { color: "#dc2626" };

/**
 * Closes a dropdown on an outside press, on Escape (returning focus to the
 * trigger) and on route changes (browser back/forward while open).
 */
function useDismiss(open, setOpen, rootRef, triggerRef) {
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname, setOpen]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen, rootRef, triggerRef]);
}

/** Signs out via the auth context, tracking the in-flight call and any error. */
function useSignOut(onDone) {
  const { signOut } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const run = async () => {
    setPending(true);
    setError(null);
    const message = await signOut();
    setPending(false);
    if (message) setError(message);
    else onDone();
  };
  return { run, pending, error };
}

function SignOutRow({ signOut, role }) {
  return (
    <>
      <button
        type="button"
        role={role}
        onClick={signOut.run}
        disabled={signOut.pending}
        className={MENU_ROW}
        style={DANGER_ROW_STYLE}
      >
        <LogOut size={18} strokeWidth={2.25} aria-hidden="true" />
        {signOut.pending ? "Signing out…" : "Sign out"}
      </button>
      {signOut.error && (
        <p role="alert" className="px-3 pt-1 pb-1.5 text-xs" style={DANGER_ROW_STYLE}>
          Couldn&apos;t sign out: {signOut.error}
        </p>
      )}
    </>
  );
}

/**
 * sm and up, signed in: the avatar opens an account menu with the profile
 * summary, a link to account settings and Sign out. Follows the WAI-ARIA menu
 * button pattern: opening focuses the first item, arrows/Home/End move
 * between items, Escape returns to the avatar, Tab closes.
 */
function AccountMenu({ user, username, role, active }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();
  const navigate = useNavigate();
  useDismiss(open, setOpen, rootRef, triggerRef);
  const signOut = useSignOut(() => {
    setOpen(false);
    navigate("/account");
  });

  const items = () => [...(menuRef.current?.querySelectorAll('[role="menuitem"]') ?? [])];
  useEffect(() => {
    if (open) items()[0]?.focus();
  }, [open]);

  const onMenuKeyDown = (e) => {
    const list = items();
    const i = list.indexOf(document.activeElement);
    const focusAt = (n) => list[(n + list.length) % list.length]?.focus();
    if (e.key === "ArrowDown") focusAt(i + 1);
    else if (e.key === "ArrowUp") focusAt(i - 1);
    else if (e.key === "Home") focusAt(0);
    else if (e.key === "End") focusAt(list.length - 1);
    else if (e.key === "Tab") return setOpen(false);
    else return;
    e.preventDefault();
  };

  const displayName = user.user_metadata?.display_name || username || "Signed in";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`theme-toggle overflow-hidden p-0 ${TAP_SQUARE}`}
        aria-label={`Account menu (${username ?? "signed in"})`}
        title="Account"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        style={active || open ? { boxShadow: "0 0 0 2px var(--blue)" } : undefined}
      >
        <Avatar user={user} className="h-full! w-full!" />
      </button>

      {open && (
        <div
          className="glass-panel absolute top-full right-0 mt-2 w-64 rounded-2xl border p-1.5 shadow-xl"
          style={{ borderColor: "var(--border-strong)", background: "var(--bg-panel-strong)" }}
        >
          <div className="flex items-center gap-3 px-3 pt-2 pb-2.5">
            <Avatar user={user} size={40} className="shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" style={{ color: "var(--text)" }}>
                {displayName}
              </p>
              {username && (
                <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                  @{username}
                </p>
              )}
              {role && (
                <p className="mt-0.5 text-[11px] font-semibold tracking-wide uppercase" style={{ color: "var(--blue)" }}>
                  {ROLE_LABELS[role]}
                </p>
              )}
            </div>
          </div>
          <div className="mx-3 mb-1 h-px" style={{ background: "var(--border)" }} aria-hidden="true" />
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="Account"
            onKeyDown={onMenuKeyDown}
            className="flex flex-col gap-0.5"
          >
            <Link
              to="/account"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={MENU_ROW}
              style={{ color: "var(--text)" }}
            >
              <Settings size={18} strokeWidth={2.25} aria-hidden="true" />
              Account settings
            </Link>
            <SignOutRow signOut={signOut} role="menuitem" />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Phones only: the avatar opens a dropdown holding what no longer fits in
 * the bar (My Blogs, My Gallery, tour, theme) plus the Account link. Pinned
 * `right-0` under the trigger, which sits at the bar's right edge, so the
 * panel always opens inside the viewport.
 */
function MobileMenu({ user, accountLabel, theme, onToggleTheme, onStartTour, isActive }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelId = useId();
  const navigate = useNavigate();
  useDismiss(open, setOpen, rootRef, triggerRef);

  const close = () => setOpen(false);
  const signOut = useSignOut(() => {
    close();
    navigate("/account");
  });
  const rowStyle = (active) =>
    active
      ? { background: "var(--blue)", color: "#ffffff" }
      : { color: "var(--text)" };

  return (
    <div ref={rootRef} className="relative shrink-0 sm:hidden">
      <button
        ref={triggerRef}
        type="button"
        data-tour="nav-menu"
        onClick={() => setOpen((o) => !o)}
        className={`theme-toggle relative ${TAP_SQUARE} ${user ? "p-0" : ""}`}
        aria-label="Open menu"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        style={
          isActive("/account") || open
            ? user
              ? { boxShadow: "0 0 0 2px var(--blue)" }
              : { background: "var(--blue)", color: "#ffffff" }
            : undefined
        }
      >
        {user ? (
          <Avatar user={user} className="h-full! w-full!" />
        ) : (
          <UserRound size={18} strokeWidth={2.25} />
        )}
        {/* Says "there's more in here" without spending width on a label. */}
        <span
          className="absolute -right-0.5 -bottom-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border"
          style={{ background: "var(--bg-elevated)", borderColor: "var(--border-strong)", color: "var(--text)" }}
          aria-hidden="true"
        >
          <Menu size={10} strokeWidth={3} />
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          className="glass-panel absolute top-full right-0 mt-2 w-60 max-w-[calc(100vw-1rem)] rounded-2xl border p-1.5 shadow-xl"
          style={{ borderColor: "var(--border-strong)", background: "var(--bg-panel-strong)" }}
        >
          <nav aria-label="More" className="flex flex-col gap-0.5">
            <Link to="/blogs" onClick={close} className={MENU_ROW} style={rowStyle(isActive("/blogs"))}
              aria-current={isActive("/blogs") ? "page" : undefined}>
              <BookOpen size={18} strokeWidth={2.25} aria-hidden="true" />
              My Blogs
            </Link>
            <Link to="/gallery" onClick={close} className={MENU_ROW} style={rowStyle(isActive("/gallery"))}
              aria-current={isActive("/gallery") ? "page" : undefined}>
              <Images size={18} strokeWidth={2.25} aria-hidden="true" />
              My Gallery
            </Link>
            <Link to="/account" onClick={close} className={MENU_ROW} style={rowStyle(isActive("/account"))}
              aria-current={isActive("/account") ? "page" : undefined}>
              <UserRound size={18} strokeWidth={2.25} aria-hidden="true" />
              <span className="min-w-0 truncate">{accountLabel}</span>
            </Link>
            <div className="mx-3 my-1 h-px" style={{ background: "var(--border)" }} aria-hidden="true" />
            <button
              type="button"
              onClick={() => {
                close();
                onStartTour();
              }}
              className={MENU_ROW}
              style={rowStyle(false)}
            >
              <CircleHelp size={18} strokeWidth={2.25} aria-hidden="true" />
              Take the tour
            </button>
            {/* Stays open so the switch is visible. */}
            <button type="button" onClick={onToggleTheme} className={MENU_ROW} style={rowStyle(false)}>
              {theme === "dark" ? (
                <Sun size={18} strokeWidth={2.25} aria-hidden="true" />
              ) : (
                <Moon size={18} strokeWidth={2.25} aria-hidden="true" />
              )}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            {user && (
              <>
                <div className="mx-3 my-1 h-px" style={{ background: "var(--border)" }} aria-hidden="true" />
                <SignOutRow signOut={signOut} />
              </>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}

export default function TopNav() {
  // The query lives in context so the page on screen can filter by it live;
  // the page also supplies the placeholder and dropdown results (usePageSearch).
  const { query, setQuery, page } = useSearch();
  const [searchActive, setSearchActive] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const listId = useId();
  // Phones: the search field is a button that expands over the whole bar.
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const inputRef = useRef(null);
  const headerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, username, role, canEdit } = useAuth();
  const { start: startTour } = useTour();
  const accountLabel = user ? `Account (${username ?? "signed in"})` : "Sign in";

  // Publishes the nav's bottom edge as --nav-bottom, the top safe area every
  // page offsets by. A height-only measure missed the `top-2`/`sm:top-4`
  // inset, so content sat 8-16px under the bar; offsetTop also ignores the
  // entrance slide's transform. The inset changes at `sm` without a height
  // change, hence the resize listener alongside the ResizeObserver.
  useLayoutEffect(() => {
    const el = headerRef.current;
    const root = document.documentElement;
    const publish = () => root.style.setProperty("--nav-bottom", `${el.offsetTop + el.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    window.addEventListener("resize", publish);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", publish);
      // Unmounted on editor routes: no bar left to clear.
      root.style.setProperty("--nav-bottom", "0px");
    };
  }, []);

  const results = page?.results ?? NO_RESULTS;
  const showDropdown = Boolean(page) && searchActive && query.trim().length > 0;
  const placeholder = page?.placeholder ?? "Search destinations, dates, moments…";

  // A fresh result list starts from the top hit.
  useEffect(() => setHighlight(0), [results]);

  const selectResult = (result) => {
    page.onSelect(result);
    setSearchActive(false);
    setMobileSearchOpen(false);
    inputRef.current?.blur();
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (page) {
      // Pages filter as you type; Enter picks the highlighted hit.
      if (results[highlight]) selectResult(results[highlight]);
      else inputRef.current?.blur();
      return;
    }
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    setMobileSearchOpen(false);
    navigate(`/gallery?${params.toString()}`);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Escape") {
      if (showDropdown) setSearchActive(false);
      else setMobileSearchOpen(false);
    } else if (showDropdown && results.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setHighlight((h) => (h + step + results.length) % results.length);
    }
  };

  // Render the field synchronously, then focus inside the same tap so iOS
  // actually raises the keyboard.
  const openMobileSearch = () => {
    flushSync(() => setMobileSearchOpen(true));
    inputRef.current?.focus();
  };

  const isActive = (path) => location.pathname.startsWith(path);
  // The dedicated page, or the homepage scrolled down to its globe section
  // (Landing keeps the #globe hash in sync with the scroll position).
  const globeActive =
    location.pathname === GLOBE_PATH || (location.pathname === "/" && location.hash === GLOBE_HASH);

  return (
    <motion.header
      id="top-nav"
      ref={headerRef}
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-2 left-1/2 z-(--z-nav) w-[min(1100px,calc(100vw-1rem))] -translate-x-1/2 sm:top-4 sm:w-[min(1100px,94vw)]"
    >
      <div
        className="glass-panel relative flex min-w-0 items-center gap-1.5 rounded-2xl px-3 py-1.5 md:gap-3 md:px-4 md:py-2"
        style={{ borderColor: "var(--border-strong)" }}
      >
        <Link
          to="/"
          className="hidden shrink-0 whitespace-nowrap text-sm transition-colors lg:inline"
          style={{ color: "var(--text-muted)" }}
        >
          ← Home
        </Link>

        <Link
          to="/"
          aria-label="Skywalker home"
          className="mr-auto min-w-0 truncate px-1 text-xs font-semibold tracking-[0.12em] uppercase sm:mr-0 sm:text-sm md:px-0 md:tracking-[0.2em]"
          style={{ color: "var(--blue)" }}
        >
          {/* Under 360px the full wordmark can't fit beside the buttons. */}
          <span className="max-[359px]:hidden">Skywalker</span>
          <span className="text-base font-bold tracking-normal min-[360px]:hidden" aria-hidden="true">S</span>
        </Link>

        <form
          onSubmit={handleSearchSubmit}
          role="search"
          data-tour="nav-search"
          className={`group min-w-0 flex-1 items-center rounded-full border-2 transition-all duration-300 ease-out sm:relative sm:inset-auto sm:z-auto sm:flex md:ml-2 ${
            mobileSearchOpen ? "absolute inset-1 z-10 flex" : "hidden"
          }`}
          style={{
            borderColor: searchActive ? "var(--border-strong)" : "var(--border)",
            background: searchActive || mobileSearchOpen ? "var(--bg-elevated)" : "var(--bg-panel)",
            boxShadow: searchActive ? "0 0 0 3px color-mix(in srgb, var(--yellow) 35%, transparent)" : "none",
          }}
          onKeyDown={handleSearchKeyDown}
        >
          <svg
            viewBox="0 0 24 24"
            className="ml-3.5 h-4 w-4 shrink-0 transition-colors"
            style={{ color: "var(--text-muted)" }}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchActive(true);
            }}
            onFocus={() => setSearchActive(true)}
            onBlur={() => setSearchActive(false)}
            placeholder={placeholder}
            aria-label={page?.placeholder.replace(/…$/, "") ?? SEARCH_LABEL}
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showDropdown && results[highlight] ? `${listId}-${highlight}` : undefined}
            className="w-full min-w-0 bg-transparent px-3 py-1.5 text-sm outline-none md:py-2"
            style={{ color: "var(--text)" }}
          />
          {query && (
            <button
              type="button"
              // Keep focus in the field so the results stay open.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setQuery("")}
              className="touch-hit mr-1 hidden h-7 w-7 shrink-0 items-center justify-center rounded-full sm:inline-flex"
              style={{ color: "var(--text-muted)" }}
              aria-label="Clear search"
            >
              <X size={15} strokeWidth={2.25} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setMobileSearchOpen(false)}
            className="mr-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:hidden"
            style={{ color: "var(--text-muted)" }}
            aria-label="Close search"
          >
            <X size={17} strokeWidth={2.25} />
          </button>

          {showDropdown && (
            <SearchResults
              id={listId}
              results={results}
              pending={page.pending}
              highlight={highlight}
              onHighlight={setHighlight}
              onSelect={selectResult}
            />
          )}
        </form>

        <button
          type="button"
          onClick={openMobileSearch}
          data-tour="nav-search-button"
          className={`theme-toggle sm:hidden ${TAP_SQUARE}`}
          aria-label={SEARCH_LABEL}
          title="Search"
        >
          <Search size={17} strokeWidth={2.25} />
        </button>

        <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <NavPill to={GLOBE_PATH} icon={Globe2} label="Globe" active={globeActive} keepIcon />
          {/* Phones: these two live in the avatar menu (MobileMenu). */}
          <NavPill to="/blogs" icon={BookOpen} label="My Blogs" active={isActive("/blogs")} className="max-sm:hidden" />
          <NavPill
            to="/gallery"
            icon={Images}
            label="My Gallery"
            active={isActive("/gallery")}
            tour="gallery"
            className="max-sm:hidden"
          />
          {/* Signed-in read-only accounts would just be bounced to /account. */}
          {(!user || canEdit) && <NavPill to="/blogs/new" icon={Plus} label="Create Blog" primary tour="create-blog" />}
        </nav>

        <MobileMenu
          user={user}
          accountLabel={accountLabel}
          theme={theme}
          onToggleTheme={toggleTheme}
          onStartTour={startTour}
          isActive={isActive}
        />

        <div className="flex shrink-0 items-center gap-2 max-sm:hidden">
          <button
            type="button"
            onClick={startTour}
            className={`theme-toggle ${TAP_SQUARE}`}
            aria-label="Take the tour"
            title="Take the tour"
          >
            <CircleHelp size={17} strokeWidth={2.25} />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className={`theme-toggle ${TAP_SQUARE}`}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Moon size={17} strokeWidth={2.25} /> : <Sun size={17} strokeWidth={2.25} />}
          </button>

          {user ? (
            <AccountMenu user={user} username={username} role={role} active={isActive("/account")} />
          ) : (
            <Link
              to="/account"
              className={`theme-toggle ${TAP_SQUARE}`}
              aria-label={accountLabel}
              title={accountLabel}
              style={isActive("/account") ? { background: "var(--blue)", color: "#ffffff" } : undefined}
            >
              <UserRound size={17} strokeWidth={2.25} />
            </Link>
          )}
        </div>
      </div>
    </motion.header>
  );
}
