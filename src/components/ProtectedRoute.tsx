import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-stone-500">验证登录…</div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  }

  return children;
}
