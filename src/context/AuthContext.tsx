import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/client/apiFetch";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "candidate" | "church" | "admin";
  emailVerified: boolean;
  subscriptionStatus: string;
  trialEndDate: string | null;
  mfaEnabled: boolean;
}

export interface ClientEntitlements {
  state: "unverified" | "trial" | "paid" | "expired";
  canContact: boolean;
  canSeeFullListings: boolean;
  canBrowseListings: boolean;
  chatRemaining: number | "unlimited";
  canTakeInterview: boolean;
  canViewInterviewResults: boolean;
  trialEndsAt: string | null;
  pastDue: boolean;
}

interface AuthState {
  user: SessionUser | null;
  entitlements: ClientEntitlements | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

/** Client-side view of the session. Display only — the server enforces every rule. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [entitlements, setEntitlements] = useState<ClientEntitlements | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await apiFetch<{ user: SessionUser | null; entitlements: ClientEntitlements | null }>("/api/auth/me");
      setUser(me.user);
      setEntitlements(me.entitlements);
    } catch {
      setUser(null);
      setEntitlements(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST", body: {} });
    setUser(null);
    setEntitlements(null);
    window.location.href = "/";
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ user, entitlements, loading, refresh, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
