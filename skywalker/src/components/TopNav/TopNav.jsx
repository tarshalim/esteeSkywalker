import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Sun, Moon, UserRound, CircleHelp, BookOpen, Images, Plus, Search, X, Globe2 } from "lucide-react";
import { useTheme } from "../../lib/theme";
import { GLOBE_HASH, GLOBE_PATH } from "../../utils/routes";
import { useAuth } from "../../lib/auth";
import { useTour } from "../../lib/tour";
import Avatar from "../Avatar/Avatar";

// Icon-only until lg, where the text label fits too (`keepIcon` shows both).
function NavPill({ to, icon: Icon, label, active, primary, tour, keepIcon }) {
  const style = primary
    ? { background: "linear-gradient(135deg, var(--yellow-bright), var(--yellow))", color: "var(--blue-deep)" }
    : active
      ? { background: "var(--blue)", color: "#ffffff" }
      : { background: "var(--bg-panel)", color: "var(--text)" };
  return (
    <Link
      to={to}
      data-tour={tour}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className="shrink-0"
    >
      <motion.span
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.97 }}
        className={`inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full text-sm lg:px-4 ${
          primary ? "font-semibold shadow-[0_3px_0_var(--blue-deep)] transition-shadow" : "font-medium transition-colors"
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

export default function TopNav() {
  const [query, setQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  // Phones: the search field is a button that expands over the whole bar.
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const inputRef = useRef(null);
  const headerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, username, canEdit } = useAuth();
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

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    setMobileSearchOpen(false);
    navigate(`/gallery?${params.toString()}`);
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
        className="glass-panel relative flex items-center gap-1 rounded-2xl border-2 px-2 py-1.5 sm:gap-2 md:gap-3 md:px-4 md:py-2"
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
          Skywalker
        </Link>

        <form
          onSubmit={handleSearchSubmit}
          role="search"
          className={`group min-w-0 flex-1 items-center rounded-full border-2 transition-all duration-300 ease-out sm:static sm:z-auto sm:flex md:ml-2 ${
            mobileSearchOpen ? "absolute inset-1 z-10 flex" : "hidden"
          }`}
          style={{
            borderColor: searchActive ? "var(--border-strong)" : "var(--border)",
            background: searchActive || mobileSearchOpen ? "var(--bg-elevated)" : "var(--bg-panel)",
            boxShadow: searchActive ? "0 0 0 3px color-mix(in srgb, var(--yellow) 35%, transparent)" : "none",
          }}
          onKeyDown={(e) => e.key === "Escape" && setMobileSearchOpen(false)}
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
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchActive(true)}
            onBlur={() => setSearchActive(false)}
            placeholder="Search destinations, dates, moments…"
            aria-label={SEARCH_LABEL}
            className="w-full min-w-0 bg-transparent px-3 py-1.5 text-sm outline-none md:py-2"
            style={{ color: "var(--text)" }}
          />
          <button
            type="button"
            onClick={() => setMobileSearchOpen(false)}
            className="mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:hidden"
            style={{ color: "var(--text-muted)" }}
            aria-label="Close search"
          >
            <X size={17} strokeWidth={2.25} />
          </button>
        </form>

        <button
          type="button"
          onClick={openMobileSearch}
          className="theme-toggle sm:hidden"
          aria-label={SEARCH_LABEL}
          title="Search"
        >
          <Search size={17} strokeWidth={2.25} />
        </button>

        <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
          <NavPill to={GLOBE_PATH} icon={Globe2} label="Globe" active={globeActive} keepIcon />
          <NavPill to="/blogs" icon={BookOpen} label="My Blogs" active={isActive("/blogs")} />
          <NavPill to="/gallery" icon={Images} label="My Gallery" active={isActive("/gallery")} tour="gallery" />
          {/* Signed-in read-only accounts would just be bounced to /account. */}
          {(!user || canEdit) && <NavPill to="/blogs/new" icon={Plus} label="Create Blog" primary tour="create-blog" />}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {/* Dropped on the very narrowest phones so the row still fits;
              first-time visitors still get the tour banner. */}
          <button
            type="button"
            onClick={startTour}
            className="theme-toggle max-[399px]:hidden"
            aria-label="Take the tour"
            title="Take the tour"
          >
            <CircleHelp size={17} strokeWidth={2.25} />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Moon size={17} strokeWidth={2.25} /> : <Sun size={17} strokeWidth={2.25} />}
          </button>

          <Link
            to="/account"
            className={`theme-toggle${user ? " overflow-hidden p-0" : ""}`}
            aria-label={accountLabel}
            title={accountLabel}
            style={
              isActive("/account")
                ? user
                  ? { boxShadow: "0 0 0 2px var(--blue)" }
                  : { background: "var(--blue)", color: "#ffffff" }
                : undefined
            }
          >
            {user ? (
              <Avatar user={user} size={34} />
            ) : (
              <UserRound size={17} strokeWidth={2.25} />
            )}
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
