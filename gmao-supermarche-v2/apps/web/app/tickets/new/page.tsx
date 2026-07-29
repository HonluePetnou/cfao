"use client";
import Shell from "@/components/Shell";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Send, Loader2, BarChart2, Clock, TrendingUp, Zap, ArrowLeft } from "lucide-react";

const PRIORITIES = [
  { key: "BASSE",    label: "Basse",    activeCls: "bg-emerald-500 border-emerald-500 text-white",  inactiveCls: "border-emerald-300 text-emerald-600 hover:bg-emerald-50", icon: BarChart2 },
  { key: "MOYENNE",  label: "Moyenne",  activeCls: "bg-amber-500 border-amber-500 text-white",      inactiveCls: "border-amber-300 text-amber-600 hover:bg-amber-50",     icon: Clock },
  { key: "HAUTE",    label: "Haute",    activeCls: "bg-orange border-orange text-white",             inactiveCls: "border-orange/50 text-orange hover:bg-orange-50",       icon: TrendingUp },
  { key: "CRITIQUE", label: "Critique", activeCls: "bg-red-500 border-red-500 text-white",           inactiveCls: "border-red-400 text-red-600 hover:bg-red-50",           icon: Zap },
];
const TYPE_TRAVAUX = ["Maint. Corrective", "Maint. Préventive", "Maint. Améliorative", "Travaux neufs"];
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
  "Plomberie sanitaire"
];

