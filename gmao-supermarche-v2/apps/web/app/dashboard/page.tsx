"use client";
import Shell from "@/components/Shell";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import {
  AlertTriangle, Clock, Wrench, CheckCircle2, ExternalLink,
  Loader2, PlusCircle, Activity, TrendingUp, Zap, ShieldCheck,
  DollarSign, ChevronDown, Package, PieChart as PieChartIcon, BarChart3,
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar,
} from "recharts";
import { Chart } from "react-google-charts";

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = { NOUVEAU: "Nouveau", ASSIGNE: "Assigné", EN_COURS: "En cours", TERMINE: "Terminé", A_REPRENDRE: "À reprendre", FERME: "Fermé" };
const STATUS_COLOR: Record<string, string> = { NOUVEAU: "#94A3B8", ASSIGNE: "#3B82F6", EN_COURS: "#FA5B07", TERMINE: "#10B981", A_REPRENDRE: "#F59E0B", FERME: "#64748B" };
const PRIORITY_LABEL: Record<string, string> = { CRITIQUE: "Critique", HAUTE: "Haute", MOYENNE: "Moyenne", BASSE: "Basse" };
const PRIORITY_COLOR: Record<string, string> = { CRITIQUE: "#EF4444", HAUTE: "#F59E0B", MOYENNE: "#3B82F6", BASSE: "#10B981" };
const TYPE_LABEL: Record<string, string> = { MAINT_CORRECTIVE: "Corrective", MAINT_PREVENTIVE: "Préventive", MAINT_AMELIORATIVE: "Améliorative", TRAVAUX_NEUFS: "Travaux neufs" };
const TYPE_COLOR: Record<string, string> = { MAINT_CORRECTIVE: "#EF4444", MAINT_PREVENTIVE: "#10B981", MAINT_AMELIORATIVE: "#3B82F6", TRAVAUX_NEUFS: "#8B5CF6" };
const DONUT_COLORS = ["#FA5B07", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmtH(hours: number): string {
  if (!hours) return "0H";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}H ${String(m).padStart(2, "0")}` : `${h}H`;
}
function fmtXAF(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M XAF`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K XAF`;
  return `${v.toFixed(0)} XAF`;
}
function fmtXAFShort(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${v.toFixed(0)}`;
}
function getDefaultRange() {
  const now = new Date();
  // Default: full current year (Jan 1 to today) to show all imported historical data
  return { dateDebut: new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0], dateFin: now.toISOString().split("T")[0] };
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      {label && <p className="font-semibold text-slate-700 mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }}>{p.name}: <span className="font-bold">{typeof p.value === "number" && p.value > 10000 ? fmtXAFShort(p.value) : p.value}</span></p>
      ))}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const { warning, error: toastError, info } = useToast();
  const [tickets, setTickets] = useState<any[]>([]);
  const [kpi, setKpi] = useState<any>(null);
  const [gmao, setGmao] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [gmaoLoading, setGmaoLoading] = useState(false);
  const [preventiveTasks, setPreventiveTasks] = useState<any[]>([]);
  const [supermarkets, setSupermarkets] = useState<any[]>([]);
  const [equipments, setEquipments] = useState<any[]>([]);

  const defaultRange = getDefaultRange();
  const [filterSm, setFilterSm] = useState("");
  const [filterEq, setFilterEq] = useState("");
  const [filterImputation, setFilterImputation] = useState("");
  const [filterDateDebut, setFilterDateDebut] = useState(defaultRange.dateDebut);
  const [filterDateFin, setFilterDateFin] = useState(defaultRange.dateFin);
  const [coutSiteView, setCoutSiteView] = useState<"donut" | "bar">("donut");

  const isAdmin = user?.role === "SUPER_ADMIN";
  const isMaintenancier = user?.role === "MAINTENANCIER";

  const loadGmao = useCallback((smId?: string, eqId?: string, debut?: string, fin?: string, imputation?: string) => {
    setGmaoLoading(true);
    api.getGmaoKpis({ supermarketId: smId || undefined, equipmentId: eqId || undefined, dateDebut: debut, dateFin: fin, imputation: imputation || undefined })
      .then(setGmao).catch(() => {}).finally(() => setGmaoLoading(false));
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem("gmao_user");
    if (!raw) { router.push("/login"); return; }
    const u = JSON.parse(raw);
    if (u.role === "USER") { router.replace("/demandeur"); return; }
    if (u.role === "MAINTENANCIER") { router.replace("/maintenancier"); return; }
    setUser(u);

    Promise.all([api.getTickets({}), api.getKpi(), api.getSupermarkets()])
      .then(([t, k, sms]) => {
        setTickets(t);
        setKpi(k);
        setSupermarkets(sms);
        const critiques = (t as any[]).filter((tk) => tk.priority === "CRITIQUE" && !["TERMINE", "FERME"].includes(tk.status));
        if (critiques.length > 0) {
          warning(`${critiques.length} ticket(s) critique(s) en attente`, "Une action immédiate est requise");
        } else if (t.length === 0) {
          info("Dashboard vide", "Aucun ticket enregistré pour le moment");
        }
      })
      .catch(() => {
        toastError("Erreur de chargement", "Impossible de charger le dashboard");
        router.push("/login");
      })
      .finally(() => setLoading(false));

    loadGmao("", "", defaultRange.dateDebut, defaultRange.dateFin, "");
  }, [router, loadGmao]);

  // Reload equipments when supermarket filter changes
  useEffect(() => {
    if (filterSm) {
      api.getEquipments({ supermarketId: filterSm }).then(setEquipments).catch(() => {});
    } else {
      setEquipments([]);
      setFilterEq("");
    }
  }, [filterSm]);

  const recent = tickets.slice(0, 5);
  const pendingTasks = preventiveTasks.filter((t: any) => t.status !== "EFFECTUE");

  const statusChartData = useMemo(() => {
    const groups: Record<string, number> = {};
    tickets.forEach((t) => { groups[t.status] = (groups[t.status] || 0) + 1; });
    return Object.entries(groups).map(([k, v]) => ({ name: STATUS_LABEL[k] || k, value: v, color: STATUS_COLOR[k] }));
  }, [tickets]);

  // Corps d'état cost data for horizontal bar
  const corpsEtatCostData = useMemo(() =>
    Object.entries(gmao?.costs?.byCorpsEtat ?? {})
      .map(([k, v]) => ({ name: k, value: v as number }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    [gmao]);

  // Dépense par site
  const coutSiteData = useMemo(() =>
    (gmao?.bySupermarket ?? []).map((s: any) => ({ name: s.code || s.nom, value: s.cout })),
    [gmao]);

  // Dépense par localisation
  const coutLocalisationData = useMemo(() =>
    Object.entries(gmao?.costs?.byLocalisation ?? {})
      .map(([k, v]) => ({ name: k, value: v as number }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    [gmao]);

  // Donut local
  const localisationData = useMemo(() =>
    (gmao?.byLocalisation ?? []).slice(0, 8).map((l: any, i: number) => ({ name: l.localisation, value: l.count, fill: DONUT_COLORS[i % DONUT_COLORS.length] })),
    [gmao]);

  // Donut CAPEX/OPEX
  const financeData = useMemo(() => {
    const capex = gmao?.costs?.capex ?? 0;
    const opex = gmao?.costs?.opex ?? 0;
    return [
      { name: "CAPEX", value: capex, fill: "#3B82F6" },
      { name: "OPEX", value: opex, fill: "#FA5B07" },
    ].filter((d) => d.value > 0);
  }, [gmao]);

  // Type de travaux cost
  const typeCostData = useMemo(() => {
    const d = gmao?.costs?.byTypeTravaux ?? {};
    return Object.entries(d)
      .map(([k, v]) => {
        const key = k === "corrective" ? "MAINT_CORRECTIVE" : k === "preventive" ? "MAINT_PREVENTIVE" : k === "ameliorative" ? "MAINT_AMELIORATIVE" : "TRAVAUX_NEUFS";
        return { name: TYPE_LABEL[key] || k, value: v as number, fill: TYPE_COLOR[key] || "#94A3B8" };
      })
      .filter((d) => d.value > 0);
  }, [gmao]);

  if (loading) return <Shell><div className="flex items-center justify-center py-24"><Loader2 size={32} className="animate-spin text-orange" /></div></Shell>;

  const dispo = gmao?.reliability?.disponibilite ?? 100;
  const dispoColor = dispo >= 95 ? "#10B981" : dispo >= 85 ? "#F59E0B" : "#EF4444";

  return (
    <Shell title={`Bonjour, ${user?.nom || "..."}`} subtitle="Suivi opérationnel des équipements — Analyse détaillée des performances et fiabilité">

      {/* ── Filtres ── */}
      <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
        <span className="text-[11px] font-semibold text-slate-500 mr-1">Filtres</span>
        {isAdmin && (
          <div className="relative">
            <select value={filterSm} onChange={(e) => { setFilterSm(e.target.value); setFilterEq(""); }}
              className="text-xs border border-slate-200 rounded-xl pl-3 pr-7 py-1.5 appearance-none bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange/30">
              <option value="">Tous les sites</option>
              {supermarkets.map((sm: any) => <option key={sm.id} value={sm.id}>{sm.nom}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        )}
        {filterSm && equipments.length > 0 && (
          <div className="relative">
            <select value={filterEq} onChange={(e) => setFilterEq(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl pl-3 pr-7 py-1.5 appearance-none bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange/30">
              <option value="">Tous les équipements</option>
              {equipments.map((eq: any) => <option key={eq.id} value={eq.id}>{eq.nom}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        )}
        {isAdmin && (
          <div className="relative">
            <select value={filterImputation} onChange={(e) => setFilterImputation(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl pl-3 pr-7 py-1.5 appearance-none bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange/30">
              <option value="">Toute imputation</option>
              <option value="PLAYCE">PLAYCE</option>
              <option value="ADIALEA">ADIALEA</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        )}
        <input type="date" value={filterDateDebut} onChange={(e) => setFilterDateDebut(e.target.value)}
          className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange/30" />
        <span className="text-slate-300 text-xs">→</span>
        <input type="date" value={filterDateFin} onChange={(e) => setFilterDateFin(e.target.value)}
          className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange/30" />
        <button onClick={() => loadGmao(filterSm, filterEq, filterDateDebut, filterDateFin, filterImputation)}
          disabled={gmaoLoading} className="btn-primary text-xs py-1.5 px-4 ml-auto">
          {gmaoLoading ? <Loader2 size={12} className="animate-spin" /> : "Actualiser"}
        </button>
      </div>

      {/* ── Ligne 1 : KPI cards (calquées sur le board Excel) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <TopCard label="Dépenses Totales" value={fmtXAF(gmao?.costs?.total ?? 0)} sub="Toutes interventions" color="orange" icon={<DollarSign size={18}/>} />
        <TopCard label="Interventions" value={gmao?.totalInterventions ?? 0} sub="Sur la période" color="blue" icon={<Wrench size={18}/>} />
        <TopCard label="En attente" value={gmao?.interventionEnAttente ?? 0} sub="NOUVEAU + ASSIGNÉ" color="amber" icon={<Clock size={18}/>} />
        <TopCard label="Maint. Corrective" value={gmao?.maintenanceCorrective ?? 0} sub={`${gmao?.maintenancePreventive ?? 0} préventive(s)`} color="red" icon={<AlertTriangle size={18}/>} />
        <TopCard label="Équip. impacté" value={gmao?.equipementPlusImpactant?.nom ?? "—"} sub={gmao?.equipementPlusImpactant ? `${gmao.equipementPlusImpactant.count} incidents` : "Aucun"} color="violet" icon={<Package size={18}/>} />
      </div>

      {/* ── Ligne 2 : Fiabilité (MTBF / MTTR / Dispo) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <ReliCard label="Disponibilité" value={`${gmao?.reliability?.disponibilite?.toFixed(2) ?? "100"}%`}
          color={dispo >= 95 ? "emerald" : dispo >= 85 ? "amber" : "red"} icon={<ShieldCheck size={18}/>}
          sub={`${gmao?.reliability?.nbPannes ?? 0} panne(s) enregistrée(s)`} />
        <ReliCard label="MTBF Global" value={fmtH(gmao?.reliability?.mtbfH ?? 0)} color="blue" icon={<TrendingUp size={18}/>}
          sub="Temps moyen entre pannes" />
        <ReliCard label="MTTR Global" value={fmtH(gmao?.reliability?.mttrH ?? 0)} color="violet" icon={<Zap size={18}/>}
          sub="Temps moyen de réparation" />
        <ReliCard label="Taux préventif" value={`${gmao?.preventive?.tauxTaches ?? 0}%`}
          color={(gmao?.preventive?.tauxTaches ?? 0) >= 80 ? "emerald" : "amber"} icon={<Activity size={18}/>}
          sub={`${gmao?.preventive?.realisees ?? 0}/${gmao?.preventive?.planifiees ?? 0} tâches`} />
      </div>

      {gmaoLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-orange" /></div>
      ) : !gmao ? (
        <div className="card text-center py-10 text-slate-400 text-xs">Impossible de charger les KPI GMAO</div>
      ) : (
        <>
          {/* ── Ligne 3 : Coût corps d'état + Intervention par site + Intervention par local ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">

            {/* Coût par corps d'état — barres horizontales */}
            <div className="card">
              <SectionTitle>Coût par corps d'état</SectionTitle>
              {corpsEtatCostData.length === 0 ? <Empty /> : (
                <div className="space-y-2 mt-2">
                  {corpsEtatCostData.map((d, i) => {
                    const max = corpsEtatCostData[0]?.value || 1;
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-slate-600 truncate max-w-[150px]">{d.name}</span>
                          <span className="font-bold text-slate-800 ml-2 shrink-0">{fmtXAFShort(d.value)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100">
                          <div className="h-1.5 rounded-full bg-orange transition-all" style={{ width: `${(d.value / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Intervention par site — barres verticales */}
            <div className="card">
              <SectionTitle>Intervention par site</SectionTitle>
              {gmao.bySupermarket?.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={gmao.bySupermarket?.map((s: any) => ({ name: s.code || s.nom?.split(" ").pop(), value: s.count }))} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Interventions" radius={[4, 4, 0, 0]} fill="#FA5B07" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Intervention par localisation — donut */}
            <div className="card">
              <SectionTitle>Intervention par Local</SectionTitle>
              {localisationData.length === 0 ? <Empty /> : (
                <div className="flex items-center gap-2">
                  <ResponsiveContainer width={110} height={140}>
                    <PieChart>
                      <Pie data={localisationData} cx="50%" cy="50%" innerRadius={30} outerRadius={52} dataKey="value" strokeWidth={0}>
                        {localisationData.map((d: any, i: number) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1 min-w-0">
                    {localisationData.map((d: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-[9px]">
                        <span className="flex items-center gap-1 min-w-0">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.fill }} />
                          <span className="text-slate-500 truncate">{d.name}</span>
                        </span>
                        <span className="font-bold text-slate-700 ml-1 shrink-0">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Ligne 4 : Dépense type travaux + Finance CAPEX/OPEX + Dépense par site ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">

            {/* Dépense par type de travaux */}
            <div className="card">
              <SectionTitle>Dépense par type de travaux</SectionTitle>
              {typeCostData.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={typeCostData} margin={{ top: 4, right: 0, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 8, fill: "#94A3B8" }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" />
                    <YAxis tick={{ fontSize: 8, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={fmtXAFShort} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Dépenses (XAF)" radius={[4, 4, 0, 0]}>
                      {typeCostData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Dépense par nature finance — CAPEX / OPEX donut */}
            <div className="card flex flex-col items-center justify-center">
              <SectionTitle>Dépense par nature finance</SectionTitle>
              {financeData.length === 0 ? <Empty /> : (
                <>
                  <div className="relative flex items-center justify-center my-1">
                    <ResponsiveContainer width={140} height={140}>
                      <PieChart>
                        <Pie data={financeData} cx="50%" cy="50%" innerRadius={38} outerRadius={62} dataKey="value" strokeWidth={0}>
                          {financeData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute text-center pointer-events-none">
                      <p className="text-lg font-black text-slate-900">{fmtXAFShort(gmao.costs?.total ?? 0)}</p>
                      <p className="text-[9px] text-slate-400">Total</p>
                    </div>
                  </div>
                  <div className="flex gap-4 text-[10px]">
                    {financeData.map((d, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ background: d.fill }} />
                        <span className="text-slate-500">{d.name}</span>
                        <span className="font-bold text-slate-700">{fmtXAFShort(d.value)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1">
                    CAPEX {gmao.costs?.total > 0 ? Math.round((gmao.costs.capex / gmao.costs.total) * 100) : 0}% · OPEX {gmao.costs?.total > 0 ? Math.round((gmao.costs.opex / gmao.costs.total) * 100) : 0}%
                  </p>
                </>
              )}
            </div>

            {/* Dépense par site */}
            <div className="card">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-bold text-slate-700">Dépense par site</h3>
                <button
                  onClick={() => setCoutSiteView(coutSiteView === "donut" ? "bar" : "donut")}
                  className="text-[9px] font-bold flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                  title={coutSiteView === "donut" ? "Voir en barres" : "Voir en camembert"}
                >
                  {coutSiteView === "donut" ? <BarChart3 size={13} /> : <PieChartIcon size={13} />}
                  {coutSiteView === "donut" ? "Barres" : "Camembert"}
                </button>
              </div>
              {coutSiteData.filter((d: any) => d.value > 0).length === 0 ? <Empty /> : coutSiteView === "donut" ? (
                <div className="flex items-center gap-2 mt-1">
                  <div style={{ width: '150px', height: '150px' }} className="-ml-3">
                    <Chart
                      chartType="PieChart"
                      data={[
                        ["Site", "Coût"],
                        ...coutSiteData.filter((d: any) => d.value > 0).map((d: any) => [d.name, d.value])
                      ]}
                      options={{
                        is3D: true,
                        legend: 'none',
                        backgroundColor: 'transparent',
                        chartArea: { left: 10, top: 10, width: '90%', height: '90%' },
                        colors: DONUT_COLORS,
                        pieSliceText: 'percentage',
                        pieSliceTextStyle: { fontSize: 9 }
                      }}
                      width="150px"
                      height="150px"
                    />
                  </div>
                  <div className="flex-1 space-y-1 min-w-0">
                    {coutSiteData.filter((d: any) => d.value > 0).map((d: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-[9px]">
                        <span className="flex items-center gap-1 min-w-0">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                          <span className="text-slate-500 truncate">{d.name}</span>
                        </span>
                        <span className="font-bold text-slate-700 ml-1 shrink-0">{fmtXAFShort(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 mt-2">
                  {coutSiteData.filter((d: any) => d.value > 0).map((d: any, i: number) => {
                    const max = Math.max(...coutSiteData.map((x: any) => x.value)) || 1;
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-slate-600 truncate max-w-[130px]">{d.name}</span>
                          <span className="font-bold text-slate-800 ml-2 shrink-0">{fmtXAFShort(d.value)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100">
                          <div className="h-1.5 rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Dépense par localisation — barres horizontales */}
          <div className="card mb-3">
            <SectionTitle>Dépense par localisation</SectionTitle>
            {coutLocalisationData.length === 0 ? <Empty /> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-2">
                {coutLocalisationData.map((d, i) => {
                  const max = coutLocalisationData[0]?.value || 1;
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-slate-600 truncate max-w-[200px]">{d.name}</span>
                        <span className="font-bold text-slate-800 ml-2 shrink-0">{fmtXAFShort(d.value)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100">
                        <div className="h-1.5 rounded-full bg-orange transition-all" style={{ width: `${(d.value / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Ligne 5 : Panel fiabilité + Disponibilité radial + Taux préventif ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">

            {/* Panel fiabilité — calqué sur la table en bas à droite du board Excel */}
            <div className="card">
              <SectionTitle>Fiabilité équipement</SectionTitle>
              <div className="mt-2 space-y-0">
                {[
                  { label: "Temps de fonctionnement", value: fmtH(gmao.reliability?.tempsFonctionnementH ?? 0), color: "#10B981" },
                  { label: "Temps d'arrêt", value: fmtH(gmao.reliability?.tempsArretH ?? 0), color: "#EF4444" },
                  { label: "Incidents enregistrés", value: gmao.reliability?.nbPannes ?? 0, color: "#F59E0B" },
                  { label: "MTTR", value: fmtH(gmao.reliability?.mttrH ?? 0), color: "#EF4444" },
                  { label: "MTBF", value: fmtH(gmao.reliability?.mtbfH ?? 0), color: "#10B981" },
                  { label: "Disponibilité", value: `${gmao.reliability?.disponibilite?.toFixed(2) ?? "100"}%`, color: dispoColor, bold: true },
                  { label: "Maintenance planifiée", value: gmao.preventive?.planifiees ?? 0, color: "#3B82F6" },
                  { label: "Maintenance réalisée", value: gmao.preventive?.realisees ?? 0, color: "#10B981" },
                  { label: "Respect des engagements", value: `${gmao.preventive?.tauxTaches ?? 0}%`, color: (gmao.preventive?.tauxTaches ?? 0) >= 80 ? "#10B981" : "#F59E0B", bold: true },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                    <span className="text-[10px] text-slate-500">{row.label}</span>
                    <span className={`text-[11px] font-${row.bold ? "black" : "semibold"} px-2 py-0.5 rounded-md`}
                      style={{ color: row.color, backgroundColor: row.color + "18" }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Disponibilité radial */}
            <div className="card flex flex-col items-center justify-center">
              <SectionTitle>Disponibilité globale</SectionTitle>
              <div className="relative flex items-center justify-center my-2">
                <ResponsiveContainer width={200} height={200}>
                  <RadialBarChart cx="50%" cy="50%" innerRadius="55%" outerRadius="75%" startAngle={90} endAngle={-270}
                    data={[{ value: dispo, fill: dispoColor }, { value: 100 - dispo, fill: "#F1F5F9" }]}>
                    <RadialBar dataKey="value" cornerRadius={10} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute text-center pointer-events-none">
                  <p className="text-xl font-black leading-tight" style={{ color: dispoColor }}>{dispo.toFixed(2)}%</p>
                  <p className="text-[10px] text-slate-400">Disponibilité</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center text-[10px] w-full">
                <div className="bg-red-50 rounded-xl py-2">
                  <p className="text-red-400">Arrêt</p>
                  <p className="font-black text-red-600 text-base">{fmtH(gmao.reliability?.tempsArretH ?? 0)}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl py-2">
                  <p className="text-emerald-400">Fonct.</p>
                  <p className="font-black text-emerald-600 text-base">{fmtH(gmao.reliability?.tempsFonctionnementH ?? 0)}</p>
                </div>
              </div>
            </div>

            {/* Corps d'état count — donut */}
            <div className="card">
              <SectionTitle>Interventions par corps d'état</SectionTitle>
              {gmao.byCorpsEtat?.length === 0 ? <Empty /> : (
                <div className="flex items-center gap-2 mt-1">
                  <ResponsiveContainer width={100} height={130}>
                    <PieChart>
                      <Pie data={gmao.byCorpsEtat?.slice(0, 6).map((g: any, i: number) => ({ ...g, fill: DONUT_COLORS[i] }))}
                        cx="50%" cy="50%" innerRadius={26} outerRadius={46} dataKey="count" strokeWidth={0}>
                        {gmao.byCorpsEtat?.slice(0, 6).map((_: any, i: number) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1 min-w-0">
                    {gmao.byCorpsEtat?.slice(0, 6).map((g: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-[9px]">
                        <span className="flex items-center gap-1 min-w-0">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: DONUT_COLORS[i] }} />
                          <span className="text-slate-500 truncate">{g.corpsEtat}</span>
                        </span>
                        <span className="font-bold text-slate-700 ml-1">{g.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Tickets récents ── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700">{isAdmin ? "Tickets récents" : "Mes tickets"}</h2>
          <div className="flex items-center gap-2">
            {!isAdmin && (
              <button onClick={() => router.push("/tickets/new")} className="btn-primary text-xs py-2 px-3">
                <PlusCircle size={13} /> Nouveau
              </button>
            )}
            <button onClick={() => router.push("/tickets")} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium transition-colors">
              Voir tous <ExternalLink size={11} />
            </button>
          </div>
        </div>
        <table className="w-full text-xs min-w-[450px]">
          <thead>
            <tr className="border-b border-slate-100">
              {["Ticket", "Priorité", "Statut", "Date"].map((h) => (
                <th key={h} className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-2.5 pr-4 first:pl-1">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {recent.map((t) => (
              <tr key={t.id} onClick={() => router.push(`/tickets/${t.id}`)} className="cursor-pointer hover:bg-slate-50 transition-colors">
                <td className="py-2.5 pr-4 pl-1 font-medium text-slate-800 max-w-[180px] truncate">{t.titre}</td>
                <td className="py-2.5 pr-4"><span className={`badge badge-${t.priority.toLowerCase()}`}>{PRIORITY_LABEL[t.priority]}</span></td>
                <td className="py-2.5 pr-4"><span className={`status-badge status-${t.status.toLowerCase()}`}>{STATUS_LABEL[t.status]}</span></td>
                <td className="py-2.5 text-slate-400 whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}</td>
              </tr>
            ))}
            {recent.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-slate-400 text-xs">Aucun ticket</td></tr>}
          </tbody>
        </table>
      </div>

      {/* ── Tâches préventives (maintenancier) ── */}
      {isMaintenancier && pendingTasks.length > 0 && (
        <div className="card mt-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Tâches préventives à venir</h2>
          <div className="space-y-2">
            {pendingTasks.slice(0, 5).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-600 truncate">{t.plan?.titre || t.id}</span>
                <span className="text-slate-400 shrink-0 ml-2">{new Date(t.dueDate).toLocaleDateString("fr-FR")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-bold text-slate-700 mb-1">{children}</h3>;
}
function Empty() {
  return <p className="text-[10px] text-slate-400 text-center py-6">Aucune donnée sur la période</p>;
}

function TopCard({ label, value, sub, color, icon }: { label: string; value: any; sub: string; color: string; icon: React.ReactNode }) {
  const p: Record<string, { bg: string; text: string }> = {
    orange: { bg: "bg-orange-50", text: "text-orange" },
    blue:   { bg: "bg-blue-50",   text: "text-blue-600" },
    amber:  { bg: "bg-amber-50",  text: "text-amber-500" },
    red:    { bg: "bg-red-50",    text: "text-red-500" },
    violet: { bg: "bg-violet-50", text: "text-violet-500" },
    emerald:{ bg: "bg-emerald-50",text: "text-emerald-600" },
  };
  const c = p[color] || p.blue;
  return (
    <div className="card py-3 flex justify-between items-start">
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-slate-500 truncate">{label}</p>
        <p className="text-xl font-black text-slate-900 leading-tight truncate mt-1">{value}</p>
        <p className="text-[9px] text-slate-400 mt-1 truncate">{sub}</p>
      </div>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${c.bg} ${c.text}`}>{icon}</div>
    </div>
  );
}

function ReliCard({ label, value, sub, color, icon }: { label: string; value: string; sub: string; color: string; icon: React.ReactNode }) {
  const p: Record<string, { bg: string; text: string }> = {
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600" },
    amber:   { bg: "bg-amber-50",   text: "text-amber-500" },
    red:     { bg: "bg-red-50",     text: "text-red-500" },
    blue:    { bg: "bg-blue-50",    text: "text-blue-500" },
    violet:  { bg: "bg-violet-50",  text: "text-violet-500" },
  };
  const c = p[color] || p.blue;
  return (
    <div className="card flex items-center gap-3 py-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${c.bg} ${c.text}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 truncate">{label}</p>
        <p className="text-xl font-black text-slate-900 leading-tight">{value}</p>
        <p className="text-[9px] text-slate-400 truncate">{sub}</p>
      </div>
    </div>
  );
}
