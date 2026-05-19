import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { recordAuthenticatedLogout } from "@/functions/privacy.functions";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "dev" | "professor" | "aluno";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) throw error;
      setRoles(data?.map((r) => r.role as AppRole) ?? []);
    } catch (error) {
      console.error("Falha ao carregar permissões do usuário.", error);
      setRoles([]);
    }
  };

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;

    try {
      // Set listener FIRST
      const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          // defer to avoid deadlock
          setTimeout(() => {
            fetchRoles(newSession.user.id);
          }, 0);
        } else {
          setRoles([]);
        }
      });
      subscription = sub.subscription;

      // Then check existing
      supabase.auth
        .getSession()
        .then(({ data: { session: s } }) => {
          setSession(s);
          setUser(s?.user ?? null);
          if (s?.user) fetchRoles(s.user.id);
        })
        .catch((error) => {
          console.error("Falha ao recuperar sessão do usuário.", error);
          setSession(null);
          setUser(null);
          setRoles([]);
        })
        .finally(() => {
          setLoading(false);
        });
    } catch (error) {
      console.error("Falha ao iniciar autenticação.", error);
      setSession(null);
      setUser(null);
      setRoles([]);
      setLoading(false);
    }

    return () => subscription?.unsubscribe();
  }, []);

  const refreshRoles = async () => {
    if (user) await fetchRoles(user.id);
  };

  const signOut = async () => {
    try {
      if (user) await recordAuthenticatedLogout();
    } catch (error) {
      console.error("Falha ao registrar logout.", error);
    }
    await supabase.auth.signOut();
    setRoles([]);
  };

  return (
    <AuthContext.Provider value={{ user, session, roles, loading, signOut, refreshRoles }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
