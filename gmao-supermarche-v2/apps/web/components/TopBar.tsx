"use client";
import { Bell, Calendar, ChevronDown, Menu, Building2, Check } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  notifCount?: number;
}

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: "Administrateur",
  MAINTENANCIER: "Maintenancier",
  USER: "Demandeur",
  VIEWER: "Lecteur",
};

export default function TopBar({ title, subtitle, notifCount = 0, collapsed }: TopBarProps & { collapsed?: boolean }) {
  const [user, setUser] = useState<any>(null);
  const [supermarkets, setSupermarkets] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });

  useEffect(() => {
    const raw = sessionStorage.getItem("gmao_user");
    if (raw) {
      const parsedUser = JSON.parse(raw);
      setUser(parsedUser);
      loadSupermarkets(parsedUser);
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const loadSupermarkets = async (parsedUser: any) => {
    try {
      const list = await api.getSupermarkets();
      setSupermarkets(list);
      const stored = sessionStorage.getItem("gmao_current_supermarket");
      const matched = list.find((s: any) => s.id === stored)
        || list.find((s: any) => s.id === parsedUser?.supermarketId)
        || list[0];
      if (matched) {
        sessionStorage.setItem("gmao_current_supermarket", matched.id);
        setCurrent(matched);
        window.dispatchEvent(new CustomEvent("gmao:supermarket-change", { detail: { id: matched.id } }));
      }
    } catch {}
  };

  const switchSupermarket = (s: any) => {
    sessionStorage.setItem("gmao_current_supermarket", s.id);
    setCurrent(s);
    window.dispatchEvent(new CustomEvent("gmao:supermarket-change", { detail: { id: s.id } }));
    setOpen(false);
    window.location.reload();
  };

  const displayTitle = title || `Bonjour, ${user?.nom || "Utilisateur"}`;
  const displaySubtitle = subtitle || (current ? `Supermarché actif : ${current.nom}` : "Vue d'ensemble de la maintenance multi-supermarché");

  return (
    <header className={`fixed top-0 right-0 left-0 h-16 bg-white border-b border-slate-100 z-20 flex items-center px-4 md:px-6 gap-4 transition-all duration-300 shadow-sm ${
      collapsed ? "md:left-16" : "md:left-60"
    }`}>
      <button className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors">
        <Menu size={20} className="text-slate-600" />
      </button>

      <div className="flex-1 min-w-0">
        <h1 className="text-[15px] font-bold text-slate-900 leading-tight truncate">{displayTitle}</h1>
        <p className="text-xs text-slate-400 hidden sm:block truncate">{displaySubtitle}</p>
      </div>

      <div className="flex items-center gap-2">
        {/* Supermarket selector */}
        {current && (
          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center gap-2 rounded-full border border-orange/20 bg-orange/10 hover:bg-orange/20 transition-colors px-3 py-1.5 text-[11px] font-semibold text-orange-700"
            >
              <Building2 size={13} />
              <span>{current.nom}</span>
              <ChevronDown size={11} />
            </button>
            {open && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-slate-200 shadow-xl z-50 py-1 animate-fade-in">
                <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Changer de supermarché</p>
                {supermarkets.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => switchSupermarket(s)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{s.nom}</p>
                      {s.adresse && <p className="text-[10px] text-slate-400">{s.adresse}</p>}
                    </div>
                    {current?.id === s.id && <Check size={14} className="text-orange shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Date */}
        <button className="hidden lg:flex items-center gap-2 text-xs text-slate-600 border border-slate-200 rounded-xl px-3 py-2 hover:bg-slate-50 transition-colors">
          <Calendar size={14} />
          <span className="capitalize">{today}</span>
          <ChevronDown size={12} />
        </button>

        {/* Notifications */}
        <button className="relative p-2.5 rounded-xl hover:bg-slate-100 transition-colors">
          <Bell size={18} className="text-slate-600" />
          {notifCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
              {notifCount}
            </span>
          )}
        </button>

        {/* User */}
        {user && (
          <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3 ml-1">
            <div className="h-8 w-8 rounded-xl bg-navy flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {user.nom?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-slate-900 leading-tight">{user.nom}</p>
              <p className="text-[10px] text-slate-400">{roleLabel[user.role] || user.role}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
