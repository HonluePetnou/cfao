"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import {
  Send, Loader2, BarChart2, Clock, TrendingUp, Zap,
  ArrowLeft, Wrench, CheckCircle2, ShieldAlert,
  Info
} from "lucide-react";
import { CORPS_ETAT_LIST } from "@/lib/constants";
import Combobox from "@/components/Combobox";

const PRIORITIES = [
  { key: "BASSE",    label: "Basse",    desc: "Peut attendre",   activeCls: "border-emerald-500 bg-emerald-500 text-white", inactiveCls: "border-emerald-200 text-emerald-700 bg-emerald-50/50", icon: BarChart2 },
  { key: "MOYENNE",  label: "Normale",  desc: "Traitement standard", activeCls: "border-amber-500 bg-amber-500 text-white",    inactiveCls: "border-amber-200 text-amber-700 bg-amber-50/50",    icon: Clock },
  { key: "HAUTE",    label: "Haute",    desc: "Assez urgent",    activeCls: "border-orange bg-orange text-white",             inactiveCls: "border-orange/30 text-orange bg-orange/5",          icon: TrendingUp },
  { key: "CRITIQUE", label: "Urgente",  desc: "Intervention immédiate", activeCls: "border-red-500 bg-red-500 text-white",     inactiveCls: "border-red-200 text-red-700 bg-red-50/50",          icon: Zap },
];

const TYPE_TRAVAUX = [
  { key: "MAINT_CORRECTIVE", label: "Maint. Corrective" },
  { key: "MAINT_PREVENTIVE", label: "Maint. Préventive" },
  { key: "MAINT_AMELIORATIVE", label: "Maint. Améliorative" },
  { key: "TRAVAUX_NEUFS", label: "Travaux neufs" }
];

