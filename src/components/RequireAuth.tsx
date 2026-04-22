import { Navigate } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  allow?: AppRole[];
  fallback?: string;
}

export function RequireAuth({ children, allow, fallback = "/auth/login" }: Props) {
  const { user, roles, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-bronze border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to={fallback} />;
  if (allow && !roles.some((r) => allow.includes(r))) {
    return <Navigate to="/" />;
  }
  return <>{children}</>;
}
