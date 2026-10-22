import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../../lib/supabase";
import { ROLE_LABELS, USERNAME_PATTERN, loginEmail, useAuth } from "../../lib/auth";
import { AVATARS, avatarFor } from "../../lib/avatars";
import Avatar from "../../components/Avatar/Avatar";
import AvatarPicker from "../../components/Avatar/AvatarPicker";
import GlobePreview from "../../components/GlobePreview/GlobePreview";
import { useGlobePrefs } from "../../lib/globePrefs";
import { useTheme } from "../../lib/theme";
import Select from "../../components/Select/Select";
import "./Account.css";

const GLOBE_TOGGLES = [
  { key: "showBorders", label: "Country borders", hint: "Outline every country" },
  { key: "showGrid", label: "Grid lines", hint: "Latitude and longitude every 15°" },
  { key: "showAtmosphere", label: "Atmosphere glow", hint: "Soft halo around the Earth" },
  { key: "autoRotate", label: "Auto-rotate", hint: "Slowly spin the globe when idle" },
];

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
        <GlobeSettings />
      </motion.div>
    </div>
  );
}

function SignInForm() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [username, setUsername] = useState("");
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

    const email = loginEmail(username);
    let result;
    try {
      result =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password, options: { data: { username: username.trim().toLowerCase() } } });
    } catch (err) {
      // Network failures throw instead of returning { error } — without this
      // the button stayed on "…" forever.
      result = { error: err };
    } finally {
      setBusy(false);
    }

    const { data, error } = result;
    if (error) {
      if (/already registered/i.test(error.message)) return setError("That username is taken.");
      if (/invalid login credentials/i.test(error.message)) return setError("Wrong username or password.");
      return setError(error.message);
    }
    // No session means "Confirm email" is still on in Supabase — the synthetic
    // address can't receive the link. Delete the dead account so the username
    // isn't left taken.
    if (!data.session) {
      try {
        await supabase.rpc("purge_unconfirmed_signup", { target_email: email });
      } catch {
        // Best effort — the error below is what matters to the user.
      }
      return setError("Sign-up needs email confirmation turned off in Supabase.");
    }
    navigate(location.state?.from ?? "/", { replace: true });
  };

  const isSignIn = mode === "signin";

  return (
    <>
      <h1>{isSignIn ? "Welcome back" : "Create your account"}</h1>
      <p className="account-muted">
        {isSignIn
          ? "Sign in to write posts, upload photos and drop pins."
          : "Pick a username. A super admin will approve your account."}
      </p>

      <form className="account-form" onSubmit={handleSubmit}>
        <label>
          Username
          <input
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            // Sign-in also accepts an email, for accounts made before usernames.
            pattern={isSignIn ? undefined : USERNAME_PATTERN}
            title="3–24 letters, numbers or underscores"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
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
  const { username, role, isAdmin, isPending, isSuperAdmin } = useAuth();
  const [displayName, setDisplayName] = useState(user.user_metadata?.display_name ?? "");
  // Preselect whatever the user currently sees (their saved pick or the fallback).
  const [avatar, setAvatar] = useState(() => avatarFor(user).id);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  const handleSave = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      // Stored in auth user_metadata alongside display_name; onAuthStateChange
      // (USER_UPDATED) pushes it to the nav avatar without a reload.
      const { error } = await supabase.auth.updateUser({ data: { display_name: displayName.trim(), avatar } });
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
      {/* Previews the picker's current choice before it's saved. */}
      <Avatar src={AVATARS.find((a) => a.id === avatar)?.src} user={user} size={72} className="account-avatar" />
      <h1>Hi, {user.user_metadata?.display_name || username}</h1>
      <p className="account-muted">Signed in as {username}</p>
      <p className={`account-role account-role--${role}`}>{ROLE_LABELS[role]}</p>
      {isPending ? (
        <p className="account-muted">Your account is waiting for a super admin to approve it.</p>
      ) : (
        !isAdmin && (
          <p className="account-muted">Your account is read-only. Ask a super admin to make you an admin to edit.</p>
        )
      )}

      <form className="account-form" onSubmit={handleSave}>
        <label>
          Display name
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <fieldset className="account-avatar-field">
          <legend>Profile picture</legend>
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </fieldset>
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

// Globe display settings (moved off the globe so it stays uncluttered). Each
// change applies instantly via GlobePrefsProvider — no Save button.
function GlobeSettings() {
  const { prefs, setPref, syncsToAccount } = useGlobePrefs();
  const { theme, toggleTheme } = useTheme();

  return (
    <section className="account-settings" aria-labelledby="globe-settings-heading">
      <h2 id="globe-settings-heading">Globe display</h2>
      <GlobePreview />

      <div className="account-setting">
        <span className="account-setting-text">
          <span className="account-setting-label">Pin labels</span>
          <span className="account-setting-hint">Show place names on hover or all the time</span>
        </span>
        <Segmented
          label="Pin labels"
          value={prefs.labelMode}
          options={[
            ["hover", "Hover"],
            ["always", "Always"],
          ]}
          onChange={(v) => setPref("labelMode", v)}
        />
      </div>

      <div className="account-setting">
        <span className="account-setting-text">
          <span className="account-setting-label">Theme</span>
          <span className="account-setting-hint">Daylight sky or starfield (whole site)</span>
        </span>
        <Segmented
          label="Theme"
          value={theme}
          options={[
            ["light", "Light"],
            ["dark", "Dark"],
          ]}
          onChange={(v) => v !== theme && toggleTheme()}
        />
      </div>

      {GLOBE_TOGGLES.map(({ key, label, hint }) => (
        <div className="account-setting" key={key}>
          <span className="account-setting-text" id={`globe-pref-${key}`}>
            <span className="account-setting-label">{label}</span>
            <span className="account-setting-hint">{hint}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs[key]}
            aria-labelledby={`globe-pref-${key}`}
            className="account-switch touch-hit"
            onClick={() => setPref(key, !prefs[key])}
          >
            <span className="account-switch-thumb" />
          </button>
        </div>
      ))}

      <p className="account-muted account-settings-note">
        {syncsToAccount ? "Saved to your account automatically." : "Saved in this browser."}
      </p>
    </section>
  );
}

