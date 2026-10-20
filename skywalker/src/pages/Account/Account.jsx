import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../../lib/supabase";
import { ROLE_LABELS, useAuth } from "../../lib/auth";
import "./Account.css";

export default function Account() {
  const { user, loading, enabled } = useAuth();

  if (loading) return <div className="account-page" />;

  return (
    <div className="account-page">
      <motion.div
        className="account-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <p className="account-kicker">Account</p>
        {!enabled ? (
          <>
            <h1>Accounts are offline</h1>
            <p className="account-muted">
              Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env</code> to enable
              sign-in. Until then everything is saved in this browser only.
            </p>
          </>
        ) : user ? (
          <Profile user={user} />
        ) : (
          <SignInForm />
        )}
      </motion.div>
    </div>
  );
}

function SignInForm() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    let result;
    try {
      result =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/account" } });
    } catch (err) {
      // Network failures throw instead of returning { error } — without this
      // the button stayed on "…" forever.
      result = { error: err };
    } finally {
      setBusy(false);
    }

    const { data, error } = result;
    if (error) return setError(error.message);
    if (!data.session) return setNotice("Check your inbox to confirm your email, then sign in.");
    navigate(location.state?.from ?? "/", { replace: true });
  };

  const isSignIn = mode === "signin";

  return (
    <>
      <h1>{isSignIn ? "Welcome back" : "Create your account"}</h1>
      <p className="account-muted">
        {isSignIn ? "Sign in to write posts, upload photos and drop pins." : "Start logging your journeys."}
      </p>

      <form className="account-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={isSignIn ? "current-password" : "new-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="account-error">{error}</p>}
        {notice && <p className="account-notice">{notice}</p>}

        <button type="submit" className="account-primary" disabled={busy}>
          {busy ? "…" : isSignIn ? "Sign in" : "Sign up"}
        </button>
      </form>

      <button
        type="button"
        className="account-link"
        onClick={() => {
          setMode(isSignIn ? "signup" : "signin");
          setError(null);
          setNotice(null);
        }}
      >
        {isSignIn ? "No account yet? Sign up" : "Already have an account? Sign in"}
      </button>
    </>
  );
}

function Profile({ user }) {
  const { role, isAdmin, isSuperAdmin } = useAuth();
  const [displayName, setDisplayName] = useState(user.user_metadata?.display_name ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  const handleSave = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { display_name: displayName.trim() } });
      setStatus(error ? { error: error.message } : { notice: "Saved." });
    } catch (err) {
      setStatus({ error: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) setStatus({ error: error.message });
  };

  return (
    <>
      <h1>Hi, {user.user_metadata?.display_name || user.email}</h1>
      <p className="account-muted">Signed in as {user.email}</p>
      <p className={`account-role account-role--${role}`}>{ROLE_LABELS[role]}</p>
      {!isAdmin && (
        <p className="account-muted">Your account is read-only. Ask a super admin to make you an admin to edit.</p>
      )}

      <form className="account-form" onSubmit={handleSave}>
        <label>
          Display name
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        {status?.error && <p className="account-error">{status.error}</p>}
        {status?.notice && <p className="account-notice">{status.notice}</p>}
        <button type="submit" className="account-primary" disabled={busy}>
          {busy ? "…" : "Save"}
        </button>
      </form>

      {isSuperAdmin && <AccountsPanel currentUserId={user.id} />}

      <button type="button" className="account-link" onClick={handleSignOut}>
        Sign out
      </button>
    </>
  );
}

// Super-admin only: list every account and change its role. The database
// enforces this too (profiles RLS + set_user_role), so this is just the UI.
function AccountsPanel({ currentUserId }) {
  const [accounts, setAccounts] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, email, role")
      .order("created_at")
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setAccounts(data);
      });
  }, []);

  const changeRole = async (id, role) => {
    setSavingId(id);
    setError(null);
    const { error } = await supabase.rpc("set_user_role", { target: id, new_role: role });
    setSavingId(null);
    if (error) return setError(error.message);
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, role } : a)));
  };

  return (
    <section className="account-admin">
      <h2>Accounts</h2>
      {error && <p className="account-error">{error}</p>}
      {!accounts ? (
        !error && <p className="account-muted">Loading…</p>
      ) : (
        <ul className="account-admin-list">
          {accounts.map((a) => (
            <li key={a.id}>
              <span className="account-admin-email">{a.email}</span>
              {a.id === currentUserId ? (
                <span className="account-admin-you">{ROLE_LABELS[a.role]} (you)</span>
              ) : (
                <select value={a.role} disabled={savingId === a.id} onChange={(e) => changeRole(a.id, e.target.value)}>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
