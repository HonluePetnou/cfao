"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import {
  ClipboardList, Loader2, CheckCircle2, XCircle,
  ChevronLeft, Save, AlertTriangle, Store, ChevronRight,
} from "lucide-react";

type CheckEquipement = { nom: string; "09h": string; "15h": string; observation: string };
type CheckZone = { zone: string; equipements: CheckEquipement[] };

const STATUS_OPTIONS = ["", "OK", "NOK"];
const STATUS_COLORS: Record<string, string> = {
  "": "bg-slate-100 text-slate-400",
  OK: "bg-emerald-500 text-white",
  NOK: "bg-red-500 text-white",
};

export default function RondePage() {
  const router = useRouter();
  const { success, error: toastError, warning } = useToast();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 : supermarché selection
  const [step, setStep] = useState<"select_supermarket" | "ronde">("select_supermarket");
  const [supermarkets, setSupermarkets] = useState<any[]>([]);
  const [supermarketId, setSupermarketId] = useState("");
  const [supermarketNom, setSupermarketNom] = useState("");

  // Step 2 : ronde data
  const [checks, setChecks] = useState<CheckZone[]>([]);
  const [observations, setObservations] = useState("");
  const [date] = useState(new Date().toISOString().split("T")[0]);
  const [configMissing, setConfigMissing] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("gmao_user");
    if (!raw) { router.replace("/login"); return; }
    const u = JSON.parse(raw);
    if (!["MAINTENANCIER", "SUPER_ADMIN"].includes(u.role)) {
      router.replace("/dashboard");
      return;
    }
    setUser(u);

    // Load list of supermarkets for selection
    api.getSupermarkets()
      .then((sms: any[]) => {
        setSupermarkets(sms);
        // If maintenancier is bound to a single supermarket, skip selection
        if (u.supermarketId) {
          const sm = sms.find((s: any) => s.id === u.supermarketId);
          if (sm) {
            handleSelectSupermarket(sm.id, sm.nom);
            return;
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  const handleSelectSupermarket = async (smId: string, smNom: string) => {
    setSupermarketId(smId);
    setSupermarketNom(smNom);
    setConfigMissing(false);
    setConfigLoading(true);
    setLoading(false);

    try {
      const cfg = await api.getRondeConfig(smId).catch(() => null);
      if (!cfg?.zones) {
        setConfigMissing(true);
        setStep("ronde");
        return;
      }
      const zones: { zone: string; equipements: string[] }[] = JSON.parse(cfg.zones);
      const initialChecks: CheckZone[] = zones.map(z => ({
        zone: z.zone,
        equipements: z.equipements.map(nom => ({ nom, "09h": "", "15h": "", observation: "" })),
      }));
      setChecks(initialChecks);
      setStep("ronde");
    } catch {
      setConfigMissing(true);
      setStep("ronde");
    } finally {
      setConfigLoading(false);
    }
  };

  const updateCheck = (
    zoneIdx: number,
    eqIdx: number,
    field: "09h" | "15h" | "observation",
    value: string
  ) => {
    setChecks(prev => prev.map((z, zi) =>
      zi !== zoneIdx ? z : {
        ...z,
        equipements: z.equipements.map((eq, ei) =>
          ei !== eqIdx ? eq : { ...eq, [field]: value }
        ),
      }
    ));
  };

  const handleSubmit = async () => {
    const nokItems = checks.flatMap(z => z.equipements).filter(e => e["09h"] === "NOK" || e["15h"] === "NOK");
    if (nokItems.length > 0) {
      warning(
        `${nokItems.length} anomalie(s) détectée(s)`,
        "Vous pouvez quand même soumettre. Pensez à créer des tickets pour les équipements NOK."
      );
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setSubmitting(true);
    try {
      await api.createRonde({
        date,
        supermarketId,
        maintenancierId: user?.id,
        checks,
        observationsGenerales: observations,
      });
      success("Ronde enregistrée ✅", "La ronde journalière a été soumise avec succès.");
      setTimeout(() => router.back(), 1200);
    } catch {
      toastError("Erreur", "Impossible d'enregistrer la ronde. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading initial ──────────────────────────────────────
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

  // ── Step 1 : Sélection du supermarché ───────────────────
  if (step === "select_supermarket") {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-100 sticky top-0 z-20 px-4 py-3 flex items-center gap-3 shadow-sm">
          <button onClick={() => router.back()} className="h-8 w-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <ChevronLeft size={16} className="text-slate-600" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 text-sm leading-tight">Nouvelle ronde</p>
            <p className="text-[10px] text-slate-400">
              {new Date(date).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" })}
            </p>
          </div>
          <div className="h-7 w-7 rounded-lg bg-orange/10 flex items-center justify-center">
            <ClipboardList size={14} className="text-orange" />
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 pt-6 space-y-4">
          <div className="bg-orange/5 border border-orange/15 rounded-2xl p-4">
            <p className="text-xs text-orange font-semibold mb-1">Étape 1 / 2</p>
            <p className="text-sm font-bold text-slate-800">Sélectionner le supermarché</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Choisissez le site pour lequel vous effectuez la ronde journalière.
            </p>
          </div>

          {supermarkets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
              <AlertTriangle size={32} className="mx-auto text-amber-400 mb-3" />
              <p className="text-sm font-semibold text-slate-700">Aucun supermarché disponible</p>
              <p className="text-xs text-slate-400 mt-1">Contactez votre administrateur.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {supermarkets.map((sm: any) => (
                <button
                  key={sm.id}
                  onClick={() => handleSelectSupermarket(sm.id, sm.nom)}
                  className="w-full bg-white border border-slate-100 rounded-2xl px-4 py-4 flex items-center gap-3 hover:border-orange/40 hover:bg-orange/5 transition-all group shadow-sm text-left"
                >
                  <div className="h-10 w-10 rounded-xl bg-navy/5 group-hover:bg-orange/10 flex items-center justify-center shrink-0 transition-colors">
                    <Store size={18} className="text-navy group-hover:text-orange transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{sm.nom}</p>
                    {sm.ville && <p className="text-[11px] text-slate-400">{sm.ville}</p>}
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-orange transition-colors shrink-0" />
                </button>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  // ── Loading config ronde ─────────────────────────────────
  if (configLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-orange flex items-center justify-center shadow-lg shadow-orange/30">
            <Loader2 size={22} className="text-white animate-spin" />
          </div>
          <p className="text-slate-400 text-sm">Chargement de la ronde...</p>
          <p className="text-xs text-slate-300">{supermarketNom}</p>
        </div>
      </div>
    );
  }

  // ── Config manquante ─────────────────────────────────────
  if (configMissing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 max-w-sm w-full text-center">
          <AlertTriangle size={40} className="mx-auto text-amber-400 mb-4" />
          <h2 className="font-bold text-slate-800 text-base mb-2">Configuration manquante</h2>
          <p className="text-sm text-slate-500 mb-1">
            Aucune zone de ronde n'a été configurée pour <strong>{supermarketNom}</strong>.
          </p>
          <p className="text-xs text-slate-400 mb-6">Contactez votre administrateur.</p>
          <div className="space-y-2">
            <button onClick={() => setStep("select_supermarket")} className="btn-primary w-full">
              Choisir un autre site
            </button>
            <button onClick={() => router.back()} className="btn-secondary w-full">
              <ChevronLeft size={15} /> Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  const nokCount = checks.flatMap(z => z.equipements).filter(e => e["09h"] === "NOK" || e["15h"] === "NOK").length;

  // ── Step 2 : Ronde ───────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 pb-28">

      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-20 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => setStep("select_supermarket")} className="h-8 w-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
          <ChevronLeft size={16} className="text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-sm leading-tight">Ronde journalière</p>
          <p className="text-[10px] text-slate-400">
            <span className="font-semibold text-orange">{supermarketNom}</span>
            {" · "}
            {new Date(date).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" })}
            {nokCount > 0 && <span className="text-red-500 font-bold ml-2">· {nokCount} NOK</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-7 w-7 rounded-lg bg-orange/10 flex items-center justify-center">
            <ClipboardList size={14} className="text-orange" />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">

        {/* Info */}
        <div className="bg-orange/5 border border-orange/15 rounded-2xl p-4">
          <p className="text-xs text-orange font-semibold mb-1">Instructions</p>
          <p className="text-[11px] text-slate-600">
            Pour chaque équipement, renseignez l'état à <strong>09h</strong> et <strong>15h</strong> (OK ou NOK).
            En cas de NOK, ajoutez une observation et créez un ticket de maintenance.
          </p>
        </div>

        {/* Zones */}
        {checks.map((zone, zi) => (
          <div key={zone.zone} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="bg-navy/5 px-4 py-3 border-b border-slate-100">
              <p className="font-bold text-sm text-navy">{zone.zone}</p>
              <p className="text-[10px] text-slate-400">{zone.equipements.length} équipement(s)</p>
            </div>
            <div className="divide-y divide-slate-50">
              {zone.equipements.map((eq, ei) => {
                const hasNok = eq["09h"] === "NOK" || eq["15h"] === "NOK";
                return (
                  <div key={eq.nom} className={`p-4 space-y-3 ${hasNok ? "bg-red-50/40" : ""}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        {hasNok
                          ? <XCircle size={14} className="text-red-500 shrink-0" />
                          : eq["09h"] === "OK" && eq["15h"] === "OK"
                            ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                            : <div className="h-3.5 w-3.5 rounded-full bg-slate-200 shrink-0" />
                        }
                        {eq.nom}
                      </p>
                    </div>

                    {/* 09h / 15h toggles */}
                    <div className="grid grid-cols-2 gap-3">
                      {(["09h", "15h"] as const).map((slot) => (
                        <div key={slot}>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">{slot}</p>
                          <div className="flex gap-1.5">
                            {STATUS_OPTIONS.map((opt) => (
                              <button
                                key={opt}
                                onClick={() => updateCheck(zi, ei, slot, opt)}
                                className={`flex-1 text-[11px] font-bold py-2 rounded-xl border transition-all ${
                                  eq[slot] === opt
                                    ? `${STATUS_COLORS[opt]} border-transparent shadow-sm`
                                    : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100"
                                }`}
                              >
                                {opt || "—"}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Observation (visible si NOK ou si déjà remplie) */}
                    {(hasNok || eq.observation) && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Observation</p>
                        <textarea
                          rows={2}
                          placeholder="Décrivez l'anomalie..."
                          value={eq.observation}
                          onChange={e => updateCheck(zi, ei, "observation", e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange resize-none text-slate-700 placeholder:text-slate-300"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Observations générales */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-bold text-slate-700 mb-2">Observations générales</p>
          <textarea
            rows={3}
            placeholder="Remarques générales sur la ronde..."
            value={observations}
            onChange={e => setObservations(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange resize-none text-slate-700 placeholder:text-slate-300"
          />
        </div>
      </main>

      {/* FAB Soumettre */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 px-4 py-3 z-30">
        <div className="max-w-lg mx-auto">
          {nokCount > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-2">
              <AlertTriangle size={13} className="shrink-0" />
              {nokCount} anomalie(s) détectée(s) — pensez à créer des tickets.
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-orange hover:bg-orange/90 text-white font-bold text-sm py-3.5 rounded-2xl shadow-lg shadow-orange/30 transition-all active:scale-95 disabled:opacity-60"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {submitting ? "Enregistrement..." : "Soumettre la ronde"}
          </button>
        </div>
      </div>
    </div>
  );
}
