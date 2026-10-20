import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "./supabase";

const AuthContext = createContext(null);

// Without Supabase configured there's no auth at all — the localStorage mock
// is single-user, so `canEdit` is always true in that mode.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = {
    user,
    loading,
    enabled: Boolean(supabase),
    canEdit: !supabase || Boolean(user),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

// Route guard: bounces signed-out visitors to /account, then back here after
// they sign in.
export function RequireAuth({ children }) {
  const { canEdit, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!canEdit) return <Navigate to="/account" replace state={{ from: location.pathname }} />;
  return children;
}
