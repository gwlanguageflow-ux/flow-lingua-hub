import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { recordAuthenticatedLogout } from "@/functions/privacy.functions";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "dev" | "professor" | "aluno";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  rolesLoading: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  // Mantém a mesma referência quando os papéis não mudaram, evitando re-renders e
  // recargas de formulários (ex.: edição de perfil) a cada evento de autenticação.
  const setRolesIfChanged = (next: AppRole[]) => {
    setRoles((current) =>
      current.length === next.length && current.every((role, index) => role === next[index])
        ? current
        : next,
    );
  };

  const fetchRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) throw error;
      setRolesIfChanged(
        (data?.map((r) => r.role as AppRole) ?? []).sort((a, b) => a.localeCompare(b)),
      );
    } catch (error) {
      console.error("Falha ao carregar permissões do usuário.", error);
      setRolesIfChanged([]);
    }
  };

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;

    try {
      // Set listener FIRST
      const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
        setSession(newSession);
        setUser((current) =>
          event !== "USER_UPDATED" && current?.id === newSession?.user?.id
            ? current
            : (newSession?.user ?? null),
        );
        if (event === "TOKEN_REFRESHED") return;
        if (newSession?.user) {
          setRolesLoading(true);
          // defer to avoid deadlock
          setTimeout(async () => {
            try {
              await fetchRoles(newSession.user.id);
            } finally {
              setRolesLoading(false);
            }
          }, 0);
        } else {
          setRoles([]);
          setRolesLoading(false);
        }
      });
      subscription = sub.subscription;

      // Then check existing
      supabase.auth
        .getSession()
        .then(async ({ data: { session: s } }) => {
          setSession(s);
          setUser(s?.user ?? null);
          if (s?.user) {
            setRolesLoading(true);
            await fetchRoles(s.user.id);
          } else {
            setRoles([]);
            setRolesLoading(false);
          }
        })
        .catch((error) => {
          console.error("Falha ao recuperar sessão do usuário.", error);
          setSession(null);
          setUser(null);
          setRoles([]);
          setRolesLoading(false);
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
    <AuthContext.Provider
      value={{ user, session, roles, rolesLoading, loading, signOut, refreshRoles }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
