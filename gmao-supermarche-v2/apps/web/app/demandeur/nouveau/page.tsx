"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import {
  Send, Loader2, BarChart2, Clock, TrendingUp, Zap,
  ArrowLeft, Wrench, CheckCircle2, MapPin, ShieldAlert,
  Info
} from "lucide-react";

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

const CORPS_ETAT_LIST = [
  "Climatisation / Ventilation",
  "Électricité courant fort",
  "Électricité courant faible",
  "Équipement de production",
  "Froid alimentaire",
  "Génie civil / Bâtiment",
  "Mécanique",
  "Moyens de secours",
  "Plomberie industrielle",
  "Plomberie sanitaire",
];

export default function NouveauTicketDemandeurPage() {
  const router = useRouter();
  const { success, error: toastError, warning } = useToast();
  const [user, setUser] = useState<any>(null);
  const [equipments, setEquipments] = useState<any[]>([]);
  const [maintenanciers, setMaintenanciers] = useState<any[]>([]);
  const [localisations, setLocalisations] = useState<any[]>([]);

  // Form states
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

  useEffect(() => {
    const raw = sessionStorage.getItem("gmao_user");
    if (!raw) { router.replace("/login"); return; }
    const u = JSON.parse(raw);
    if (u.role !== "USER") { router.replace("/tickets/new"); return; }
    setUser(u);

    const loadData = async () => {
      try {
        let smId = u.supermarketId || (typeof window !== "undefined" ? sessionStorage.getItem("gmao_current_supermarket") : null);
        if (!smId) {
          const sms = await api.getSupermarkets().catch(() => []);
          if (sms.length > 0) {
            smId = sms[0].id;
            if (typeof window !== "undefined") {
              sessionStorage.setItem("gmao_current_supermarket", smId);
            }
          }
        }

        const [eqs, locs, mains] = await Promise.all([
          smId ? api.getEquipments({ supermarketId: smId }) : api.getEquipments(),
          smId ? api.getLocalisations(smId) : Promise.resolve([]),
          api.getMaintenanciers(),
        ]);

        setEquipments(eqs);
        setLocalisations(locs);
        setMaintenanciers(mains);
        if (mains.length > 0) {
          setMaintenancierId(mains[0].id);
        }
      } catch {}
      finally {
        setLoading(false);
      }
    };
    loadData();
  }, [router]);

  // Dynamically filter equipments in frontend to improve data entry quality
  const filteredEquipments = useMemo(() => {
    if (bypassFilter) return equipments;
    let list = [...equipments];
    if (corpsEtat) {
      list = list.filter((eq) => eq.corpsEtat === corpsEtat);
    }
    if (localisation) {
      list = list.filter((eq) => eq.localisation?.nom === localisation);
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
    if (!equipmentId || !titre.trim() || !maintenancierId || !corpsEtat || !localisation) {
      warning("Champs manquants", "Veuillez remplir tous les champs obligatoires (*)");
      setError("Veuillez remplir tous les champs obligatoires (*).");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      // Normalise typeTravaux values to match new database normalized schema
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
      success("Ticket créé !", "Votre demande a été envoyée avec succès");
      setSubmitted(true);
    } catch {
      toastError("Erreur d'envoi", "Impossible de créer le ticket. Vérifiez votre connexion.");
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
        <h1 className="text-xl font-black text-slate-800 mb-2">Demande envoyée !</h1>
        <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
          Votre demande d'intervention a été enregistrée avec succès. L'équipe de maintenance a été notifiée.
        </p>
        <button
          onClick={() => router.push("/demandeur")}
          className="mt-8 flex items-center gap-2 bg-navy text-white font-bold rounded-2xl px-7 py-3.5 shadow-lg hover:opacity-90 transition-opacity"
        >
          Retour à l'accueil
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

  const canSubmit = !!equipmentId && !!titre.trim() && !!maintenancierId && !!corpsEtat && !!localisation && !submitting;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => router.push("/demandeur")}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors shrink-0"
          >
            <ArrowLeft size={17} className="text-slate-700" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-slate-800 leading-tight">Nouvelle demande</h1>
            <p className="text-[10px] text-slate-400">
              {user?.supermarket?.nom || "Signaler un problème"}
            </p>
          </div>
          <div className="h-9 w-9 rounded-xl bg-orange/10 flex items-center justify-center">
            <Wrench size={16} className="text-orange" />
          </div>
        </div>

        {/* Barre de progression */}
        <div className="h-0.5 bg-slate-100">
          <div
            className="h-full bg-orange transition-all duration-500"
            style={{
              width: `${Math.min(100, (
                (corpsEtat ? 15 : 0) +
                (localisation ? 15 : 0) +
                (equipmentId ? 20 : 0) +
                (typeTravaux ? 10 : 0) +
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

        {/* ── Section 1: Localisation & Equipement ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 pt-4 pb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange text-white text-[10px] font-black">1</span>
            <h2 className="text-sm font-bold text-slate-800">Localisation & Équipement</h2>
          </div>
          <div className="p-4 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Corps d'état <span className="text-red-500">*</span>
              </label>
              <select
                value={corpsEtat}
                onChange={(e) => setCorpsEtat(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/10 transition-all"
              >
                <option value="">Sélectionner le corps d'état...</option>
                {CORPS_ETAT_LIST.map((ce) => (
                  <option key={ce} value={ce}>{ce}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Zone / Localisation <span className="text-red-500">*</span>
              </label>
              <select
                value={localisation}
                onChange={(e) => setLocalisation(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/10 transition-all"
              >
                <option value="">Sélectionner la zone...</option>
                {localisations.map((loc: any) => (
                  <option key={loc.id} value={loc.nom}>{loc.nom}</option>
                ))}
              </select>
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
              <select
                value={equipmentId}
                onChange={(e) => setEquipmentId(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/10 transition-all"
              >
                <option value="">
                  {filteredEquipments.length === 0 ? "Aucun équipement ne correspond" : "Sélectionner l'équipement..."}
                </option>
                {filteredEquipments.map((eq: any) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.nom} {eq.corpsEtat ? `(${eq.corpsEtat.split(" ")[0]})` : ""}
                  </option>
                ))}
              </select>

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

        {/* ── Section 2: Type de travaux & Priorité ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 pt-4 pb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange text-white text-[10px] font-black">2</span>
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

        {/* ── Section 3: Description du problème ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 pt-4 pb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange text-white text-[10px] font-black">3</span>
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
                placeholder="Ex : Fuite d'eau dans la réserve"
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

        {/* ── Section 4: Maintenancier affecté ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 pt-4 pb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange text-white text-[10px] font-black">4</span>
            <h2 className="text-sm font-bold text-slate-800">Technicien / Prestataire affecté <span className="text-red-500">*</span></h2>
          </div>
          <div className="p-4">
            {maintenanciers.length === 0 ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-800 text-xs border border-red-100">
                <ShieldAlert size={16} />
                <span>Aucun technicien de maintenance disponible sur le réseau.</span>
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
                      <p className="text-sm font-semibold text-slate-800 truncate">{m.nom}</p>
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
            <><Loader2 size={18} className="animate-spin" /> Envoi en cours...</>
          ) : (
            <><Send size={18} /> Envoyer la demande</>
          )}
        </button>
        {!canSubmit && !submitting && (
          <p className="text-center text-[10px] text-slate-400 mt-2">
            {!localisation ? "Sélectionnez une zone (*)" :
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
