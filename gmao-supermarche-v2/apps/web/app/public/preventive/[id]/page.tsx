"use client";
import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import Image from "next/image";
import { useConfirm } from "@/components/Confirm";
import { useToast } from "@/components/Toast";
import { parseChecklist, parseChecklistSections } from "@/lib/checklist";
import {
  Wrench, CheckCircle2, Loader2, ClipboardList,
  AlertTriangle, DollarSign, Clock, ShieldCheck,
} from "lucide-react";

export default function PublicPreventivePage({ params }: { params: { id: string } }) {
  const confirm = useConfirm();
  const { warning } = useToast();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Form states
  const [note, setNote] = useState("");
  const [cout, setCout] = useState("");
  const [tempsArret, setTempsArret] = useState("");
  const [imputation, setImputation] = useState("");
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  useEffect(() => {
    api.getPublicPreventiveTask(params.id)
      .then((res) => {
        setTask(res);
      })
      .catch(() => {
        setError("Ce lien de maintenance est invalide ou expiré.");
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  const checklistItems = useMemo(() => parseChecklist(task?.plan?.checklist), [task]);
  const checklistSections = useMemo(() => parseChecklistSections(task?.plan?.checklist), [task]);
  const checklistLines = checklistItems; // keep alias for submit logic

  const handleCheckChange = (index: number, val: boolean) => {
    setCheckedItems((prev) => ({ ...prev, [index]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      setError("Veuillez saisir un rapport d'intervention.");
      return;
    }

    // Valider si toute la checklist est cochée
    const allChecked = checklistItems.every((_: any, i: number) => checkedItems[i]);
    if (!allChecked && checklistItems.length > 0) {
      const ok = await confirm({
        title: "Checklist incomplète",
        message: "Certaines étapes de la checklist n'ont pas été cochées. Confirmer la validation de l'intervention quand même ?",
        confirmText: "Valider quand même",
        type: "warning",
      });
      if (!ok) return;
    }

    setError("");
    setSubmitting(true);
    try {
      const payload = {
        note: note.trim() + (checklistItems.length > 0 ? `\n\n[Checklist de contrôle :\n${checklistItems.map((item, i) => `${checkedItems[i] ? "✓" : "✗"} [${item.section}] ${item.tache}`).join("\n")}]` : ""),
        cout: cout ? parseFloat(cout) : undefined,
        tempsArret: tempsArret ? parseFloat(tempsArret) : undefined,
        imputation: imputation || undefined,
      };
      await api.submitPublicPreventiveTask(params.id, payload);
      setSuccess(true);
    } catch {
      setError("Une erreur est survenue lors de la soumission du rapport. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 size={36} className="animate-spin text-orange mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Chargement du bon de maintenance...</p>
        </div>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center shadow-card">
          <div className="h-16 w-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} />
          </div>
          <h1 className="text-lg font-bold text-navy mb-2">Erreur de chargement</h1>
          <p className="text-slate-500 text-xs leading-relaxed mb-6">{error}</p>
        </div>
      </div>
    );
  }

  const eq = task.plan?.equipment;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col items-center justify-center p-4 py-8">
      <div className="max-w-xl w-full">
        {/* Logo Brand */}
        <div className="flex flex-col items-center justify-center mb-6">
          <div className="flex h-12 w-36 items-center justify-center bg-white rounded-xl shadow-lg p-2 mb-2">
            <Image src="/logocfao.png" alt="Logo CFAO" width={130} height={35} className="object-contain" />
          </div>
          <span className="text-sm font-medium tracking-wide text-orange">Interface Prestataire</span>
        </div>

        {success ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-card animate-fade-in">
            <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <CheckCircle2 size={36} />
            </div>
            <h1 className="text-xl font-bold text-navy mb-2">Intervention validée !</h1>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              Le rapport de maintenance préventive pour l'équipement <span className="text-navy font-semibold">{eq?.nom}</span> a été enregistré avec succès.
            </p>
            <p className="text-[11px] text-slate-400 bg-slate-50 border border-slate-100 py-2 px-4 rounded-xl inline-block">
              Vous pouvez maintenant fermer cette fenêtre.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Header info */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-card">
              <span className="bg-orange/10 text-orange border border-orange/20 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md">
                Bon de maintenance préventive
              </span>
              <h1 className="text-lg font-black text-navy mt-3 leading-tight">{task.plan?.titre}</h1>
              <p className="text-xs text-slate-500 mt-1">Échéance : {new Date(task.dueDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</p>

              {/* Equipment Card */}
              <div className="mt-4 bg-slate-50 rounded-2xl p-4 border border-slate-100 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-slate-500 font-medium">Équipement</p>
                  <p className="text-navy font-bold mt-0.5 truncate">{eq?.nom}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium">Site / Supermarché</p>
                  <p className="text-navy font-bold mt-0.5 truncate">{eq?.supermarket?.nom}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium">Corps d'état</p>
                  <p className="text-navy font-bold mt-0.5 truncate">{eq?.corpsEtat || "Non spécifié"}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium">Code ID</p>
                  <p className="text-slate-400 font-mono mt-0.5 select-all truncate">{eq?.code || eq?.id}</p>
                </div>
              </div>
            </div>

            {/* Checklist */}
            {checklistItems.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-card space-y-4">
                <h2 className="text-xs font-black uppercase tracking-wider text-navy flex items-center gap-1.5">
                  <ClipboardList size={14} className="text-orange" /> Checklist de contrôle
                  <span className="ml-auto text-[10px] font-semibold text-slate-400 normal-case">{checklistItems.filter((_,i) => checkedItems[i]).length}/{checklistItems.length} validées</span>
                </h2>
                {checklistSections.map((sec, si) => {
                  // compute global start index for this section's items
                  const sectionStartIdx = checklistItems.findIndex(item => item.section === sec.section);
                  return (
                    <div key={si} className="space-y-1">
                      {checklistSections.length > 1 && (
                        <p className="text-[10px] font-bold uppercase tracking-wider text-orange/80 mb-1.5 mt-2 first:mt-0">{sec.section}</p>
                      )}
                      <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                        {sec.taches.map((tache, ti) => {
                          const globalIdx = sectionStartIdx + ti;
                          return (
                            <label key={ti} className="flex items-start gap-3 px-3 py-2.5 cursor-pointer select-none group hover:bg-slate-50 transition-colors">
                              <input type="checkbox" checked={!!checkedItems[globalIdx]} onChange={(e) => handleCheckChange(globalIdx, e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-orange shrink-0" />
                              <span className={`text-xs leading-relaxed transition-colors ${checkedItems[globalIdx] ? "text-slate-400 line-through" : "text-slate-600 group-hover:text-navy"}`}>{tache}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Rapport Form */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-card space-y-4">
              <h2 className="text-xs font-black uppercase tracking-wider text-navy flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-orange" /> Rapport d'intervention
              </h2>

              {error && <div className="bg-orange/10 border border-orange/20 text-orange text-xs rounded-xl p-3">{error}</div>}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1.5">Rapport de maintenance <span className="text-orange">*</span></label>
                <textarea required value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Détaillez les actions réalisées sur l'équipement, remarques techniques..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/15 resize-none placeholder:text-slate-400" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1.5 flex items-center gap-1">
                    <DollarSign size={10} className="text-slate-400" /> Coût prestation (XAF)
                  </label>
                  <input type="number" min="0" value={cout} onChange={(e) => setCout(e.target.value)} placeholder="Montant"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/15 placeholder:text-slate-400" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1.5 flex items-center gap-1">
                    <Clock size={10} className="text-slate-400" /> Temps d'arrêt (heures)
                  </label>
                  <input type="number" step="0.1" min="0" value={tempsArret} onChange={(e) => setTempsArret(e.target.value)} placeholder="Ex: 1.5"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/15 placeholder:text-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1.5 flex items-center gap-1">
                  Imputation
                </label>
                <select value={imputation} onChange={(e) => setImputation(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/15">
                  <option value="">-- Sélectionner --</option>
                  <option value="PLAYCE">PLAYCE</option>
                  <option value="ADIALEA">ADIALEA</option>
                </select>
              </div>

              <button type="submit" disabled={submitting}
                className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-orange to-orange-600 text-white font-black text-xs uppercase tracking-wider rounded-xl py-3.5 hover:from-orange-600 hover:to-orange-800 transition-colors shadow-lg shadow-orange/10 disabled:opacity-50"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Soumettre le rapport
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
