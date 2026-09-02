"use client";
import Shell from "@/components/Shell";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useConfirm } from "@/components/Confirm";
import { useToast } from "@/components/Toast";
import {
  ShieldCheck, Calendar, CheckCircle2, Loader2,
  FileText, AlertTriangle, RefreshCw, PlusCircle, ChevronLeft, ChevronRight,
  ExternalLink, Trash2, Edit2, ToggleLeft, ToggleRight, ChevronUp, ChevronDown, ChevronsUpDown,
} from "lucide-react";

type PlanSortKey = "frequence" | "echeance";
// Ramène une fréquence à un nombre de jours comparable, pour pouvoir trier
// "tous les 2 mois" par rapport à "toutes les 3 semaines" sur une même échelle.
const UNIT_TO_DAYS: Record<string, number> = { DAYS: 1, WEEKS: 7, MONTHS: 30, YEARS: 365 };

export default function PreventivePage() {
  const router = useRouter();
  const confirm = useConfirm();
  const { success, error: toastError } = useToast();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"calendar" | "plans" | "tasks">("calendar");

  // Data states
  const [tasks, setTasks] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [equipments, setEquipments] = useState<any[]>([]);
  const [maintenanciers, setMaintenanciers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Calendar states
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Filters
  const [filterSite, setFilterSite] = useState("");
  const [filterFrequence, setFilterFrequence] = useState("");
  const [filterDateDebutTaches, setFilterDateDebutTaches] = useState("");
  const [filterDateFinTaches, setFilterDateFinTaches] = useState("");

  // Tri "Gestion des Plans" (clic sur les en-têtes Fréquence / Prochaine Échéance)
  const [planSortKey, setPlanSortKey] = useState<PlanSortKey | null>(null);
  const [planSortDir, setPlanSortDir] = useState<"asc" | "desc">("asc");

  // Actions states
  const [actionId, setActionId] = useState<string | null>(null);
  const [cronLoading, setCronLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editPlanId, setEditPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({
    titre: "",
    equipmentId: "",
    intervalValue: 30,
    intervalUnit: "DAYS",
    assignedMaintenancierId: "",
    prestataire: "",
    checklist: "",
    nextDate: new Date().toISOString().split("T")[0],
  });

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.getProjectedPreventiveTasks(),
      api.getPreventivePlans(),
      api.getEquipments(),
      api.getMaintenanciers(),
    ])
      .then(([t, p, e, m]) => {
        setTasks(t);
        setPlans(p);
        setEquipments(e);
        setMaintenanciers(m);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem("gmao_user");
    if (!raw) { router.push("/login"); return; }
    const u = JSON.parse(raw);
    if (u.role === "USER") { router.replace("/demandeur"); return; }
    if (u.role === "MAINTENANCIER") { router.replace("/maintenancier"); return; }
    setUser(u);
    setFilterSite(sessionStorage.getItem("gmao_current_supermarket") || u.supermarketId || "");
    loadData();
  }, [router, loadData]);

  useEffect(() => {
    const handleSupermarketChange = (event: Event) => {
      const siteId = (event as CustomEvent<{ id: string }>).detail?.id || "";
      setFilterSite(siteId);
      setSelectedDate(null);
      setPlanForm((current) => {
        if (!current.equipmentId || !siteId) return current;
        const selectedEquipment = equipments.find((equipment) => equipment.id === current.equipmentId);
        return selectedEquipment?.supermarketId === siteId ? current : { ...current, equipmentId: "" };
      });
    };
    window.addEventListener("gmao:supermarket-change", handleSupermarketChange);
    return () => window.removeEventListener("gmao:supermarket-change", handleSupermarketChange);
  }, [equipments]);

  // Actions
  const handleDone = async (id: string) => {
    const ok = await confirm({
      title: "Valider la tâche",
      message: "Marquer cette tâche comme effectuée directement par l'admin ? (Sans prestataire)",
      confirmText: "Valider",
      type: "warning",
    });
    if (!ok) return;
    setActionId(id);
    try {
      await api.markPreventiveTaskDone(id, "Validée manuellement par l'administrateur");
      success("Tâche validée", "La tâche préventive a été marquée comme effectuée");
      loadData();
    } catch {
      toastError("Erreur", "Impossible de valider cette tâche.");
    }
    setActionId(null);
  };

  const handleGenerate = async () => {
    setCronLoading(true);
    try {
      await api.triggerGenerateTasks();
      success("Génération lancée", "Les prochaines échéances ont été générées");
      loadData();
    } catch {
      toastError("Erreur", "Impossible de générer les tâches.");
    }
    setCronLoading(false);
  };

  // Le prestataire externe n'a pas accès à l'application : il remet une fiche
  // papier à l'admin, qui remplit lui-même le formulaire de clôture. Ce bouton
  // ouvre donc directement ce formulaire (au lieu de copier un lien à envoyer).
  const handleOpenForm = (taskId: string) => {
    const link = `${window.location.origin}/public/preventive/${taskId}`;
    window.open(link, "_blank", "noopener,noreferrer");
  };

  const handlePlanToggle = async (plan: any) => {
    try {
      await api.updatePreventivePlan(plan.id, { active: !plan.active });
      loadData();
    } catch {
      toastError("Erreur", "Impossible de modifier ce plan.");
    }
  };

  const handlePlanDelete = async (id: string) => {
    const ok = await confirm({
      title: "Supprimer le plan",
      message: "Supprimer définitivement ce plan et toutes ses tâches associées ? Cette action est irréversible.",
      confirmText: "Supprimer",
      type: "danger",
    });
    if (!ok) return;
    try {
      await api.deletePreventivePlan(id);
      success("Plan supprimé", "Le plan préventif a été supprimé");
      loadData();
    } catch {
      toastError("Erreur", "Impossible de supprimer ce plan.");
    }
  };

  // Clic sur un en-tête triable de "Gestion des Plans" : 1er clic = croissant,
  // 2e clic sur la même colonne = décroissant, clic sur une autre colonne = repart en croissant.
  const handlePlanSort = (key: PlanSortKey) => {
    if (planSortKey === key) {
      setPlanSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setPlanSortKey(key);
      setPlanSortDir("asc");
    }
  };

  const equipmentById = useMemo(
    () => new Map(equipments.map((equipment) => [equipment.id, equipment])),
    [equipments],
  );

  const planMatchesSite = useCallback((plan: any) => {
    if (!filterSite) return true;
    return equipmentById.get(plan?.equipment?.id)?.supermarketId === filterSite;
  }, [equipmentById, filterSite]);

  const filteredTasks = useMemo(
    () => tasks.filter((task) => planMatchesSite(task.plan)),
    [tasks, planMatchesSite],
  );

  const filteredPlans = useMemo(
    () => plans.filter(planMatchesSite),
    [plans, planMatchesSite],
  );

  const availableEquipments = useMemo(
    () => filterSite
      ? equipments.filter((equipment) => equipment.supermarketId === filterSite)
      : equipments,
    [equipments, filterSite],
  );

  const visiblePlans = useMemo(() => {
    const filtered = filteredPlans.filter((p) => !filterFrequence || p.intervalUnit === filterFrequence);
    if (!planSortKey) return filtered;
    const dir = planSortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (planSortKey === "frequence") {
        const aDays = (a.intervalValue || 0) * (UNIT_TO_DAYS[a.intervalUnit] || 0);
        const bDays = (b.intervalValue || 0) * (UNIT_TO_DAYS[b.intervalUnit] || 0);
        return (aDays - bDays) * dir;
      }
      // echeance
      const aTime = new Date(a.nextDate).getTime();
      const bTime = new Date(b.nextDate).getTime();
      return (aTime - bTime) * dir;
    });
  }, [filteredPlans, filterFrequence, planSortKey, planSortDir]);

  const PlanSortIcon = ({ column }: { column: PlanSortKey }) => {
    if (planSortKey !== column) return <ChevronsUpDown size={11} className="text-slate-300" />;
    return planSortDir === "asc" ? <ChevronUp size={11} className="text-orange" /> : <ChevronDown size={11} className="text-orange" />;
  };

  const handleOpenCreateModal = () => {
    setEditPlanId(null);
    setPlanForm({
      titre: "",
      equipmentId: "",
      intervalValue: 30,
      intervalUnit: "DAYS",
      assignedMaintenancierId: "",
      prestataire: "",
      checklist: "",
      nextDate: new Date().toISOString().split("T")[0],
    });
    setError("");
    setShowModal(true);
  };

  const handleOpenEditModal = (plan: any) => {
    setEditPlanId(plan.id);
    setPlanForm({
      titre: plan.titre,
      equipmentId: plan.equipmentId,
      intervalValue: plan.intervalValue,
      intervalUnit: plan.intervalUnit,
      assignedMaintenancierId: plan.assignedMaintenancierId || "",
      prestataire: plan.prestataire || "",
      checklist: plan.checklist || "",
      nextDate: new Date(plan.nextDate).toISOString().split("T")[0],
    });
    setError("");
    setShowModal(true);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planForm.titre.trim() || !planForm.equipmentId) {
      setError("Veuillez remplir le titre et sélectionner un équipement.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...planForm,
        intervalValue: parseInt(planForm.intervalValue as any, 10),
        assignedMaintenancierId: planForm.assignedMaintenancierId || null,
        prestataire: planForm.prestataire || null,
      };

      if (editPlanId) {
        await api.updatePreventivePlan(editPlanId, payload);
      } else {
        await api.createPreventivePlan(payload);
      }
      setShowModal(false);
      loadData();
    } catch {
      setError("Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  };

  // Grid Calendar variables
  const currentYear = currentMonth.getFullYear();
  const currentMonthNum = currentMonth.getMonth();
  const daysInMonth = new Date(currentYear, currentMonthNum + 1, 0).getDate();
  let firstDayOfMonth = new Date(currentYear, currentMonthNum, 1).getDay() - 1; 
  if (firstDayOfMonth === -1) firstDayOfMonth = 6;
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const previousMonthDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const getTasksForDate = (year: number, month: number, day: number) => {
    return filteredTasks.filter((t) => {
      const d = new Date(t.dueDate);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  };
  const selectedDateTasks = selectedDate ? getTasksForDate(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()) : [];

  const stats = useMemo(() => {
    const real = filteredTasks.filter((t) => !t.isProjected);
    return {
      total: real.length,
      late:  real.filter((t) => t.status === "EN_RETARD" || (t.status === "PLANIFIE" && new Date(t.dueDate) < new Date())).length,
      done:  real.filter((t) => t.status === "EFFECTUE").length,
      activePlans: filteredPlans.filter((p) => p.active).length,
    };
  }, [filteredTasks, filteredPlans]);

  if (loading) {
    return (
      <Shell title="Préventif" subtitle="Maintenance préventive">
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-orange" />
        </div>
      </Shell>
    );
  }

  const isAdmin = user?.role === "SUPER_ADMIN";
  // Viewer : peut consulter l'onglet "Gestion des Plans" (lecture seule),
  // mais pas créer/modifier/supprimer — ces actions restent isAdmin uniquement.
  const isViewer = user?.role === "VIEWER";
  const canSeePlans = isAdmin || isViewer;

  return (
    <Shell title="Maintenance préventive" subtitle="Planification et suivi des interventions régulières">

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="card text-center py-3">
          <p className="text-xl font-black text-slate-800">{stats.activePlans}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Plans actifs</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xl font-black text-slate-800">{stats.total}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Tâches générées</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xl font-black text-slate-800">{stats.late}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">En retard</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xl font-black text-slate-800">{stats.done}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Effectuées</p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 mb-4 overflow-x-auto gap-2">
        <button onClick={() => setActiveTab("calendar")}
          className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === "calendar" ? "border-orange text-orange" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
          Calendrier Annuel
        </button>
        {canSeePlans && (
          <button onClick={() => setActiveTab("plans")}
            className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === "plans" ? "border-orange text-orange" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            Gestion des Plans
          </button>
        )}
        <button onClick={() => setActiveTab("tasks")}
          className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === "tasks" ? "border-orange text-orange" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            Suivi des Tâches
          </button>
      </div>

      {/* Cron / Actions top bar */}
      {isAdmin && activeTab !== "plans" && (
        <div className="card mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-3">
          <div>
            <p className="text-xs font-bold text-slate-700">Génération automatique des tâches</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Force le système à générer les prochaines échéances immédiates.
            </p>
          </div>
          <button onClick={handleGenerate} disabled={cronLoading} className="btn-secondary text-[11px] py-1.5 px-4 shrink-0">
            {cronLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Générer maintenant
          </button>
        </div>
      )}

      {/* Onglet 1: CALENDRIER ANNUEL */}
      {activeTab === "calendar" && (
        <div className="space-y-4">
          <div className="card p-4 flex items-center justify-between">
            <button onClick={() => { setCurrentMonth(new Date(currentYear, currentMonthNum - 1, 1)); setSelectedDate(null); }} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
              <ChevronLeft size={18} className="text-slate-600" />
            </button>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 capitalize">
              {currentMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </h3>
            <button onClick={() => { setCurrentMonth(new Date(currentYear, currentMonthNum + 1, 1)); setSelectedDate(null); }} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
              <ChevronRight size={18} className="text-slate-600" />
            </button>
          </div>

          <div className="card p-4 overflow-hidden">
            <div className="grid grid-cols-7 mb-2">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {previousMonthDays.map(i => (
                <div key={`prev-${i}`} className="aspect-square rounded-xl bg-slate-50/50 border border-transparent opacity-50" />
              ))}
              {daysArray.map(day => {
                const dateTasks = getTasksForDate(currentYear, currentMonthNum, day);
                const hasTasks = dateTasks.length > 0;
                const isSelected = selectedDate?.getDate() === day && selectedDate?.getMonth() === currentMonthNum && selectedDate?.getFullYear() === currentYear;
                
                return (
                  <button 
                    key={day}
                    onClick={() => setSelectedDate(new Date(currentYear, currentMonthNum, day))}
                    className={`aspect-square rounded-xl border flex flex-col items-center justify-center relative transition-all hover:border-orange/50 hover:bg-orange/5 ${isSelected ? 'border-orange bg-orange/10 ring-2 ring-orange/20' : hasTasks ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-transparent text-slate-400'}`}
                  >
                    <span className={`text-xs sm:text-sm font-bold ${isSelected ? 'text-orange' : hasTasks ? 'text-slate-700' : ''}`}>{day}</span>
                    {hasTasks && (
                      <div className="absolute bottom-1 sm:bottom-2 flex gap-0.5">
                        {dateTasks.slice(0, 3).map((t, idx) => {
                          const isTProjected = !!t.isProjected;
                          const isTLate = !isTProjected && (t.status === "EN_RETARD" || new Date(t.dueDate) < new Date());
                          return <div key={idx} className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${t.status === 'EFFECTUE' ? 'bg-emerald-400' : isTLate ? 'bg-red-500' : isTProjected ? 'bg-slate-300' : 'bg-orange'}`} />
                        })}
                        {dateTasks.length > 3 && <span className="text-[8px] text-slate-400 leading-none ml-0.5">+{dateTasks.length - 3}</span>}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {selectedDate && (
            <div className="card p-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <h4 className="text-xs font-bold text-slate-700">Tâches du {selectedDate.toLocaleDateString("fr-FR")}</h4>
                <span className="badge badge-moyenne">{selectedDateTasks.length} tâche(s)</span>
              </div>
              
              {selectedDateTasks.length === 0 ? (
                <p className="text-xs text-center py-6 text-slate-400">Aucune tâche prévue pour ce jour.</p>
              ) : (
                <div className="space-y-3">
                  {selectedDateTasks.map(t => {
                    const isProjected = !!t.isProjected;
                    const isLate = !isProjected && (t.status === "EN_RETARD" || new Date(t.dueDate) < new Date());
                    
                    return (
                      <div key={t.id} className="border border-slate-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-200 transition-all bg-slate-50/50">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            {isLate && <span className="badge badge-critique text-[9px] py-0.5">En retard</span>}
                            {isProjected && <span className="badge badge-basse text-[9px] py-0.5 bg-slate-200 text-slate-600">Prévisionnel</span>}
                            {t.status === "EFFECTUE" && <span className="badge badge-basse text-[9px] py-0.5 bg-emerald-100 text-emerald-600">Effectuée</span>}
                          </div>
                          <h5 className="font-bold text-slate-800 text-xs">{t.plan?.titre}</h5>
                          <p className="text-[10px] text-slate-500 mt-0.5">{t.plan?.equipment?.nom}</p>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => handleOpenForm(t.id)} title="Ouvrir le formulaire"
                              className="p-2 rounded-xl border transition-all flex items-center justify-center w-8 h-8 bg-white text-slate-600 border-slate-200 hover:bg-slate-50">
                              <ExternalLink size={14} />
                            </button>
                            {!isProjected && t.status !== "EFFECTUE" && (
                              <button onClick={() => handleDone(t.id)} disabled={actionId === t.id}
                                className="px-3 rounded-xl bg-orange hover:bg-orange-600 text-white font-semibold text-[10px] transition-colors flex items-center gap-1.5">
                                {actionId === t.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Valider
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Onglet 2: GESTION DES PLANS */}
      {activeTab === "plans" && canSeePlans && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-700">Plans de maintenance active</h3>
            <div className="flex items-center gap-2">
              <select value={filterFrequence} onChange={(e) => setFilterFrequence(e.target.value)}
                className="text-xs border border-slate-200 rounded-xl pl-3 pr-7 py-1.5 appearance-none bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange/30">
                <option value="">Toutes fréquences</option>
                <option value="DAYS">Jours</option>
                <option value="WEEKS">Semaines</option>
                <option value="MONTHS">Mois</option>
                <option value="YEARS">Années</option>
              </select>
              {isAdmin && (
                <button onClick={handleOpenCreateModal} className="btn-primary text-xs py-1.5 px-3">
                  <PlusCircle size={13} /> Nouveau Plan
                </button>
              )}
            </div>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400">
                <th className="text-left pb-2 font-semibold">Titre / Équipement</th>
                <th className="text-left pb-2 font-semibold cursor-pointer select-none hover:text-slate-600" onClick={() => handlePlanSort("frequence")}>
                  <span className="inline-flex items-center gap-1">Fréquence <PlanSortIcon column="frequence" /></span>
                </th>
                <th className="text-left pb-2 font-semibold cursor-pointer select-none hover:text-slate-600" onClick={() => handlePlanSort("echeance")}>
                  <span className="inline-flex items-center gap-1">Prochaine Échéance <PlanSortIcon column="echeance" /></span>
                </th>
                <th className="text-center pb-2 font-semibold w-16">Statut</th>
                {isAdmin && <th className="text-right pb-2 font-semibold w-24">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visiblePlans.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <td className="py-2.5 max-w-[200px] truncate">
                    <p className="font-bold text-slate-800 leading-snug">{p.titre}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">{p.equipment?.nom}</p>
                  </td>
                  <td className="py-2.5 text-slate-500 font-medium">
                    Tous les {p.intervalValue} {p.intervalUnit === "DAYS" ? "jours" : p.intervalUnit === "WEEKS" ? "semaines" : p.intervalUnit === "MONTHS" ? "mois" : "ans"}
                  </td>
                  <td className="py-2.5 text-slate-400 font-mono text-[10px]">
                    {new Date(p.nextDate).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="py-2.5 text-center">
                    {isAdmin ? (
                      <button onClick={() => handlePlanToggle(p)} className="mx-auto block text-slate-400 hover:text-slate-600">
                        {p.active ? <ToggleRight size={22} className="text-orange" /> : <ToggleLeft size={22} />}
                      </button>
                    ) : (
                      <span className={`inline-block ${p.active ? "text-orange" : "text-slate-300"}`}>
                        {p.active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="py-2.5 text-right space-x-1.5">
                      <button onClick={() => handleOpenEditModal(p)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors inline-block">
                        <Edit2 size={12} />
                      </button>
                      <button onClick={() => handlePlanDelete(p.id)} className="p-1 rounded-lg hover:bg-red-50 text-red-500 transition-colors inline-block">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {visiblePlans.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">Aucun plan préventif</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Onglet 3: SUIVI DES TÂCHES (RÉELLES) */}
      {activeTab === "tasks" && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-700">Tâches générées en cours et terminées</h3>
            <div className="flex items-center gap-2">
              <input type="date" value={filterDateDebutTaches} onChange={(e) => setFilterDateDebutTaches(e.target.value)}
                className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange/30" />
              <span className="text-slate-300 text-xs">→</span>
              <input type="date" value={filterDateFinTaches} onChange={(e) => setFilterDateFinTaches(e.target.value)}
                className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange/30" />
            </div>
          </div>
          <div className="space-y-3">
            {filteredTasks.filter((t) => {
              if (t.isProjected) return false;
              if (filterDateDebutTaches && new Date(t.dueDate) < new Date(filterDateDebutTaches)) return false;
              if (filterDateFinTaches) {
                const fin = new Date(filterDateFinTaches);
                fin.setHours(23, 59, 59, 999);
                if (new Date(t.dueDate) > fin) return false;
              }
              return true;
            }).map((t) => {
              const isLate = t.status === "EN_RETARD" || (t.status === "PLANIFIE" && new Date(t.dueDate) < new Date());
              return (
                <div key={t.id} className="border border-slate-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:border-slate-200 transition-all bg-white">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                        Échéance : {new Date(t.dueDate).toLocaleDateString("fr-FR")}
                      </span>
                      <span className={`badge ${t.status === "EFFECTUE" ? "badge-basse bg-emerald-50 text-emerald-600 border-emerald-100" : isLate ? "badge-critique" : "badge-moyenne"}`}>
                        {t.status === "EFFECTUE" ? "Effectuée" : isLate ? "En retard" : "Planifiée"}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-800 text-xs mt-2">{t.plan?.titre}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">{t.plan?.equipment?.nom}</p>

                    {/* Report info if completed */}
                    {t.status === "EFFECTUE" && (
                      <div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-100/50 text-[10px] text-slate-600 max-w-lg leading-relaxed">
                        <p className="font-bold text-slate-700 mb-1">Rapport d'intervention :</p>
                        <p className="whitespace-pre-wrap">{t.note || "Aucun détail fourni."}</p>
                        {t.doneAt && (
                          <p className="text-[9px] text-slate-400 mt-2 font-medium">Validé le {new Date(t.doneAt).toLocaleDateString("fr-FR")}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {isAdmin && t.status !== "EFFECTUE" && (
                    <div className="flex gap-1.5 shrink-0 self-end sm:self-start">
                      <button onClick={() => handleOpenForm(t.id)}
                        className="p-2 rounded-xl border transition-all text-xs font-semibold flex items-center gap-1 bg-white text-slate-600 border-slate-200 hover:bg-slate-50">
                        <ExternalLink size={12} />
                        <span className="text-[10px]">Ouvrir le formulaire</span>
                      </button>
                      <button onClick={() => handleDone(t.id)} disabled={actionId === t.id} className="btn-secondary py-2 px-3 text-[10px]">
                        {actionId === t.id ? <Loader2 size={12} className="animate-spin" /> : "Valider"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredTasks.filter((t) => !t.isProjected).length === 0 && (
              <p className="text-center py-10 text-slate-400">Aucune tâche générée</p>
            )}
            {filteredTasks.filter((t) => !t.isProjected).length > 0 && filteredTasks.filter((t) => {
              if (t.isProjected) return false;
              if (filterDateDebutTaches && new Date(t.dueDate) < new Date(filterDateDebutTaches)) return false;
              if (filterDateFinTaches) {
                const fin = new Date(filterDateFinTaches);
                fin.setHours(23, 59, 59, 999);
                if (new Date(t.dueDate) > fin) return false;
              }
              return true;
            }).length === 0 && (
              <p className="text-center py-10 text-slate-400">Aucune tâche pour cette période</p>
            )}
          </div>
        </div>
      )}

      {/* Modal Créer/Modifier Plan */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-navy text-white px-6 py-4">
              <h3 className="font-bold text-sm">{editPlanId ? "Modifier le Plan Préventif" : "Créer un Plan Préventif"}</h3>
              <p className="text-[10px] text-slate-300 mt-0.5">Définir les récurrences de maintenance d'une machine.</p>
            </div>

            <form onSubmit={handleModalSubmit} className="p-6 space-y-4">
              {error && <div className="bg-orange-50 border border-orange-100 text-orange text-xs rounded-xl p-3">{error}</div>}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">Titre de l'intervention <span className="text-orange">*</span></label>
                <input required type="text" value={planForm.titre} onChange={(e) => setPlanForm({ ...planForm, titre: e.target.value })} placeholder="Ex: Entretien clim bi-mensuel" className="input text-xs" />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">Équipement concerné <span className="text-orange">*</span></label>
                <select required value={planForm.equipmentId} onChange={(e) => setPlanForm({ ...planForm, equipmentId: e.target.value })} className="select text-xs">
                  <option value="">Sélectionner un équipement...</option>
                  {availableEquipments.map((eq: any) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.nom}{!filterSite && eq.supermarket?.nom ? ` — ${eq.supermarket.nom}` : ""} ({eq.corpsEtat || "Sans corps d'état"})
                    </option>
                  ))}
                </select>
                {filterSite && availableEquipments.length === 0 && (
                  <p className="mt-1 text-[10px] text-orange text-pretty">Aucun équipement actif n’est disponible pour ce site.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">Fréquence <span className="text-orange">*</span></label>
                  <input required type="number" min="1" value={planForm.intervalValue} onChange={(e) => setPlanForm({ ...planForm, intervalValue: e.target.value as any })} className="input text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">Unité <span className="text-orange">*</span></label>
                  <select value={planForm.intervalUnit} onChange={(e) => setPlanForm({ ...planForm, intervalUnit: e.target.value })} className="select text-xs">
                    <option value="DAYS">Jours</option>
                    <option value="WEEKS">Semaines</option>
                    <option value="MONTHS">Mois</option>
                    <option value="YEARS">Années</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">Technicien affecté</label>
                  <select value={planForm.assignedMaintenancierId} onChange={(e) => setPlanForm({ ...planForm, assignedMaintenancierId: e.target.value })} className="select text-xs">
                    <option value="">Prestataire externe (Lien public)</option>
                    {maintenanciers.map((m: any) => <option key={m.id} value={m.id}>{m.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">Prochain démarrage <span className="text-orange">*</span></label>
                  <input required type="date" value={planForm.nextDate} onChange={(e) => setPlanForm({ ...planForm, nextDate: e.target.value })} className="input text-xs" />
                </div>
              </div>

              {!planForm.assignedMaintenancierId && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">Nom du prestataire externe (optionnel)</label>
                  <input type="text" value={planForm.prestataire || ""} onChange={(e) => setPlanForm({ ...planForm, prestataire: e.target.value })} placeholder="Ex: Entreprise Froid SARL" className="input text-xs" />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">Checklist de contrôle (1 étape par ligne)</label>
                <textarea rows={3} value={planForm.checklist} onChange={(e) => setPlanForm({ ...planForm, checklist: e.target.value })} placeholder="Ex: Nettoyer filtre&#10;Contrôler tension courroie&#10;Vérifier température" className="input text-xs resize-none" />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary text-[11px] py-2 px-4">Annuler</button>
                <button type="submit" disabled={submitting} className="btn-primary text-[11px] py-2 px-5">
                  {submitting ? <Loader2 size={12} className="animate-spin" /> : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}
