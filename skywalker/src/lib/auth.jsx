import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "./supabase";

const AuthContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const ROLE_LABELS = { pending: "Pending", user: "User", admin: "Admin", super_admin: "Super admin" };

// Supabase Auth needs an email, so usernames map to a synthetic address that
// never receives mail ("Confirm email" must be off in the Supabase dashboard).
// Input containing "@" is used as-is so pre-username accounts can still sign in.
const USERNAME_EMAIL_DOMAIN = "users.skywalker.app";
export const USERNAME_PATTERN = "[A-Za-z0-9_]{3,24}";
// eslint-disable-next-line react-refresh/only-export-components
export function loginEmail(username) {
  const name = username.trim().toLowerCase();
  return name.includes("@") ? name : `${name}@${USERNAME_EMAIL_DOMAIN}`;
}

// Without Supabase configured there's no auth at all — the localStorage mock
// is single-user, so `canEdit` is always true in that mode. With Supabase,
// editing needs the admin or super_admin role (see the roles migration).
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(Boolean(supabase));
  // Tagged with the user id so a stale role never leaks across sign-ins.
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    // onAuthStateChange emits INITIAL_SESSION on subscribe, so it is the single
    // source of truth. A separate getSession().then() raced it and, if it ever
    // rejected, left `loading` true forever (blank protected routes).
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setSessionLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (!supabase || !userId) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("role, username")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error("Failed to load profile role", error);
        // Fail closed: an unreadable role is treated as pending.
        if (!cancelled) setProfile({ userId, role: data?.role ?? "pending", username: data?.username ?? null });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const ownProfile = userId && profile?.userId === userId ? profile : null;
  const role = ownProfile?.role ?? null;
  const username = ownProfile?.username || user?.user_metadata?.username || null;
  const isAdmin = role === "admin" || role === "super_admin";
  const loading = sessionLoading || Boolean(userId && !role);

  const value = useMemo(
    () => ({
      user,
      username,
      role,
      loading,
      enabled: Boolean(supabase),
      isAdmin,
      isPending: role === "pending",
      isSuperAdmin: role === "super_admin",
      canEdit: !supabase || isAdmin,
    }),
    [user, username, role, loading, isAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

// Route guard: bounces visitors without edit rights to /account, then back
// here after they sign in.
export function RequireAuth({ children }) {
  const { canEdit, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!canEdit) return <Navigate to="/account" replace state={{ from: location.pathname }} />;
  return children;
}
