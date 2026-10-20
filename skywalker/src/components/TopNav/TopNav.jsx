import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Sun, Moon, UserRound } from "lucide-react";
import { useTheme } from "../../lib/theme";
import { useAuth } from "../../lib/auth";

export default function TopNav() {
  const [query, setQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, canEdit } = useAuth();
  const accountLabel = user ? `Account (${user.email})` : "Sign in";

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    navigate(`/gallery?${params.toString()}`);
  };

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <motion.header
      id="top-nav"
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-4 left-1/2 z-50 w-[min(1100px,94vw)] -translate-x-1/2"
    >
      <div className="glass-panel flex items-center gap-3 rounded-2xl border-2 px-4 py-2.5"
        style={{ borderColor: "var(--border-strong)" }}
      >
        <Link
          to="/"
          className="shrink-0 whitespace-nowrap text-sm transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          ← Home
        </Link>

        <Link
          to="/"
          className="whitespace-nowrap text-sm font-semibold tracking-[0.2em] uppercase"
          style={{ color: "var(--text-strong)" }}
        >
          Estee<span style={{ color: "var(--blue)" }}>Skywalker</span>
        </Link>

        <form
          onSubmit={handleSearchSubmit}
          className="group ml-2 flex flex-1 items-center rounded-full border-2 transition-all duration-300 ease-out"
          style={{
            borderColor: searchActive ? "var(--border-strong)" : "var(--border)",
            background: searchActive ? "var(--bg-elevated)" : "var(--bg-panel)",
            boxShadow: searchActive ? "0 0 0 3px color-mix(in srgb, var(--yellow) 35%, transparent)" : "none",
          }}
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
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchActive(true)}
            onBlur={() => setSearchActive(false)}
            placeholder="Search destinations, dates, moments…"
            className="w-full bg-transparent px-3 py-2 text-sm outline-none"
            style={{ color: "var(--text)" }}
          />
        </form>

        <nav className="flex shrink-0 items-center gap-2">
          <Link to="/blogs">
            <motion.span
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              className="inline-block rounded-full px-4 py-2 text-sm font-medium transition-colors"
              style={
                isActive("/blogs")
                  ? { background: "var(--blue)", color: "#ffffff" }
                  : { background: "var(--bg-panel)", color: "var(--text)" }
              }
            >
              My Blogs
            </motion.span>
          </Link>
          <Link to="/gallery">
            <motion.span
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              className="inline-block rounded-full px-4 py-2 text-sm font-medium transition-colors"
              style={
                isActive("/gallery")
                  ? { background: "var(--blue)", color: "#ffffff" }
                  : { background: "var(--bg-panel)", color: "var(--text)" }
              }
            >
              My Gallery
            </motion.span>
          </Link>
          {/* Signed-in read-only accounts would just be bounced to /account. */}
          {(!user || canEdit) && (
          <Link to="/blogs/new">
            <motion.span
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              className="inline-block rounded-full px-4 py-2 text-sm font-semibold shadow-[0_4px_0_var(--blue-deep)] transition-shadow"
              style={{ background: "linear-gradient(135deg, var(--yellow-bright), var(--yellow))", color: "var(--blue-deep)" }}
            >
              + Create Blog
            </motion.span>
          </Link>
          )}

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
            className="theme-toggle"
            aria-label={accountLabel}
            title={accountLabel}
            style={isActive("/account") ? { background: "var(--blue)", color: "#ffffff" } : undefined}
          >
            {user ? (
              <span className="text-sm font-bold">{(user.user_metadata?.display_name || user.email || "?")[0].toUpperCase()}</span>
            ) : (
              <UserRound size={17} strokeWidth={2.25} />
            )}
          </Link>
        </nav>
      </div>
    </motion.header>
  );
}