function Segmented({ label, value, options, onChange }) {
  return (
    <div className="account-segmented" role="radiogroup" aria-label={label}>
      {options.map(([optionValue, optionLabel]) => (
        <button
          key={optionValue}
          type="button"
          role="radio"
          aria-checked={value === optionValue}
          className={value === optionValue ? "is-active" : ""}
          onClick={() => onChange(optionValue)}
        >
          {optionLabel}
        </button>
      ))}
    </div>
  );
}

// Super-admin only: approve or reject sign-ups and change roles. The database
// enforces this too (profiles RLS + set_user_role/reject_account), so this is
// just the UI.
function AccountsPanel({ currentUserId }) {
  const [accounts, setAccounts] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, username, role")
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

  const reject = async (account) => {
    if (!window.confirm(`Reject and delete "${account.username}"?`)) return;
    setSavingId(account.id);
    setError(null);
    const { error } = await supabase.rpc("reject_account", { target: account.id });
    setSavingId(null);
    if (error) return setError(error.message);
    setAccounts((prev) => prev.filter((a) => a.id !== account.id));
  };

  const pending = accounts?.filter((a) => a.role === "pending") ?? [];
  const approved = accounts?.filter((a) => a.role !== "pending") ?? [];

  return (
    <section className="account-admin">
      {error && <p className="account-error">{error}</p>}
      {!accounts ? (
        !error && <p className="account-muted">Loading…</p>
      ) : (
        <>
          <h2>Waiting for approval</h2>
          {pending.length === 0 ? (
            <p className="account-muted">No pending sign-ups.</p>
          ) : (
            <ul className="account-admin-list">
              {pending.map((a) => (
                <li key={a.id}>
                  <span className="account-admin-email">{a.username}</span>
                  <span className="account-admin-actions">
                    <button type="button" className="account-approve" disabled={savingId === a.id} onClick={() => changeRole(a.id, "user")}>
                      Approve
                    </button>
                    <button type="button" className="account-reject" disabled={savingId === a.id} onClick={() => reject(a)}>
                      Reject
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h2 className="account-admin-subhead">Accounts</h2>
          <ul className="account-admin-list">
            {approved.map((a) => (
              <li key={a.id}>
                <span className="account-admin-email">{a.username}</span>
                {a.id === currentUserId ? (
                  <span className="account-admin-you">{ROLE_LABELS[a.role]} (you)</span>
                ) : (
                  <Select
                    aria-label={`Role for ${a.username}`}
                    value={a.role}
                    disabled={savingId === a.id}
                    onChange={(e) => changeRole(a.id, e.target.value)}
                  >
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
