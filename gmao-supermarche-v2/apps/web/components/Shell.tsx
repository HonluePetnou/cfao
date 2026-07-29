"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";

interface ShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export default function Shell({ children, title, subtitle }: ShellProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [ticketCount, setTicketCount] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("gmao_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setReady(true);
    // Fetch open ticket count for sidebar badge
    fetch("/api/tickets", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: any[]) => {
        if (Array.isArray(data)) {
          const open = data.filter((t) => !["FERME"].includes(t.status)).length;
          setTicketCount(open);
        }
      })
      .catch(() => {});
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange shadow-lg shadow-orange/30">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-white/50 text-sm font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} ticketCount={ticketCount} />
      <TopBar title={title} subtitle={subtitle} notifCount={3} collapsed={collapsed} />
      <main className={`pt-16 pb-20 md:pb-0 min-h-screen transition-all duration-300 ${collapsed ? "md:ml-16" : "md:ml-60"}`}>
        <div className="p-4 md:p-6 animate-fade-in">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
