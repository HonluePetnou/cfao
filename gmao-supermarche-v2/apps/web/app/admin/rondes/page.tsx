"use client";
import Shell from "@/components/Shell";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useConfirm } from "@/components/Confirm";
import { useToast } from "@/components/Toast";
import {
  ClipboardList, Loader2, Plus, Trash2, Settings,
  CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp,
  PenLine, ShieldCheck, Filter, Eye, X,
} from "lucide-react";

type ZoneConfig = { zone: string; equipements: string[] };
type CheckEquipement = { nom: string; "09h": string; "15h": string; observation: string };
type CheckZone = { zone: string; equipements: CheckEquipement[] };

export default function RondesPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const { success, error: toastError, info } = useToast();

  const [user, setUser] = useState<any>(null);
  const [supermarkets, setSupermarkets] = useState<any[]>([]);
  const [selectedSmId, setSelectedSmId] = useState("");
  const [loading, setLoading] = useState(true);

  // Config zones
  const [config, setConfig] = useState<ZoneConfig[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [newZone, setNewZone] = useState("");
  const [newEquip, setNewEquip] = useState<Record<string, string>>({});

  // Rondes
  const [rondes, setRondes] = useState<any[]>([]);
  const [loadingRondes, setLoadingRondes] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [signing, setSigning] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("gmao_user");
    if (!raw) { router.replace("/login"); return; }
    const u = JSON.parse(raw);
    setUser(u);
    api.getSupermarkets()
      .then((sms) => {
        setSupermarkets(sms);
        const currentSm = sessionStorage.getItem("gmao_current_supermarket");
        const defaultSm = currentSm && sms.some((s: any) => s.id === currentSm) ? currentSm : sms[0]?.id;
        if (defaultSm) setSelectedSmId(defaultSm);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  // Load config + rondes when supermarket changes
  useEffect(() => {
    if (!selectedSmId) return;
    api.getRondeConfig(selectedSmId)
      .then((cfg) => {
        if (cfg?.zones) setConfig(JSON.parse(cfg.zones));
        else setConfig([]);
      })
      .catch(() => setConfig([]));
    loadRondes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSmId]);

  const loadRondes = useCallback(async () => {
    if (!selectedSmId) return;
    setLoadingRondes(true);
    try {
      const data = await api.getRondes({
        supermarketId: selectedSmId,
        dateDebut: filterDate || undefined,
        dateFin: filterDate || undefined,
      });
      setRondes(data);
    } catch {
      toastError("Erreur", "Impossible de charger les rondes.");
    } finally {
      setLoadingRondes(false);
    }
  }, [selectedSmId, filterDate]);

  useEffect(() => { loadRondes(); }, [loadRondes]);

  // ─── CONFIG ZONES ────────────────────────────────────────────────

  const handleSaveConfig = async () => {
    if (!selectedSmId) return;
    setSavingConfig(true);
    try {
      await api.upsertRondeConfig(selectedSmId, config);
      success("Configuration sauvegardée", "Les zones et équipements ont été enregistrés.");
      setShowConfig(false);
    } catch {
      toastError("Erreur", "Impossible de sauvegarder la configuration.");
    } finally {
      setSavingConfig(false);
    }
  };

  const addZone = () => {
    const name = newZone.trim();
    if (!name || config.some(z => z.zone === name)) return;
    setConfig([...config, { zone: name, equipements: [] }]);
    setNewZone("");
  };

  const removeZone = (zone: string) => {
    setConfig(config.filter(z => z.zone !== zone));
  };

  const addEquipement = (zone: string) => {
    const eq = (newEquip[zone] || "").trim();
    if (!eq) return;
    setConfig(config.map(z =>
      z.zone === zone ? { ...z, equipements: [...z.equipements, eq] } : z
    ));
    setNewEquip({ ...newEquip, [zone]: "" });
  };

  const removeEquipement = (zone: string, eq: string) => {
    setConfig(config.map(z =>
      z.zone === zone ? { ...z, equipements: z.equipements.filter(e => e !== eq) } : z
    ));
  };

  // ─── SIGNING ─────────────────────────────────────────────────────

  const handleSign = async (rondeId: string, role: "technicien" | "permanent" | "dm") => {
    setSigning(`${rondeId}-${role}`);
    try {
      const updated = await api.signerRonde(rondeId, role, user?.nom);
      setRondes(prev => prev.map(r => r.id === rondeId ? { ...r, ...updated } : r));
      success("Signature apposée", `Visa ${role} enregistré.`);
    } catch {
      toastError("Erreur", "Impossible de signer cette ronde.");
    } finally {
      setSigning(null);
    }
  };

  // ─── DELETE ──────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Supprimer la ronde",
      message: "Voulez-vous vraiment supprimer cette ronde journalière ? Cette action est irréversible.",
      confirmText: "Supprimer",
      type: "danger",
    });
    if (!ok) return;
    setDeletingId(id);
    try {
      await api.deleteRonde(id);
      setRondes(prev => prev.filter(r => r.id !== id));
      success("Ronde supprimée");
    } catch {
      toastError("Erreur", "Impossible de supprimer la ronde.");
    } finally {
      setDeletingId(null);
    }
  };

  const statusIcon = (val: string) => {
    if (val === "OK") return <CheckCircle2 size={14} className="text-emerald-500" />;
    if (val === "NOK") return <XCircle size={14} className="text-red-500" />;
    return <Clock size={14} className="text-slate-300" />;
  };

  if (loading) {
    return (
      <Shell title="Rondes" subtitle="Rondes journalières de maintenance">
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-orange" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Rondes" subtitle="Rondes journalières de maintenance">

      {/* ─── Sélecteur supermarché + Config ─── */}
      <div className="card mb-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">Supermarché</label>
            <select
              value={selectedSmId}
              onChange={e => setSelectedSmId(e.target.value)}
              className="select"
            >
              {supermarkets.map(sm => <option key={sm.id} value={sm.id}>{sm.nom}</option>)}
            </select>
          </div>
          <button
            onClick={() => setShowConfig(v => !v)}
            className="flex items-center gap-2 bg-navy/5 hover:bg-navy/10 text-navy text-xs font-bold px-4 py-2.5 rounded-xl border border-navy/10 transition-colors"
          >
            <Settings size={14} />
            {showConfig ? "Masquer config" : "Configurer les zones"}
          </button>
        </div>

        {/* ─── Config Editor ─── */}
        {showConfig && (
          <div className="mt-5 border-t border-slate-100 pt-5 space-y-4">
            <p className="text-xs text-slate-500">Définissez les zones et équipements à vérifier lors de chaque ronde.</p>

            {config.map((zone) => (
              <div key={zone.zone} className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-navy">{zone.zone}</p>
                  <button onClick={() => removeZone(zone.zone)} className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {zone.equipements.map(eq => (
                    <span key={eq} className="flex items-center gap-1 bg-white border border-slate-200 text-xs text-slate-700 px-2.5 py-1 rounded-full">
                      {eq}
                      <button onClick={() => removeEquipement(zone.zone, eq)} className="text-slate-300 hover:text-red-500 ml-0.5">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ajouter un équipement..."
                    value={newEquip[zone.zone] || ""}
                    onChange={e => setNewEquip({ ...newEquip, [zone.zone]: e.target.value })}
                    onKeyDown={e => e.key === "Enter" && addEquipement(zone.zone)}
                    className="input text-xs flex-1"
                  />
                  <button onClick={() => addEquipement(zone.zone)} className="btn-primary text-xs px-3 py-2">
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            ))}

            {/* Ajouter une zone */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nom de la nouvelle zone..."
                value={newZone}
                onChange={e => setNewZone(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addZone()}
                className="input text-xs flex-1"
              />
              <button onClick={addZone} className="btn-primary text-xs px-3 py-2">
                <Plus size={13} /> Zone
              </button>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button onClick={handleSaveConfig} disabled={savingConfig} className="btn-primary">
                {savingConfig ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {savingConfig ? "Sauvegarde..." : "Sauvegarder la configuration"}
              </button>
              <button onClick={() => setShowConfig(false)} className="btn-secondary">Annuler</button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Filtres ─── */}
      <div className="card mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="input text-xs"
            />
          </div>
          <button onClick={loadRondes} className="btn-primary text-xs">
            <Filter size={13} /> Filtrer
          </button>
          {filterDate && (
            <button onClick={() => setFilterDate("")} className="btn-secondary text-xs">
              <X size={13} /> Effacer
            </button>
          )}
        </div>
      </div>

      {/* ─── Liste des rondes ─── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-navy flex items-center gap-2">
              <ClipboardList size={18} className="text-slate-500" /> Rondes enregistrées
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{rondes.length} ronde{rondes.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {loadingRondes ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-orange" />
          </div>
        ) : rondes.length === 0 ? (
          <div className="text-center py-14">
            <ClipboardList size={44} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium">Aucune ronde enregistrée</p>
            <p className="text-slate-400 text-sm mt-1">Les techniciens saisissent les rondes depuis leur interface.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rondes.map((r) => {
              const checks: CheckZone[] = r.checks ? JSON.parse(r.checks) : [];
              const nokCount = checks.flatMap(z => z.equipements).filter(e => e["09h"] === "NOK" || e["15h"] === "NOK").length;
              const isExpanded = expandedId === r.id;

              return (
                <div key={r.id} className={`border rounded-2xl overflow-hidden transition-all ${nokCount > 0 ? "border-red-200 bg-red-50/30" : "border-slate-100 bg-white"}`}>
                  {/* Header */}
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${nokCount > 0 ? "bg-red-100" : "bg-emerald-100"}`}>
                        {nokCount > 0
                          ? <XCircle size={18} className="text-red-500" />
                          : <CheckCircle2 size={18} className="text-emerald-500" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-800">
                          {new Date(r.date).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {r.maintenancier?.nom || "—"} · {checks.length} zone(s)
                          {nokCount > 0 && <span className="text-red-500 font-bold ml-1">· {nokCount} NOK</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Signatures */}
                      <div className="hidden sm:flex items-center gap-1">
                        {r.signatureTechnicien
                          ? <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><ShieldCheck size={9} />Tech</span>
                          : <button onClick={() => handleSign(r.id, "technicien")} disabled={signing === `${r.id}-technicien`} className="text-[9px] font-bold bg-slate-100 hover:bg-orange/10 hover:text-orange text-slate-500 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 transition-colors">
                              <PenLine size={9} />Tech
                            </button>
                        }
                        {r.signaturePermanent
                          ? <span className="text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><ShieldCheck size={9} />Perm.</span>
                          : <button onClick={() => handleSign(r.id, "permanent")} disabled={signing === `${r.id}-permanent`} className="text-[9px] font-bold bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 transition-colors">
                              <PenLine size={9} />Perm.
                            </button>
                        }
                        {r.signatureDM
                          ? <span className="text-[9px] font-bold bg-navy/10 text-navy border border-navy/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><ShieldCheck size={9} />DM</span>
                          : <button onClick={() => handleSign(r.id, "dm")} disabled={signing === `${r.id}-dm`} className="text-[9px] font-bold bg-slate-100 hover:bg-navy/10 hover:text-navy text-slate-500 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 transition-colors">
                              <PenLine size={9} />DM
                            </button>
                        }
                      </div>
                      <button onClick={() => setExpandedId(isExpanded ? null : r.id)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={deletingId === r.id}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        {deletingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Detail expandable */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 p-4 space-y-4">
                      {/* Signatures mobile */}
                      <div className="sm:hidden flex flex-wrap gap-1.5">
                        {["technicien", "permanent", "dm"].map((role) => {
                          const key = role === "technicien" ? "signatureTechnicien" : role === "permanent" ? "signaturePermanent" : "signatureDM";
                          const label = role === "technicien" ? "Tech." : role === "permanent" ? "Perm." : "DM";
                          return r[key]
                            ? <span key={role} className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-full flex items-center gap-1"><ShieldCheck size={10} />{label} · {r[key]}</span>
                            : <button key={role} onClick={() => handleSign(r.id, role as any)} className="text-[10px] font-bold bg-orange text-white px-2 py-1 rounded-full flex items-center gap-1"><PenLine size={10} />Signer {label}</button>;
                        })}
                      </div>

                      {/* Checks par zone */}
                      {checks.map((zone) => (
                        <div key={zone.zone}>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">{zone.zone}</p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs min-w-[400px]">
                              <thead>
                                <tr className="border-b border-slate-100">
                                  <th className="text-left text-[10px] font-semibold text-slate-400 pb-1.5 pr-3">Équipement</th>
                                  <th className="text-center text-[10px] font-semibold text-slate-400 pb-1.5 pr-3 w-16">09h</th>
                                  <th className="text-center text-[10px] font-semibold text-slate-400 pb-1.5 pr-3 w-16">15h</th>
                                  <th className="text-left text-[10px] font-semibold text-slate-400 pb-1.5">Observation</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {zone.equipements.map((eq) => (
                                  <tr key={eq.nom} className={eq["09h"] === "NOK" || eq["15h"] === "NOK" ? "bg-red-50/50" : ""}>
                                    <td className="py-2 pr-3 font-medium text-slate-700">{eq.nom}</td>
                                    <td className="py-2 pr-3 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        {statusIcon(eq["09h"])}
                                        <span className={`font-bold text-[10px] ${eq["09h"] === "OK" ? "text-emerald-600" : eq["09h"] === "NOK" ? "text-red-600" : "text-slate-300"}`}>
                                          {eq["09h"] || "—"}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-2 pr-3 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        {statusIcon(eq["15h"])}
                                        <span className={`font-bold text-[10px] ${eq["15h"] === "OK" ? "text-emerald-600" : eq["15h"] === "NOK" ? "text-red-600" : "text-slate-300"}`}>
                                          {eq["15h"] || "—"}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-2 text-slate-500 text-[11px]">{eq.observation || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}

                      {r.observationsGenerales && (
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Observations générales</p>
                          <p className="text-xs text-amber-800">{r.observationsGenerales}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}
