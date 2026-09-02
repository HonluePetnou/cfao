"use client";
import Shell from "@/components/Shell";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Filter, PlusCircle, Search, ChevronRight, Loader2, Calendar, Wrench, AlertTriangle } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  NOUVEAU: "Nouveau", ASSIGNE: "Assigné", EN_COURS: "En cours",
  TERMINE: "Terminé", A_REPRENDRE: "À reprendre", FERME: "Fermé",
};
const PRIORITY_LABEL: Record<string, string> = {
  CRITIQUE: "Critique", HAUTE: "Haute", MOYENNE: "Moyenne", BASSE: "Basse",
};

const PRIORITY_BADGE: Record<string, string> = { CRITIQUE: "badge-critique", HAUTE: "badge-haute", MOYENNE: "badge-moyenne", BASSE: "badge-basse" };
const STATUS_BADGE: Record<string, string> = {
  NOUVEAU: "status-nouveau", ASSIGNE: "status-assigne", EN_COURS: "status-en_cours",
  TERMINE: "status-termine", A_REPRENDRE: "status-a_reprendre", FERME: "status-ferme",
};
const PRIORITY_ORDER: Record<string, number> = { CRITIQUE: 0, HAUTE: 1, MOYENNE: 2, BASSE: 3 };

const TABS = [
  { key: "all", label: "Tous" },
  { key: "CRITIQUE", label: "Urgents", isPriority: true },
  { key: "ASSIGNE", label: "En attente" },
  { key: "EN_COURS", label: "En cours" },
  { key: "TERMINE", label: "Terminés" },
  { key: "FERME", label: "Fermés" },
];

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [sortByPriority, setSortByPriority] = useState(true);
  const [filterType, setFilterType] = useState<"all" | "curative" | "preventive">("all");
  const [filterMaintenancier, setFilterMaintenancier] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("gmao_user");
    if (raw) {
      const u = JSON.parse(raw);
      setUser(u);
      const params: any = {};
      if (u.role === "USER") {
        router.replace("/demandeur?history=true");
        return;
      }
      if (u.role === "MAINTENANCIER") {
        router.replace("/maintenancier");
        return;
      }
      api.getTickets(params)
        .then(setTickets)
        .catch(() => router.push("/login"))
        .finally(() => setLoading(false));
    } else {
      router.push("/login");
    }
  }, [router]);

  const maintenanciers = useMemo(() => {
    const byId = new Map<string, string>();
    tickets.forEach((ticket) => {
      if (ticket.assignedMaintenancier?.id) {
        byId.set(ticket.assignedMaintenancier.id, ticket.assignedMaintenancier.nom);
      }
    });
    return Array.from(byId, ([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }, [tickets]);

  const maintenancierTickets = useMemo(
    () => filterMaintenancier
      ? tickets.filter((ticket) => ticket.assignedMaintenancier?.id === filterMaintenancier)
      : tickets,
    [tickets, filterMaintenancier],
  );

  const counts = useMemo(() => ({
    urgent:     maintenancierTickets.filter((t) => t.priority === "CRITIQUE" && t.status !== "FERME").length,
    waiting:    maintenancierTickets.filter((t) => t.status === "ASSIGNE").length,
    inProgress: maintenancierTickets.filter((t) => t.status === "EN_COURS").length,
    done:       maintenancierTickets.filter((t) => t.status === "TERMINE").length,
  }), [maintenancierTickets]);

  const filtered = useMemo(() => {
    let list = [...maintenancierTickets];
    if (filterType === "preventive") list = list.filter((t) => t.typeTravaux?.toLowerCase().includes("préventive"));
    else if (filterType === "curative") list = list.filter((t) => t.typeTravaux && !t.typeTravaux.toLowerCase().includes("préventive"));
    const tab = TABS.find((t) => t.key === activeTab);
    if (activeTab !== "all") {
      if (tab?.isPriority) list = list.filter((t) => t.priority === activeTab);
      else list = list.filter((t) => t.status === activeTab);
    }
    if (search) {
      const q = search.toLowerCase().replace(/^#/, "");
      list = list.filter((t) =>
        t.titre?.toLowerCase().includes(q) ||
        t.equipment?.nom?.toLowerCase().includes(q) ||
        String(t.numero) === q
      );
    }
    if (sortByPriority) list.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));
    return list;
  }, [maintenancierTickets, activeTab, search, sortByPriority, filterType]);

  return (
    <Shell title="Tickets" subtitle={user?.role === "USER" ? "Mon historique" : "Gestion des bons de travail"}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Urgents",    val: counts.urgent,     color: "text-red-600",     bg: "bg-red-50" },
          { label: "En attente", val: counts.waiting,    color: "text-amber-600",   bg: "bg-amber-50" },
          { label: "En cours",   val: counts.inProgress, color: "text-blue-600",    bg: "bg-blue-50" },
          { label: "Terminés",   val: counts.done,       color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map((s) => (
          <div key={s.label} className={`card ${s.bg} border-0`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="card mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-1">
            <Search size={15} className="text-slate-400 shrink-0" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="flex-1 py-2 text-sm text-slate-700 bg-transparent outline-none placeholder:text-slate-300" />
          </div>
          <label className="sr-only" htmlFor="ticket-maintainer-filter">Bilan par maintenancier</label>
          <select
            id="ticket-maintainer-filter"
            value={filterMaintenancier}
            onChange={(e) => setFilterMaintenancier(e.target.value)}
            className="select text-xs sm:max-w-56"
          >
            <option value="">Tous les maintenanciers</option>
            {maintenanciers.map((maintenancier) => (
              <option key={maintenancier.id} value={maintenancier.id}>{maintenancier.nom}</option>
            ))}
          </select>
          {user?.role === "MAINTENANCIER" && (
            <div className="flex rounded-xl border border-slate-200 overflow-hidden">
              {(["all", "curative", "preventive"] as const).map((t) => (
                <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-2 text-xs font-medium transition-colors ${filterType === t ? "bg-navy text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                  {t === "all" ? "Tous" : t === "curative" ? "Curatifs" : "Préventifs"}
                </button>
              ))}
            </div>
          )}
          {user?.role !== "MAINTENANCIER" && (
            <button onClick={() => setSortByPriority(!sortByPriority)} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium border transition-colors ${sortByPriority ? "bg-navy text-white border-navy" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              <Filter size={14} /> {sortByPriority ? "Trié" : "Trier"}
            </button>
          )}
          {user?.role !== "VIEWER" && (
            <button onClick={() => router.push("/tickets/new")} className="btn-primary"><PlusCircle size={15} /> Nouveau ticket</button>
          )}
        </div>

        <div className="flex gap-1 mt-4 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${activeTab === t.key ? "bg-navy text-white" : "text-slate-500 hover:bg-slate-100"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-orange" /></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <Wrench size={44} className="mx-auto text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">Aucun ticket trouvé</p>
          <p className="text-slate-400 text-sm mt-1">Essayez de modifier vos filtres</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <div key={t.id} onClick={() => router.push(`/tickets/${t.id}`)} className={`bg-white rounded-2xl shadow-card cursor-pointer hover:shadow-card-md transition-all group`}>
              <div className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1.5">
                    <span className="text-[10px] font-mono font-bold text-slate-400">#{t.numero}</span>
                    <span className={`badge ${PRIORITY_BADGE[t.priority]}`}>{PRIORITY_LABEL[t.priority]}</span>
                    <span className={`status-badge ${STATUS_BADGE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                    {t.typeTravaux && <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">{t.typeTravaux.replace("Maint. ", "")}</span>}
                    {t.status === "A_REPRENDRE" && <AlertTriangle size={13} className="text-yellow-600" />}
                  </div>
                  <h3 className="font-semibold text-slate-800 text-sm leading-snug group-hover:text-orange transition-colors truncate">{t.titre}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{t.equipment?.nom}</p>
                  <div className="flex items-center flex-wrap gap-3 mt-2 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1"><Calendar size={11} />{new Date(t.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    {t.assignedMaintenancier && <span className="flex items-center gap-1"><Wrench size={11} />{t.assignedMaintenancier.nom}</span>}
                  </div>
                </div>
                <ChevronRight size={17} className="text-slate-300 group-hover:text-orange transition-colors shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
