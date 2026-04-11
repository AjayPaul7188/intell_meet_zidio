import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = sessionStorage.getItem("token"); // ✅ FIX

  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}