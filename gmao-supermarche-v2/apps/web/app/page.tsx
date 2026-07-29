"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const token = sessionStorage.getItem("gmao_token");
    if (!token) { router.replace("/login"); return; }
    try {
      const raw = sessionStorage.getItem("gmao_user");
      const user = raw ? JSON.parse(raw) : null;
      const dest = user?.role === "USER" ? "/demandeur" : user?.role === "MAINTENANCIER" ? "/maintenancier" : "/dashboard";
      router.replace(dest);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-orange border-t-transparent rounded-full animate-spin" />
        <p className="text-white/40 text-sm">Chargement...</p>
      </div>
    </div>
  );
}
