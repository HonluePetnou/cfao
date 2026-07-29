"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import {
  PlusCircle, History, Settings, LogOut, HelpCircle,
  Ticket, Clock, CheckCircle2, AlertTriangle, ChevronRight,
  X, Phone, Mail, Wrench, Loader2,
} from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  NOUVEAU: "Nouveau", ASSIGNE: "Assigné", EN_COURS: "En cours",
  TERMINE: "Terminé", A_REPRENDRE: "À reprendre", FERME: "Fermé",
};
const STATUS_COLOR: Record<string, string> = {
  NOUVEAU: "bg-blue-100 text-blue-700",
  ASSIGNE: "bg-amber-100 text-amber-700",
  EN_COURS: "bg-purple-100 text-purple-700",
  TERMINE: "bg-emerald-100 text-emerald-700",
  A_REPRENDRE: "bg-red-100 text-red-700",
  FERME: "bg-slate-100 text-slate-500",
};


export default function DemandeurPage() {
  const router = useRouter();
  const { success, error: toastError, info, warning } = useToast();
  const [user, setUser] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showParams, setShowParams] = useState(false);
  const [showHistorique, setShowHistorique] = useState(false);
  const paramsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("gmao_user");
    if (!raw) { router.push("/login"); return; }
    const u = JSON.parse(raw);
    if (u.role !== "USER") {
      router.replace("/dashboard");
      return;
    }
    setUser(u);
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search);
      if (q.get("history") === "true") {
        setShowHistorique(true);
      }
    }
    api.getTickets({ createdById: u.id })
      .then((data) => {
        setTickets(data);
        if (data.length === 0) {
          info("Aucun ticket", "Créez votre premier ticket avec le bouton +");
        } else {
          const critiques = data.filter((t: any) => t.priority === "CRITIQUE" && t.status !== "FERME");
          if (critiques.length > 0) {
            warning(`${critiques.length} ticket(s) critique(s)`, "Une intervention urgente est en attente");
          }
        }
      })
      .catch(() => toastError("Erreur de chargement", "Impossible de récupérer vos tickets"))
      .finally(() => setLoading(false));
  }, [router]);

  // Fermer le panneau paramètres si clic à l'extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (paramsRef.current && !paramsRef.current.contains(e.target as Node)) {
        setShowParams(false);
      }
    };
    if (showParams) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showParams]);

  const handleLogout = () => {
    info("Déconnexion...", "À bientôt !");
    setTimeout(() => {
      sessionStorage.clear();
      router.push("/login");
    }, 800);
  };

  const recent = tickets.slice(0, 5);
  const stats = {
    total:     tickets.length,
    enCours:   tickets.filter((t) => ["EN_COURS", "ASSIGNE", "NOUVEAU"].includes(t.status)).length,
    termine:   tickets.filter((t) => t.status === "TERMINE").length,
    critique:  tickets.filter((t) => t.priority === "CRITIQUE" && t.status !== "FERME").length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-orange flex items-center justify-center shadow-lg shadow-orange/30">
            <Loader2 size={22} className="text-white animate-spin" />
          </div>
          <p className="text-slate-400 text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 relative">

      {/* ─── HEADER ─── */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-20 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-orange flex items-center justify-center shadow-md shadow-orange/25">
            <Wrench size={17} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight">Bonjour{user?.nom ? `, ${user.nom.split(" ")[0]}` : ""} 👋</p>
            <p className="text-[10px] text-slate-400">Demandeur · {user?.supermarket?.nom || "GMAO CONSUMER CAMEROUN"}</p>
          </div>
        </div>

        {/* Bouton Paramètres */}
        <button
          onClick={() => setShowParams((v) => !v)}
          className="relative h-9 w-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
        >
          <Settings size={17} className="text-slate-600" />
        </button>
      </header>

      {/* ─── PANEL PARAMÈTRES (drawer depuis le haut) ─── */}
      {showParams && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={() => setShowParams(false)}>
          <div
            ref={paramsRef}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-0 right-0 h-full w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col"
            style={{ animation: "slideInRight 0.22s ease" }}
          >
            {/* En-tête du panneau */}
            <div className="bg-navy text-white px-5 pt-8 pb-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-sm">Paramètres</h2>
                <button onClick={() => setShowParams(false)} className="p-1 rounded-lg hover:bg-white/10">
                  <X size={16} />
                </button>
              </div>
              {/* Info utilisateur */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-orange flex items-center justify-center font-bold text-white text-base shadow">
                  {user?.nom?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <p className="font-bold text-sm leading-tight">{user?.nom || "Utilisateur"}</p>
                  <p className="text-[10px] text-slate-300 mt-0.5">{user?.email || ""}</p>
                </div>
              </div>
            </div>

            {/* Corps du panneau */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">

              {/* Historique */}
              <button
                onClick={() => { setShowParams(false); setShowHistorique(true); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 transition-colors text-left group"
              >
                <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center">
                  <History size={17} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">Historique</p>
                  <p className="text-[10px] text-slate-400">{tickets.length} ticket(s) au total</p>
                </div>
                <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
              </button>

              {/* Aide */}
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 transition-colors text-left group">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <HelpCircle size={17} className="text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">Aide & Support</p>
                  <p className="text-[10px] text-slate-400">Contactez l'équipe de maintenance</p>
                </div>
                <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
              </button>

              {/* Contact maintenance */}
              <div className="mx-4 mt-2 p-3 rounded-2xl bg-orange/5 border border-orange/10 space-y-1.5">
                <p className="text-[10px] font-bold text-orange uppercase tracking-wider">Contact Maintenance</p>
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <Phone size={11} className="text-orange shrink-0" />
                  <span>+237 600 000 000</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <Mail size={11} className="text-orange shrink-0" />
                  <span>maintenance@gmao.cf</span>
                </div>
              </div>
            </div>

            {/* Déconnexion */}
            <div className="border-t border-slate-100 p-4">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-50 hover:bg-red-100 transition-colors text-left"
              >
                <div className="h-9 w-9 rounded-xl bg-red-100 flex items-center justify-center">
                  <LogOut size={17} className="text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-600">Déconnexion</p>
                  <p className="text-[10px] text-red-400">Quitter l'application</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL HISTORIQUE ─── */}
      {showHistorique && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex flex-col">
          <div
            className="flex-1 flex flex-col bg-white mt-16 rounded-t-3xl overflow-hidden"
            style={{ animation: "slideUp 0.22s ease" }}
          >
            {/* Header modal */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-800">Historique des tickets</h2>
                <p className="text-[10px] text-slate-400 mt-0.5">{tickets.length} ticket(s) créé(s)</p>
              </div>
              <button
                onClick={() => setShowHistorique(false)}
                className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X size={15} className="text-slate-600" />
              </button>
            </div>

            {/* Liste tickets */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Ticket size={44} className="text-slate-200 mb-3" />
                  <p className="text-slate-500 font-medium text-sm">Aucun ticket créé</p>
                  <p className="text-slate-400 text-xs mt-1">Créez votre premier ticket avec le bouton +</p>
                </div>
              ) : (
                tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setShowHistorique(false); router.push(`/tickets/${t.id}`); }}
                    className={`w-full text-left bg-white border border-slate-100 rounded-2xl p-4 hover:border-slate-200 hover:shadow-sm transition-all`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[t.status] || "bg-slate-100 text-slate-500"}`}>
                            {STATUS_LABEL[t.status] || t.status}
                          </span>
                          {t.priority === "CRITIQUE" && (
                            <span className="text-[10px] font-bold text-red-500 flex items-center gap-0.5">
                              <AlertTriangle size={10} /> Urgent
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-slate-800 text-sm leading-snug truncate">{t.titre}</h3>
                        {t.equipment?.nom && (
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate">{t.equipment.nom}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-slate-400">
                          {new Date(t.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                        </p>
                        <ChevronRight size={14} className="text-slate-300 mt-1 ml-auto" />
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── CONTENU PRINCIPAL ─── */}
      <main className="max-w-lg mx-auto px-4 pt-4 pb-28">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <Ticket size={14} className="text-blue-500" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</p>
            </div>
            <p className="text-3xl font-black text-slate-800">{stats.total}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">ticket(s) créé(s)</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-purple-50 flex items-center justify-center">
                <Clock size={14} className="text-purple-500" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">En cours</p>
            </div>
            <p className="text-3xl font-black text-slate-800">{stats.enCours}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">en traitement</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 size={14} className="text-emerald-500" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Terminés</p>
            </div>
            <p className="text-3xl font-black text-slate-800">{stats.termine}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">résolus</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-red-50 flex items-center justify-center">
                <AlertTriangle size={14} className="text-red-500" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Urgents</p>
            </div>
            <p className="text-3xl font-black text-slate-800">{stats.critique}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">priorité critique</p>
          </div>
        </div>

        {/* Bouton Historique */}
        <button
          onClick={() => setShowHistorique(true)}
          className="w-full flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all group mb-3"
        >
          <div className="h-11 w-11 rounded-2xl bg-navy/5 flex items-center justify-center group-hover:bg-navy/10 transition-colors">
            <History size={20} className="text-navy" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-bold text-slate-800 text-sm">Historique des tickets</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {stats.total > 0 ? `${stats.total} ticket(s) · ${stats.enCours} en cours` : "Aucun ticket pour l'instant"}
            </p>
          </div>
          <ChevronRight size={17} className="text-slate-300 group-hover:text-orange transition-colors" />
        </button>

        {/* Tickets récents */}
        {recent.length > 0 && (
          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 pl-1">Récents</p>
            <div className="space-y-2">
              {recent.map((t) => (
                <button
                  key={t.id}
                  onClick={() => router.push(`/tickets/${t.id}`)}
                  className={`w-full text-left bg-white border border-slate-100 rounded-2xl px-4 py-3 hover:shadow-sm transition-all group`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[t.status] || "bg-slate-100 text-slate-500"}`}>
                          {STATUS_LABEL[t.status] || t.status}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-800 text-xs truncate group-hover:text-orange transition-colors">{t.titre}</p>
                    </div>
                    <p className="text-[10px] text-slate-400 shrink-0">
                      {new Date(t.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ─── FAB BOUTON FLOTTANT (Créer un ticket) ─── */}
      <button
        onClick={() => router.push("/demandeur/nouveau")}
        className="fixed bottom-6 right-5 z-40 flex items-center gap-2.5 bg-orange hover:bg-orange/90 text-white rounded-full shadow-2xl shadow-orange/40 px-5 py-3.5 font-bold text-sm transition-all active:scale-95 hover:scale-105"
        style={{ animation: "popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      >
        <PlusCircle size={20} />
        <span>Nouveau ticket</span>
      </button>
    </div>
  );
}