export default function NewTicketPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [equipments, setEquipments] = useState<any[]>([]);
  const [maintenanciers, setMaintenanciers] = useState<any[]>([]);
  const [supermarkets, setSupermarkets] = useState<any[]>([]);
  const [selectedSmId, setSelectedSmId] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [maintenancierId, setMaintenancierId] = useState("");
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MOYENNE");
  const [localisation, setLocalisation] = useState("");
  const [localisations, setLocalisations] = useState<any[]>([]);
  const [corpsEtat, setCorpsEtat] = useState("");
  const [typeTravaux, setTypeTravaux] = useState("Maint. Corrective");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const raw = sessionStorage.getItem("gmao_user");
    if (!raw) { router.push("/login"); return; }
    const u = JSON.parse(raw);
    setUser(u);

    if (u.role === "USER") {
      router.replace("/demandeur/nouveau");
      return;
    }
    if (u.role === "MAINTENANCIER") {
      router.replace("/maintenancier/nouveau");
      return;
    }

    api.getMaintenanciers().then(setMaintenanciers).catch(() => {});

    // Admin: choisir le supermarché (par défaut celui actif dans le topbar)
    const currentSm = typeof window !== "undefined" ? sessionStorage.getItem("gmao_current_supermarket") : null;
    api.getSupermarkets()
      .then((sms) => {
        setSupermarkets(sms);
        if (currentSm && sms.some((s: any) => s.id === currentSm)) {
          setSelectedSmId(currentSm);
          api.getEquipments({ supermarketId: currentSm }).then(setEquipments).catch(() => {});
          api.getLocalisations(currentSm).then(setLocalisations).catch(() => {});
        } else {
          api.getEquipments().then(setEquipments).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const handleSmChange = async (smId: string) => {
    setSelectedSmId(smId);
    setEquipmentId("");
    setLocalisation("");
    if (smId) {
      const eqs = await api.getEquipments({ supermarketId: smId }).catch(() => []);
      setEquipments(eqs);
      const locs = await api.getLocalisations(smId).catch(() => []);
      setLocalisations(locs);
    } else {
      const eqs = await api.getEquipments().catch(() => []);
      setEquipments(eqs);
      setLocalisations([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipmentId || !maintenancierId || !titre) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await api.createTicket({
        titre,
        description,
        priority,
        equipmentId,
        assignedMaintenancierId: maintenancierId,
        localisation,
        corpsEtat,
        typeTravaux,
      });
      const redirectTo = user?.role === "USER" ? "/demandeur" : user?.role === "MAINTENANCIER" ? "/maintenancier" : "/tickets";
      router.push(redirectTo);
    } catch {
      setError("Erreur lors de la création du ticket.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Shell><div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-orange" /></div></Shell>;
  }

  return (
    <Shell title="Nouvelle demande d'intervention" subtitle="Signaler une panne ou un besoin de maintenance">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-4">
          <ArrowLeft size={15} /> Retour
        </button>

        {error && <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 mb-4 text-sm text-orange">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-bold text-navy mb-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange" />
              Supermarché <span className="text-orange">*</span>
            </h3>
            <select value={selectedSmId} onChange={(e) => handleSmChange(e.target.value)} required className="select">
              <option value="">Sélectionner un supermarché...</option>
              {supermarkets.map((s: any) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </div>

          <div className="card">
            <h3 className="text-sm font-bold text-navy mb-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange" />
              Informations générales
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-navy mb-1.5">Corps d'état <span className="text-orange">*</span></label>
                <select value={corpsEtat} onChange={(e) => setCorpsEtat(e.target.value)} required className="select">
                  <option value="">Sélectionner...</option>
                  {CORPS_ETAT_LIST.map((ce) => <option key={ce} value={ce}>{ce}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1.5">Localisation <span className="text-orange">*</span></label>
                <select value={localisation} onChange={(e) => setLocalisation(e.target.value)} required className="select">
                  <option value="">Sélectionner...</option>
                  {localisations.map((loc: any) => (
                    <option key={loc.id} value={loc.nom}>{loc.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1.5">Type de travaux <span className="text-orange">*</span></label>
                <select value={typeTravaux} onChange={(e) => setTypeTravaux(e.target.value)} className="select">
                  {TYPE_TRAVAUX.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1.5">Équipement concerné <span className="text-orange">*</span></label>
                <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} required className="select">
                  <option value="">Sélectionner...</option>
                  {equipments.map((eq: any) => <option key={eq.id} value={eq.id}>{eq.nom}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-bold text-navy mb-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange" />
              Description du problème
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-navy mb-1.5">Titre <span className="text-orange">*</span></label>
                <input type="text" value={titre} onChange={(e) => setTitre(e.target.value)} required placeholder="Ex : Fuite d'eau chambre froide" className="input" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1.5">Description détaillée</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 500))} rows={3} placeholder="Décrivez le problème..." className="input resize-none" />
                <p className="text-right text-xs text-slate-400 mt-1">{description.length}/500</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-bold text-navy mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange" />
              Niveau de priorité <span className="text-orange">*</span>
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {PRIORITIES.map((p) => (
                <button key={p.key} type="button" onClick={() => setPriority(p.key)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 px-2 text-xs font-bold transition-all ${priority === p.key ? p.activeCls : `${p.inactiveCls} bg-white`}`}
                >
                  <p.icon size={18} /> {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-bold text-navy mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange" />
              Assigner à un maintenancier <span className="text-orange">*</span>
            </h3>
            {maintenanciers.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Aucun maintenancier disponible</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {maintenanciers.map((m: any) => (
                  <label key={m.id} className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${maintenancierId === m.id ? "border-orange bg-orange/5" : "border-slate-200 hover:border-slate-300 bg-white"}`}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-white text-sm font-bold shadow-sm">{m.nom[0]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{m.nom}</p>
                      <p className="text-xs text-emerald-600 font-medium">● Disponible</p>
                    </div>
                    <input type="radio" name="maintenancier" value={m.id} checked={maintenancierId === m.id} onChange={() => setMaintenancierId(m.id)} className="accent-orange h-4 w-4 shrink-0" />
                  </label>
                ))}
              </div>
            )}
          </div>

          <button type="submit" disabled={submitting || !equipmentId || !maintenancierId || !titre}
            className="w-full flex items-center justify-center gap-2 bg-orange text-white font-bold rounded-2xl py-4 text-base hover:bg-orange-600 transition-colors disabled:opacity-50 shadow-lg shadow-orange/25"
          >
            {submitting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            {submitting ? "Envoi en cours..." : "Envoyer la demande d'intervention"}
          </button>
        </form>
      </div>
    </Shell>
  );
}
