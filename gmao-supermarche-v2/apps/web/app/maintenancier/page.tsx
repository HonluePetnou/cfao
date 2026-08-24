"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { parseChecklist, parseChecklistSections } from "@/lib/checklist";
import { useToast } from "@/components/Toast";
import {
  Wrench, Ticket, CheckCircle2, Clock, AlertTriangle,
  LogOut, HelpCircle, Phone, Mail, ChevronRight,
  PlusCircle, FileText, Loader2, Settings, X, History,
  PenLine, ShieldCheck, ClipboardList,
} from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  NOUVEAU: "Nouveau", ASSIGNE: "Assigné", EN_COURS: "En cours",
  TERMINE: "Terminé", A_REPRENDRE: "À reprendre", FERME: "Fermé",
};

const STATUS_COLOR: Record<string, string> = {
  NOUVEAU: "bg-blue-50 text-blue-700 border-blue-100",
  ASSIGNE: "bg-amber-50 text-amber-700 border-amber-100",
  EN_COURS: "bg-purple-50 text-purple-700 border-purple-100",
  TERMINE: "bg-emerald-50 text-emerald-700 border-emerald-100",
  A_REPRENDRE: "bg-red-50 text-red-700 border-red-100",
  FERME: "bg-slate-50 text-slate-500 border-slate-100",
};



