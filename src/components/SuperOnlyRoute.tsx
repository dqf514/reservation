import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/** 仅超级管理员（role === admin）可访问 */
export function SuperOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center text-sm text-stone-500">验证权限…</div>;
  }
  if (!user || user.role !== "admin") {
    return <Navigate to="/admin" replace />;
  }
  return children;
}
