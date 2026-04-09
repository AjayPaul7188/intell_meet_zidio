import type { ReactNode } from "react";
import { useAuthStore } from "../store/authStore";
import Auth from "../pages/Auth";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);

  if (!token) {
    return <Auth />;
  }

  return <>{children}</>;
}