export default function MaintenancierPage() {
  const router = useRouter();
  const { error: toastError, info, warning, success } = useToast();
  const [user, setUser] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [rapports, setRapports] = useState<any[]>([]);
  const [preventiveTasks, setPreventiveTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState<string | null>(null);
  const [validatingPreventive, setValidatingPreventive] = useState<string | null>(null);
  const [selectedPreventive, setSelectedPreventive] = useState<any>(null);
  const [preventiveNote, setPreventiveNote] = useState("");
  const [preventiveCout, setPreventiveCout] = useState("");
  const [preventiveTempsArret, setPreventiveTempsArret] = useState("");
  const [preventiveImputation, setPreventiveImputation] = useState("");
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [activeTab, setActiveTab] = useState<"home" | "reports">("home");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showParams, setShowParams] = useState(false);
  const paramsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("gmao_user");
    if (!raw) { router.replace("/login"); return; }
    const u = JSON.parse(raw);
    if (u.role !== "MAINTENANCIER") { router.replace("/dashboard"); return; }
    setUser(u);
    Promise.all([
      api.getTickets({ maintenancierId: u.id }),
      api.getRapportsJournaliers({ maintenancierId: u.id }),
      api.getMyPreventiveTasks().catch(() => []),
    ])
      .then(([data, reports, preventives]) => {
        setTickets(data);
        setRapports(reports);
        setPreventiveTasks(preventives);
        const urgents = data.filter((t: any) => t.priority === "CRITIQUE" && !["TERMINE", "FERME"].includes(t.status));
        const latePreventives = preventives.filter((pt: any) => pt.status === "EN_RETARD");
        if (urgents.length > 0 || latePreventives.length > 0) {
          warning(`${urgents.length + latePreventives.length} intervention(s) urgente(s)`, "Des tâches critiques nécessitent votre attention");
        }
      })
      .catch(() => toastError("Erreur de chargement", "Impossible de récupérer vos interventions"))
      .finally(() => setLoading(false));
  }, [router]);

  // Close settings drawer on outside click
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

  const handleSign = async (rapportId: string) => {
    setSigning(rapportId);
    try {
      const updated = await api.signerRapport(rapportId, "technicien", user?.nom);
      setRapports((prev) => prev.map((r) => r.id === rapportId ? { ...r, ...updated } : r));
      success("Rapport signé ✅", "Votre visa technicien a été apposé.");
    } catch {
      toastError("Erreur de signature", "Impossible de signer ce rapport.");
    } finally {
      setSigning(null);
    }
  };

  const activeTickets = useMemo(() => {
    let list = tickets.filter((t) => !["TERMINE", "FERME"].includes(t.status));
    
    // Convertir les tâches préventives en "tickets" virtuels
    const mappedPreventives = preventiveTasks
      .filter((pt) => pt.status !== "EFFECTUE")
      .map((pt) => ({
        id: `prev-${pt.id}`,
        originalId: pt.id,
        isPreventive: true,
        titre: `${pt.plan?.titre || 'Entretien'} (Préventif)`,
        description: pt.plan?.checklist || "Maintenance préventive planifiée",
        status: pt.status === "EN_RETARD" ? "A_REPRENDRE" : "NOUVEAU",
        priority: pt.status === "EN_RETARD" ? "CRITIQUE" : "MOYENNE",
        createdAt: pt.dueDate, // Utiliser la date prévue
        equipment: pt.plan?.equipment,
        supermarket: pt.plan?.equipment?.supermarket,
        corpsEtat: pt.plan?.equipment?.corpsEtat || "Préventif",
      }));
      
    list = [...list, ...mappedPreventives];

    if (statusFilter !== "ALL") list = list.filter((t) => t.status === statusFilter);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [tickets, preventiveTasks, statusFilter]);

  const completedTickets = useMemo(() =>
    tickets.filter((t) => ["TERMINE", "FERME"].includes(t.status)),
    [tickets]);

  useEffect(() => {
    if (selectedPreventive) {
      setPreventiveNote("");
      setPreventiveCout("");
      setPreventiveTempsArret("");
      setPreventiveImputation("");
      setCheckedItems({});
    }
  }, [selectedPreventive]);

  const checklistItems = useMemo(() => {
    // description holds the raw checklist string (JSON or plain text)
    if (!selectedPreventive?.description) return [];
    return parseChecklist(selectedPreventive.description);
  }, [selectedPreventive]);

  const checklistSections = useMemo(() => {
    if (!selectedPreventive?.description) return [];
    return parseChecklistSections(selectedPreventive.description);
  }, [selectedPreventive]);

  // flat alias used by submit logic
  const checklistLines = checklistItems;

  const handleCheckChange = (index: number, checked: boolean) => {
    setCheckedItems(prev => ({ ...prev, [index]: checked }));
  };

  const submitPreventive = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedPreventive) return;
    setValidatingPreventive(selectedPreventive.originalId);
    try {
      await api.submitPublicPreventiveTask(selectedPreventive.originalId, {
        note: preventiveNote,
        cout: preventiveCout ? Number(preventiveCout) : undefined,
        tempsArret: preventiveTempsArret ? Number(preventiveTempsArret) : undefined,
        imputation: preventiveImputation || undefined,
      });
      success("Tâche validée ✅", "Le ticket historique a été généré.");
      setPreventiveTasks(prev => prev.filter(t => t.id !== selectedPreventive.originalId));
      setSelectedPreventive(null);
    } catch {
      toastError("Erreur", "Impossible de valider cette tâche.");
    } finally {
      setValidatingPreventive(null);
    }
  };

  const stats = useMemo(() => ({
    totalAssigned: tickets.filter((t) => !["TERMINE", "FERME"].includes(t.status)).length,
    enCours: tickets.filter((t) => t.status === "EN_COURS").length,
    done: completedTickets.length,
    urgents: tickets.filter((t) => t.priority === "CRITIQUE" && !["TERMINE", "FERME"].includes(t.status)).length,
  }), [tickets, completedTickets]);

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
    <div className="min-h-screen bg-slate-50 relative pb-24">

      {/* ─── HEADER ─── */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-20 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-orange flex items-center justify-center shadow-md shadow-orange/25">
            <Wrench size={17} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight">
              Bonjour{user?.nom ? `, ${user.nom.split(" ")[0]}` : ""} 🛠️
            </p>
            <p className="text-[10px] text-slate-400">Technicien · {user?.supermarket?.nom || "GMAO CONSUMER CAMEROUN"}</p>
          </div>
        </div>

        {/* Bouton Paramètres — en haut à droite */}
        <button
          onClick={() => setShowParams((v) => !v)}
          className="relative h-9 w-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
        >
          <Settings size={17} className="text-slate-600" />
        </button>
      </header>

      {/* ─── DRAWER PARAMÈTRES (slide depuis la droite) ─── */}
      {showParams && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={() => setShowParams(false)}>
          <div
            ref={paramsRef}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-0 right-0 h-full w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col"
            style={{ animation: "slideInRight 0.22s ease" }}
          >
            {/* En-tête du drawer */}
            <div className="bg-navy text-white px-5 pt-8 pb-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-sm">Paramètres</h2>
                <button onClick={() => setShowParams(false)} className="p-1 rounded-lg hover:bg-white/10">
                  <X size={16} />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-orange flex items-center justify-center font-bold text-white text-base shadow">
                  {user?.nom?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <p className="font-bold text-sm leading-tight">{user?.nom || "Technicien"}</p>
                  <p className="text-[10px] text-slate-300 mt-0.5">{user?.email || ""}</p>
                </div>
              </div>
            </div>

            {/* Corps du drawer */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">

              {/* Historique */}
              <button
                onClick={() => { setShowParams(false); setActiveTab("reports"); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 transition-colors text-left group"
              >
                <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center">
                  <History size={17} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">Mes rapports</p>
                  <p className="text-[10px] text-slate-400">{rapports.length} rapport(s) journalier(s)</p>
                </div>
                <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
              </button>

              {/* Aide */}
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 transition-colors text-left group">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <HelpCircle size={17} className="text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">Aide & Guide GMAO</p>
                  <p className="text-[10px] text-slate-400">Contacter l'administrateur</p>
                </div>
                <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
              </button>

              {/* Contact */}
              <div className="mx-4 mt-2 p-3 rounded-2xl bg-orange/5 border border-orange/10 space-y-1.5">
                <p className="text-[10px] font-bold text-orange uppercase tracking-wider">Support CFAO Retail</p>
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <Phone size={11} className="text-orange shrink-0" />
                  <span>+237 600 000 000</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <Mail size={11} className="text-orange shrink-0" />
                  <span>gmao-support@cfao.com</span>
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
                  <p className="text-[10px] text-red-400">Se déconnecter du terminal</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CONTENU ─── */}
      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">

        {/* ── ONGLET : INTERVENTIONS ── */}
        {activeTab === "home" && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Assignés", value: activeTickets.length, sublabel: "interventions à faire", icon: Ticket, iconCls: "bg-orange/10 text-orange" },
                { label: "En cours", value: tickets.filter(t => t.status === "EN_COURS").length, sublabel: "en traitement", icon: Clock, iconCls: "bg-purple-50 text-purple-500" },
                { label: "Réalisés", value: tickets.filter(t => t.status === "TERMINE").length, sublabel: "tickets terminés", icon: CheckCircle2, iconCls: "bg-emerald-50 text-emerald-500" },
                { label: "Urgents", value: activeTickets.filter(t => t.priority === "CRITIQUE").length, sublabel: "priorité critique", icon: AlertTriangle, iconCls: "bg-red-50 text-red-500" },
              ].map(({ label, value, sublabel, icon: Icon, iconCls }) => (
                <div key={label} className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${iconCls}`}>
                      <Icon size={14} />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                  </div>
                  <p className="text-2xl font-black text-slate-800">{value}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{sublabel}</p>
                </div>
              ))}
            </div>

            {/* Filter + list header */}
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-1">Mes Interventions</p>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-orange text-slate-700 font-semibold"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="NOUVEAU">Nouveau</option>
                <option value="ASSIGNE">Assigné</option>
                <option value="EN_COURS">En cours</option>
                <option value="A_REPRENDRE">À reprendre</option>
              </select>
            </div>

            {/* Tickets list */}
            <div className="space-y-2">
              {activeTickets.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center shadow-sm">
                  <CheckCircle2 size={36} className="mx-auto text-emerald-400 mb-2.5" />
                  <p className="text-slate-700 font-bold text-xs">Aucune tâche en attente</p>
                  <p className="text-slate-400 text-[10px] mt-0.5">Félicitations, vos interventions sont à jour !</p>
                </div>
              ) : (
                activeTickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (t.isPreventive) {
                        setSelectedPreventive(t);
                        setPreventiveNote("");
                      } else {
                        router.push(`/tickets/${t.id}`);
                      }
                    }}
                    className={`w-full text-left bg-white border border-slate-100 rounded-2xl p-4 hover:shadow-sm hover:border-slate-200 transition-all group flex items-start justify-between gap-3`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${STATUS_COLOR[t.status] || "bg-slate-100"}`}>
                          {STATUS_LABEL[t.status] || t.status}
                        </span>
                        {t.corpsEtat && (
                          <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded font-medium">
                            {t.corpsEtat}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-slate-800 text-xs leading-snug truncate group-hover:text-orange transition-colors">
                        <span className="font-mono font-normal text-slate-400 mr-1">#{t.numero}</span>{t.titre}
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                        {t.equipment?.nom}{t.localisation ? ` · ${t.localisation}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0 gap-1">
                      <span className="text-[9px] text-slate-400 font-mono">
                        {new Date(t.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                      </span>
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-orange transition-colors" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {/* ── ONGLET : RAPPORTS D'ACTIVITÉ ── */}
        {activeTab === "reports" && (
          <>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-1">Mes rapports d'activité</p>
            <div className="space-y-3">
              {rapports.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center shadow-sm">
                  <FileText size={36} className="mx-auto text-slate-200 mb-2" />
                  <p className="text-slate-500 font-medium text-xs">Aucun rapport d'activité</p>
                  <p className="text-slate-400 text-[10px] mt-0.5">Votre responsable génère vos rapports en fin de journée.</p>
                </div>
              ) : (
                rapports.map((r) => (
                  <div key={r.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
                    {/* En-tête */}
                    <div className="flex items-start justify-between border-b border-slate-50 pb-2.5">
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-400 font-medium">
                          {new Date(r.date).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                        </p>
                        {r.managerMaintenance && (
                          <p className="text-[10px] text-slate-500 mt-0.5">Validé par : <span className="font-semibold text-slate-700">{r.managerMaintenance}</span></p>
                        )}
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const blob = await api.exportRapportPdf(r.id);
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `rapport-${r.id.slice(0, 8)}.pdf`;
                            a.click();
                            URL.revokeObjectURL(url);
                          } catch { toastError("Erreur PDF", "Impossible de télécharger le rapport"); }
                        }}
                        className="shrink-0 h-8 w-8 rounded-lg bg-orange/10 hover:bg-orange/20 flex items-center justify-center transition-colors"
                        title="Télécharger le PDF"
                      >
                        <FileText size={15} className="text-orange" />
                      </button>
                    </div>

                    {r.activites && (
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Activités du jour</p>
                        <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">{r.activites}</p>
                      </div>
                    )}

                    {r.observations && (
                      <div className="border border-slate-100 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Observations</p>
                        <p className="text-xs text-slate-600">{r.observations}</p>
                      </div>
                    )}

                    {/* Signatures */}
                    <div className="border-t border-slate-50 pt-3 space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Signatures</p>
                      <div className="flex flex-wrap gap-2">
                        {/* Badge technicien */}
                        {r.signatureTechnicien ? (
                          <span className="flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full">
                            <ShieldCheck size={11} />
                            Technicien signé · {r.dateSignatureTechnicien ? new Date(r.dateSignatureTechnicien).toLocaleDateString("fr-FR") : ""}
                          </span>
                        ) : (
                          <button
                            disabled={signing === r.id}
                            onClick={() => handleSign(r.id)}
                            className="flex items-center gap-1.5 text-[10px] font-bold bg-orange text-white px-3 py-1.5 rounded-full hover:bg-orange/90 transition-colors disabled:opacity-60"
                          >
                            {signing === r.id ? <Loader2 size={11} className="animate-spin" /> : <PenLine size={11} />}
                            Signer (moi)
                          </button>
                        )}

                        {/* Badge responsable */}
                        {r.signatureResponsable ? (
                          <span className="flex items-center gap-1 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full">
                            <ShieldCheck size={11} />
                            Responsable signé{r.managerMaintenance ? ` · ${r.managerMaintenance}` : ""}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full">
                            <PenLine size={11} />
                            En attente responsable
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </main>

      {/* ─── MODAL PRÉVENTIF ─── */}
      {selectedPreventive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-navy px-5 py-4 flex items-center justify-between shrink-0">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-200 bg-white/10 px-2 py-0.5 rounded-full mb-1 inline-block">Maintenance Préventive</span>
                <h3 className="font-bold text-white text-lg leading-tight truncate pr-2">{selectedPreventive.titre.replace(' (Préventif)', '')}</h3>
              </div>
              <button onClick={() => setSelectedPreventive(null)} className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors shrink-0">
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={submitPreventive} className="overflow-y-auto flex-1 flex flex-col">
              <div className="p-5 flex-1 space-y-5">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Équipement</p>
                  <p className="text-sm font-semibold text-slate-800">{selectedPreventive.equipment?.nom}</p>
                  <p className="text-[11px] text-slate-500">{selectedPreventive.supermarket?.nom}</p>
                </div>

                {checklistItems.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <p className="text-[10px] font-bold text-navy uppercase tracking-wider flex items-center gap-1.5 mb-3">
                      <ClipboardList size={12} className="text-orange" /> Checklist d'entretien
                      <span className="ml-auto text-[10px] font-semibold text-slate-400 normal-case">
                        {checklistItems.filter((_, i) => checkedItems[i]).length}/{checklistItems.length} validées
                      </span>
                    </p>
                    <div className="space-y-2">
                      {checklistSections.map((sec, si) => {
                        const sectionStartIdx = checklistItems.findIndex(item => item.section === sec.section);
                        return (
                          <div key={si}>
                            {checklistSections.length > 1 && (
                              <p className="text-[9px] font-bold uppercase tracking-wider text-orange/80 mb-1 mt-2 first:mt-0">{sec.section}</p>
                            )}
                            <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                              {sec.taches.map((tache, ti) => {
                                const globalIdx = sectionStartIdx + ti;
                                return (
                                  <label key={ti} className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer select-none group hover:bg-slate-50 transition-colors">
                                    <input type="checkbox" checked={!!checkedItems[globalIdx]} onChange={(e) => handleCheckChange(globalIdx, e.target.checked)}
                                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 accent-orange shrink-0" />
                                    <span className={`text-xs leading-relaxed transition-colors ${checkedItems[globalIdx] ? "text-slate-400 line-through" : "text-slate-600 group-hover:text-navy"}`}>{tache}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-navy flex items-center gap-1.5">
                    <ShieldCheck size={12} className="text-orange" /> Rapport de maintenance
                  </h4>
                  
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Note de clôture <span className="text-orange">*</span></label>
                    <textarea
                      required
                      value={preventiveNote}
                      onChange={e => setPreventiveNote(e.target.value)}
                      placeholder="Détaillez les actions réalisées..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 transition-all min-h-[60px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Coût (XAF)</label>
                      <input type="number" min="0" value={preventiveCout} onChange={e => setPreventiveCout(e.target.value)} placeholder="0"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Arrêt (H)</label>
                      <input type="number" step="0.1" min="0" value={preventiveTempsArret} onChange={e => setPreventiveTempsArret(e.target.value)} placeholder="Ex: 1.5"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Imputation</label>
                    <select value={preventiveImputation} onChange={e => setPreventiveImputation(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20">
                      <option value="">-- Sélectionner --</option>
                      <option value="PLAYCE">PLAYCE</option>
                      <option value="ADIALEA">ADIALEA</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-white shrink-0">
                <button
                  type="submit"
                  disabled={validatingPreventive === selectedPreventive.originalId}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange to-orange-600 text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-lg shadow-orange/20 disabled:opacity-70"
                >
                  {validatingPreventive === selectedPreventive.originalId ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}
                  Soumettre le rapport
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── FAB RONDE ─── */}
      <button
        onClick={() => router.push("/maintenancier/ronde")}
        className="fixed bottom-36 right-5 z-40 flex items-center gap-2 bg-navy hover:bg-navy/90 text-white rounded-full shadow-xl shadow-navy/30 px-4 py-3 font-bold text-xs transition-all active:scale-95 hover:scale-105"
        style={{ animation: "popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both" }}
      >
        <ClipboardList size={17} />
        <span>Faire la ronde</span>
      </button>

      {/* ─── FAB FLOTTANT — Créer un ticket ─── */}
      <button
        onClick={() => router.push("/maintenancier/nouveau")}
        className="fixed bottom-20 right-5 z-40 flex items-center gap-2.5 bg-orange hover:bg-orange/90 text-white rounded-full shadow-2xl shadow-orange/40 px-5 py-3.5 font-bold text-sm transition-all active:scale-95 hover:scale-105"
        style={{ animation: "popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      >
        <PlusCircle size={20} />
        <span>Nouveau ticket</span>
      </button>

      {/* ─── BOTTOM NAV (2 onglets) ─── */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 z-30 flex items-center justify-around h-16 px-4 shadow-[0_-1px_12px_rgba(0,0,0,0.06)]">
        <button
          onClick={() => setActiveTab("home")}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold px-6 py-1 rounded-xl transition-colors ${activeTab === "home" ? "text-orange" : "text-slate-400"}`}
        >
          <Ticket size={21} />
          <span>Interventions</span>
        </button>
        <button
          onClick={() => setActiveTab("reports")}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold px-6 py-1 rounded-xl transition-colors ${activeTab === "reports" ? "text-orange" : "text-slate-400"}`}
        >
          <FileText size={21} />
          <span>Rapports</span>
        </button>
      </nav>
    </div>
  );
}