export default function NouveauTicketMaintenancierPage() {
  const router = useRouter();
  const { success, error: toastError, warning } = useToast();
  const [user, setUser] = useState<any>(null);
  const [equipments, setEquipments] = useState<any[]>([]);
  const [maintenanciers, setMaintenanciers] = useState<any[]>([]);
  const [localisations, setLocalisations] = useState<any[]>([]);

  // Form states
  const [supermarketId, setSupermarketId] = useState("");
  const [supermarkets, setSupermarkets] = useState<any[]>([]);
  const [corpsEtat, setCorpsEtat] = useState("");
  const [localisation, setLocalisation] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [typeTravaux, setTypeTravaux] = useState("MAINT_CORRECTIVE");
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MOYENNE");
  const [maintenancierId, setMaintenancierId] = useState("");
  const [bypassFilter, setBypassFilter] = useState(false);

  // Status states
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Le maintenancier intervient sur tout le réseau (pas rattaché à un seul
  // supermarché) : le site doit donc être choisi explicitement à chaque
  // création de ticket, jamais déduit silencieusement d'un état de session
  // qui traîne (sinon une intervention peut être enregistrée sur le mauvais
  // site sans que personne ne s'en rende compte).
  const loadForSite = async (smId: string) => {
    const [eqs, locs] = await Promise.all([
      smId ? api.getEquipments({ supermarketId: smId }) : Promise.resolve([]),
      smId ? api.getLocalisations(smId) : Promise.resolve([]),
    ]);
    setEquipments(eqs);
    setLocalisations(locs);
  };

  const handleSiteChange = (smId: string) => {
    setSupermarketId(smId);
    setCorpsEtat("");
    setLocalisation("");
    setEquipmentId("");
    setBypassFilter(false);
    loadForSite(smId);
  };

  useEffect(() => {
    const raw = sessionStorage.getItem("gmao_user");
    if (!raw) { router.replace("/login"); return; }
    const u = JSON.parse(raw);
    if (u.role !== "MAINTENANCIER") { router.replace("/tickets/new"); return; }
    setUser(u);

    const loadData = async () => {
      try {
        const [sms, mains] = await Promise.all([
          api.getSupermarkets().catch(() => []),
          api.getMaintenanciers(),
        ]);
        setSupermarkets(sms);
        setMaintenanciers(mains);
        const self = mains.find((m: any) => m.id === u.id);
        if (self) {
          setMaintenancierId(self.id);
        } else if (mains.length > 0) {
          setMaintenancierId(mains[0].id);
        }
      } catch {}
      finally {
        setLoading(false);
      }
    };
    loadData();
  }, [router]);

  // Le formulaire d'un équipement créé pendant que cette page était déjà
  // ouverte doit apparaître sans recharger manuellement : on rafraîchit la
  // liste dès que l'onglet redevient actif.
  useEffect(() => {
    const onFocus = () => { if (supermarketId) loadForSite(supermarketId); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [supermarketId]);

  // Dynamically filter equipments in frontend to improve data entry quality
  const filteredEquipments = useMemo(() => {
    if (bypassFilter) return equipments;
    let list = [...equipments];
    if (corpsEtat) {
      list = list.filter((eq) => !eq.corpsEtat || eq.corpsEtat === corpsEtat);
    }
    if (localisation) {
      list = list.filter((eq) => !eq.localisation?.nom || eq.localisation.nom === localisation);
    }
    return list;
  }, [equipments, corpsEtat, localisation, bypassFilter]);

  // If filtered list changes and currently selected equipment is no longer in list, reset selected equipment
  useEffect(() => {
    if (equipmentId && !filteredEquipments.some((eq) => eq.id === equipmentId)) {
      setEquipmentId("");
    }
  }, [filteredEquipments, equipmentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supermarketId || !equipmentId || !titre.trim() || !maintenancierId || !corpsEtat || !localisation) {
      warning("Champs manquants", "Veuillez remplir tous les champs obligatoires (*)");
      setError("Veuillez remplir tous les champs obligatoires (*).");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await api.createTicket({
        titre: titre.trim(),
        description: description.trim(),
        priority,
        equipmentId,
        assignedMaintenancierId: maintenancierId,
        localisation,
        corpsEtat,
        typeTravaux,
      });
      success("Intervention créée !", "Le ticket a été créé et assigné avec succès");
      setSubmitted(true);
    } catch {
      toastError("Erreur d'envoi", "Impossible de créer l'intervention. Vérifiez votre connexion.");
      setError("Erreur lors de l'envoi de la demande. Veuillez vérifier votre connexion.");
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500 shadow-2xl shadow-emerald-500/30 mb-5"
          style={{ animation: "popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}
        >
          <CheckCircle2 size={38} className="text-white" />
        </div>
        <h1 className="text-xl font-black text-slate-800 mb-2">Intervention créée !</h1>
        <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
          Le ticket d'intervention a été créé et assigné avec succès.
        </p>
        <button
          onClick={() => router.push("/maintenancier")}
          className="mt-8 flex items-center gap-2 bg-navy text-white font-bold rounded-2xl px-7 py-3.5 shadow-lg hover:opacity-90 transition-opacity"
        >
          Retour à mes interventions
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-orange flex items-center justify-center shadow-lg shadow-orange/30">
            <Loader2 size={22} className="text-white animate-spin" />
          </div>
          <p className="text-slate-400 text-sm">Chargement des données...</p>
        </div>
      </div>
    );
  }

  const canSubmit = !!supermarketId && !!equipmentId && !!titre.trim() && !!maintenancierId && !!corpsEtat && !!localisation && !submitting;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => router.push("/maintenancier")}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors shrink-0"
          >
            <ArrowLeft size={17} className="text-slate-700" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-slate-800 leading-tight">Nouvelle intervention</h1>
            <p className="text-[10px] text-slate-400">
              {user?.supermarket?.nom || "Signaler un problème"}
            </p>
          </div>
          <div className="h-9 w-9 rounded-xl bg-orange/10 flex items-center justify-center">
            <Wrench size={16} className="text-orange" />
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-slate-100">
          <div
            className="h-full bg-orange transition-all duration-500"
            style={{
              width: `${Math.min(100, (
                (supermarketId ? 10 : 0) +
                (corpsEtat ? 15 : 0) +
                (localisation ? 15 : 0) +
                (equipmentId ? 15 : 0) +
                (typeTravaux ? 5 : 0) +
                (titre.trim() ? 20 : 0) +
                (priority ? 10 : 0) +
                (maintenancierId ? 10 : 0)
              ))}%`,
            }}
          />
        </div>
      </header>

      {/* ── FORMULAIRE ── */}
      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 py-5 pb-32 space-y-4">

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl p-4">
            {error}
          </div>
        )}

        {/* ── Section 1: Site ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 pt-4 pb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange text-white text-[10px] font-black">1</span>
            <h2 className="text-sm font-bold text-slate-800">Site concerné</h2>
          </div>
          <div className="p-4">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
              Supermarché <span className="text-red-500">*</span>
            </label>
            <select
              value={supermarketId}
              onChange={(e) => handleSiteChange(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/10 transition-all"
            >
              <option value="">Sélectionner le site...</option>
              {supermarkets.map((s: any) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
            <p className="text-[10px] text-slate-400 mt-1.5">
              Vous intervenez sur tout le réseau — précisez toujours le site concerné par cette intervention.
            </p>
          </div>
        </div>

        {/* ── Section 2: Localisation & Equipement ── */}
        <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden transition-opacity ${!supermarketId ? "opacity-50 pointer-events-none" : ""}`}>
          <div className="px-4 pt-4 pb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange text-white text-[10px] font-black">2</span>
            <h2 className="text-sm font-bold text-slate-800">Localisation & Équipement</h2>
          </div>
          <div className="p-4 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Corps d'état <span className="text-red-500">*</span>
              </label>
              <Combobox
                value={corpsEtat}
                onChange={setCorpsEtat}
                required
                disabled={!supermarketId}
                placeholder="Rechercher un corps d'état..."
                options={CORPS_ETAT_LIST.map((ce) => ({ value: ce, label: ce }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Zone / Localisation <span className="text-red-500">*</span>
              </label>
              <Combobox
                value={localisation}
                onChange={setLocalisation}
                required
                disabled={!supermarketId}
                placeholder="Rechercher une zone..."
                options={localisations.map((loc: any) => ({ value: loc.nom, label: loc.nom }))}
              />
            </div>

            <div className="pt-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide flex justify-between items-center">
                <span>Équipement concerné <span className="text-red-500">*</span></span>
                {bypassFilter && (
                  <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded">
                    Tous affichés
                  </span>
                )}
              </label>
              <Combobox
                value={equipmentId}
                onChange={setEquipmentId}
                required
                disabled={!supermarketId}
                placeholder="Rechercher un équipement..."
                emptyMessage="Aucun équipement ne correspond"
                options={filteredEquipments.map((eq: any) => ({
                  value: eq.id,
                  label: eq.nom,
                  sublabel: eq.corpsEtat ? `(${eq.corpsEtat.split(" ")[0]})` : "(non classé)",
                }))}
              />

              {/* Dynamic filter feedback */}
              {!bypassFilter && (corpsEtat || localisation) && filteredEquipments.length === 0 && (
                <div className="mt-2 flex items-start gap-1.5 p-2.5 rounded-xl bg-amber-50/70 border border-amber-100 text-[11px] text-amber-800 leading-normal">
                  <Info size={13} className="shrink-0 mt-0.5" />
                  <div>
                    Aucun équipement de type <b>{corpsEtat || "tout"}</b> n'est enregistré dans la zone <b>{localisation || "tout"}</b>.
                    <button
                      type="button"
                      onClick={() => setBypassFilter(true)}
                      className="block mt-1 font-bold underline hover:text-amber-900 text-left"
                    >
                      Désactiver le filtre et afficher tous les équipements
                    </button>
                  </div>
                </div>
              )}

              {/* Reset filter options if bypassed */}
              {bypassFilter && (
                <button
                  type="button"
                  onClick={() => setBypassFilter(false)}
                  className="mt-1.5 text-[11px] text-orange font-bold hover:underline"
                >
                  Réactiver le filtre intelligent
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 3: Type de travaux & Priorité ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 pt-4 pb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange text-white text-[10px] font-black">3</span>
            <h2 className="text-sm font-bold text-slate-800">Type de travaux & Priorité</h2>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Type de travaux <span className="text-red-500">*</span>
              </label>
              <select
                value={typeTravaux}
                onChange={(e) => setTypeTravaux(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/10 transition-all"
              >
                {TYPE_TRAVAUX.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2.5 uppercase tracking-wide">
                Niveau d'urgence <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRIORITIES.map((p) => {
                  const Icon = p.icon;
                  const active = priority === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPriority(p.key)}
                      className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 transition-all text-left ${active ? p.activeCls : p.inactiveCls}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon size={14} />
                        <span className="text-xs font-bold">{p.label}</span>
                      </div>
                      <span className={`text-[10px] leading-tight ${active ? "opacity-80" : "opacity-60"}`}>
                        {p.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 4: Description du problème ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 pt-4 pb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange text-white text-[10px] font-black">4</span>
            <h2 className="text-sm font-bold text-slate-800">Détails de la demande</h2>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Titre du problème <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                required
                maxLength={120}
                placeholder="Ex : Panne compresseur chambre froide"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/10 transition-all placeholder:text-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Description détaillée
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="Décrivez le problème plus en détail : symptômes, impacts..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/10 transition-all resize-none placeholder:text-slate-300"
              />
              <p className="text-right text-[10px] text-slate-400 mt-1">{description.length}/500</p>
            </div>
          </div>
        </div>

        {/* ── Section 5: Technicien affecté ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 pt-4 pb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange text-white text-[10px] font-black">5</span>
            <h2 className="text-sm font-bold text-slate-800">Assignation du technicien <span className="text-red-500">*</span></h2>
          </div>
          <div className="p-4">
            {maintenanciers.length === 0 ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-800 text-xs border border-red-100">
                <ShieldAlert size={16} />
                <span>Aucun technicien disponible.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {maintenanciers.map((m: any) => (
                  <label
                    key={m.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${maintenancierId === m.id ? "border-orange bg-orange/5" : "border-slate-200 hover:border-slate-300 bg-white"}`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-white text-sm font-bold">
                      {m.nom[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {m.nom} {m.id === user?.id ? "(Moi)" : ""}
                      </p>
                      <p className="text-[10px] text-emerald-600 font-medium">Disponible</p>
                    </div>
                    <input
                      type="radio"
                      name="maintenancier"
                      value={m.id}
                      checked={maintenancierId === m.id}
                      onChange={() => setMaintenancierId(m.id)}
                      className="accent-orange h-4 w-4 shrink-0"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

      </form>

      {/* ── BOUTON SUBMIT FIXE EN BAS ── */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <button
          type="button"
          onClick={handleSubmit as any}
          disabled={!canSubmit}
          className="w-full flex items-center justify-center gap-2.5 bg-orange hover:bg-orange/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-2xl py-4 text-sm transition-all shadow-lg shadow-orange/20 active:scale-98"
        >
          {submitting ? (
            <><Loader2 size={18} className="animate-spin" /> Création...</>
          ) : (
            <><Send size={18} /> Créer l'intervention</>
          )}
        </button>
        {!canSubmit && !submitting && (
          <p className="text-center text-[10px] text-slate-400 mt-2">
            {!supermarketId ? "Sélectionnez le site concerné (*)" :
             !localisation ? "Sélectionnez une zone (*)" :
             !corpsEtat ? "Sélectionnez un corps d'état (*)" :
             !equipmentId ? "Sélectionnez un équipement (*)" :
             !titre.trim() ? "Ajoutez un titre (*)" :
             !maintenancierId ? "Sélectionnez un technicien (*)" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
