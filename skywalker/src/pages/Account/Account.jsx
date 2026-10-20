import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
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

    const { data, error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/account" } });

    setBusy(false);
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
  const [displayName, setDisplayName] = useState(user.user_metadata?.display_name ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  const handleSave = async (e) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ data: { display_name: displayName.trim() } });
    setBusy(false);
    setStatus(error ? { error: error.message } : { notice: "Saved." });
  };

  return (
    <>
      <h1>Hi, {user.user_metadata?.display_name || user.email}</h1>
      <p className="account-muted">Signed in as {user.email}</p>

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

      <button type="button" className="account-link" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </>
  );
}
