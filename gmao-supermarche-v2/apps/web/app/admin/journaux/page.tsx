"use client";
import Shell from "@/components/Shell";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useConfirm } from "@/components/Confirm";
import { useToast } from "@/components/Toast";
import {
  Notebook, Loader2,
  FileDown, Check, X, Trash2, RefreshCw, Filter, AlertCircle,
  PenLine, ShieldCheck, ShieldAlert,
} from "lucide-react";

export default function JournauxPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const { success, error: toastError, warning } = useToast();

  const [user, setUser] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [maintenanciers, setMaintenanciers] = useState<any[]>([]);
  const [loadingRep, setLoadingRep] = useState(true);
  const [filterMtnId, setFilterMtnId] = useState("");
  const [filterDateDebut, setFilterDateDebut] = useState("");
  const [filterDateFin, setFilterDateFin] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genDate, setGenDate] = useState(new Date().toISOString().split("T")[0]);
  const [genResult, setGenResult] = useState<any>(null);
  const [genError, setGenError] = useState("");
  const [signing, setSigning] = useState<string | null>(null);
  const [signingAll, setSigningAll] = useState(false);
  const [signAllDate, setSignAllDate] = useState(new Date().toISOString().split("T")[0]);
  const [showRepForm, setShowRepForm] = useState(false);
  const [editRepId, setEditRepId] = useState<string | null>(null);
  const [repForm, setRepForm] = useState({
    date: new Date().toISOString().split("T")[0],
    maintenancierId: "", activites: "", observations: "",
    managerMaintenance: "", dateVisaAgent: "",
  });
  const [submittingRep, setSubmittingRep] = useState(false);
  const [repError, setRepError] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("gmao_user");
    if (raw) setUser(JSON.parse(raw));
  }, []);

  const loadReports = useCallback(async () => {
    setLoadingRep(true);
    try {
      const [rep, mtns] = await Promise.all([
        api.getRapportsJournaliers({
          maintenancierId: filterMtnId || undefined,
          dateDebut: filterDateDebut || undefined,
          dateFin: filterDateFin || undefined,
        }),
        api.getMaintenanciers(),
      ]);
      setReports(rep);
      setMaintenanciers(mtns);
    } catch { router.push("/login"); }
    finally { setLoadingRep(false); }
  }, [filterMtnId, filterDateDebut, filterDateFin, router]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const handleGenerate = async () => {
    setGenerating(true); setGenError(""); setGenResult(null);
    try {
      const res = await api.generateRapportJournalier(genDate);
      setGenResult(res);
    } catch (e: any) {
      setGenError(e.message || "Erreur lors de la generation");
    }
    finally { setGenerating(false); await loadReports(); }
  };

  const handleExportPdf = async (rapport: any) => {
    try {
      const blob = await api.exportRapportPdf(rapport.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `rapport-journalier-${rapport.date?.split("T")[0] || new Date().toISOString().split("T")[0]}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch { toastError("Erreur PDF", "Impossible de generer le PDF."); }
  };

  const handleSign = async (rapportId: string) => {
    setSigning(rapportId);
    try {
      const updated = await api.signerRapport(rapportId, "responsable", user?.nom);
      setReports((prev) => prev.map((r) => r.id === rapportId ? { ...r, ...updated } : r));
      success("Rapport signe", "Votre visa responsable a ete appose.");
    } catch {
      toastError("Erreur de signature", "Impossible de signer ce rapport.");
    } finally {
      setSigning(null);
    }
  };

  const handleSignAll = async () => {
    const unsignedCount = reports.filter(
      (r) => !r.signatureResponsable &&
      new Date(r.date).toISOString().split("T")[0] === signAllDate
    ).length;
    if (unsignedCount === 0) {
      warning("Rien a signer", `Tous les rapports du ${new Date(signAllDate).toLocaleDateString("fr-FR")} sont deja signes.`);
      return;
    }
    const ok = await confirm({
      title: "Signer tous les rapports",
      message: `Voulez-vous apposer votre visa responsable sur ${unsignedCount} rapport(s) du ${new Date(signAllDate).toLocaleDateString("fr-FR")} ?`,
      confirmText: "Signer tout",
      type: "warning",
    });
    if (!ok) return;
    setSigningAll(true);
    try {
      const res = await api.signerTousRapports(signAllDate, user?.nom);
      success("Signatures apposees", `${res.signed} rapport(s) signe(s) en tant que responsable.`);
      await loadReports();
    } catch {
      toastError("Erreur", "Impossible de signer les rapports.");
    } finally {
      setSigningAll(false);
    }
  };

  const resetRepForm = () => {
    setRepForm({ date: new Date().toISOString().split("T")[0], maintenancierId: "", activites: "", observations: "", managerMaintenance: "", dateVisaAgent: "" });
    setEditRepId(null); setRepError("");
  };

  const openEditRep = (r: any) => {
    setRepForm({
      date: new Date(r.date).toISOString().split("T")[0],
      maintenancierId: r.maintenancierId, activites: r.activites,
      observations: r.observations || "", managerMaintenance: r.managerMaintenance || "",
      dateVisaAgent: r.dateVisaAgent ? new Date(r.dateVisaAgent).toISOString().split("T")[0] : "",
    });
    setEditRepId(r.id); setShowRepForm(true); setRepError("");
  };

  const handleRepSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setRepError(""); setSubmittingRep(true);
    try {
      const payload = { ...repForm, dateVisaAgent: repForm.dateVisaAgent || null };
      if (editRepId) await api.updateRapportJournalier(editRepId, payload);
      else await api.createRapportJournalier(payload);
      setShowRepForm(false); resetRepForm(); await loadReports();
    } catch { setRepError("Erreur lors de l enregistrement."); }
    finally { setSubmittingRep(false); }
  };

  const handleRepDelete = async (id: string) => {
    const ok = await confirm({
      title: "Supprimer le rapport journalier",
      message: "Voulez-vous vraiment supprimer ce rapport ? Cette action est irreversible.",
      confirmText: "Supprimer", type: "danger",
    });
    if (!ok) return;
    try {
      await api.deleteRapportJournalier(id);
      success("Rapport supprime", "Le rapport journalier a ete supprime");
      await loadReports();
    } catch { toastError("Erreur", "Impossible de supprimer le rapport."); }
  };

  return (
    <Shell title="Journaux" subtitle="Rapports d activites journalieres">
      {/* Generation automatique */}
      <div className="card mb-5">
        <h3 className="text-sm font-bold text-navy flex items-center gap-2 mb-3">
          <RefreshCw size={16} className="text-orange" /> Generer un rapport depuis les tickets
        </h3>
        <p className="text-[10px] text-slate-400 mb-4">Le rapport sera automatiquement rempli avec les tickets termines et les activites du jour.</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">Date du rapport</label>
            <input type="date" value={genDate} onChange={(e) => setGenDate(e.target.value)} className="input text-xs" />
          </div>
          <button onClick={handleGenerate} disabled={generating} className="btn-primary">
            {generating ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {generating ? "Generation..." : "Generer"}
          </button>
        </div>
        {genError && (
          <div className="mt-4 text-sm text-orange bg-orange-50 border border-orange-100 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {genError}
          </div>
        )}
        {genResult && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-green-700"><Check size={16} className="inline mr-1" /> Rapport genere avec succes</p>
              <button onClick={() => setGenResult(null)} className="text-green-500 hover:text-green-700"><X size={16} /></button>
            </div>
            <div className="text-xs text-green-600 space-y-1">
              <p><span className="font-medium">Date :</span> {new Date(genResult.date).toLocaleDateString("fr-FR")}</p>
              <p><span className="font-medium">Agent :</span> {genResult.maintenancier?.nom || genResult.maintenancierId}</p>
              <p className="line-clamp-2"><span className="font-medium">Activites :</span> {genResult.activites}</p>
            </div>
          </div>
        )}
      </div>

      {/* Visa Responsable - Signature groupee */}
      <div className="card mb-5 border-l-4 border-orange">
        <h3 className="text-sm font-bold text-navy flex items-center gap-2 mb-3">
          <ShieldCheck size={16} className="text-orange" /> Visa Responsable - Signature groupee
        </h3>
        <p className="text-[10px] text-slate-400 mb-4">Apposez votre visa responsable sur tous les rapports non signes d une journee en un clic.</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">Date de la journee</label>
            <input type="date" value={signAllDate} onChange={(e) => setSignAllDate(e.target.value)} className="input text-xs" />
          </div>
          <button onClick={handleSignAll} disabled={signingAll} className="flex items-center gap-2 bg-navy hover:bg-navy/90 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60 shadow-sm">
            {signingAll ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
            {signingAll ? "Signature en cours..." : "Signer tout"}
          </button>
        </div>
      </div>

      {/* Liste des rapports */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-navy flex items-center gap-2">
              <Notebook size={18} className="text-slate-500" /> Rapports enregistres
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{reports.length} rapport{reports.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={() => { setShowRepForm(!showRepForm); if (!showRepForm) resetRepForm(); }} className="btn-primary">
            {showRepForm ? <X size={15} /> : <Notebook size={15} />}
            {showRepForm ? "Fermer" : "Nouveau manuel"}
          </button>
        </div>

        {/* Filtres */}
        <div className="bg-slate-50 rounded-2xl p-4 mb-4 border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">Maintenancier</label>
            <select value={filterMtnId} onChange={(e) => setFilterMtnId(e.target.value)} className="select text-xs">
              <option value="">Tous</option>
              {maintenanciers.map((m: any) => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">Du</label>
            <input type="date" value={filterDateDebut} onChange={(e) => setFilterDateDebut(e.target.value)} className="input text-xs" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">Au</label>
            <input type="date" value={filterDateFin} onChange={(e) => setFilterDateFin(e.target.value)} className="input text-xs" />
          </div>
          <div className="flex items-end gap-2">
            <button onClick={loadReports} className="btn-primary text-xs py-2 px-4 flex-1">
              <Filter size={13} /> Filtrer
            </button>
          </div>
        </div>

        {/* Formulaire manuel */}
        {showRepForm && (
          <div className="bg-slate-50 rounded-2xl p-5 mb-5 border border-slate-200">
            <h3 className="text-sm font-semibold text-navy mb-4">{editRepId ? "Modifier" : "Nouveau"} rapport journalier</h3>
            {repError && <div className="text-sm text-orange bg-orange-50 border border-orange-100 rounded-xl p-3 mb-4">{repError}</div>}
            <form onSubmit={handleRepSubmit}>
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">Date <span className="text-orange">*</span></label>
                  <input type="date" required value={repForm.date} onChange={(e) => setRepForm({ ...repForm, date: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">Agent de maintenance <span className="text-orange">*</span></label>
                  <select required value={repForm.maintenancierId} onChange={(e) => setRepForm({ ...repForm, maintenancierId: e.target.value })} className="select">
                    <option value="">Selectionner...</option>
                    {maintenanciers.map((m: any) => <option key={m.id} value={m.id}>{m.nom}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-navy mb-1">Activites realisees <span className="text-orange">*</span></label>
                <textarea required rows={4} value={repForm.activites} onChange={(e) => setRepForm({ ...repForm, activites: e.target.value })} placeholder="Decrivez les activites de maintenance realisees..." className="input resize-none" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">Observations</label>
                  <textarea rows={3} value={repForm.observations} onChange={(e) => setRepForm({ ...repForm, observations: e.target.value })} placeholder="Observations eventuelles..." className="input resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">Manager maintenance</label>
                  <input type="text" value={repForm.managerMaintenance} onChange={(e) => setRepForm({ ...repForm, managerMaintenance: e.target.value })} placeholder="Nom du manager" className="input" />
                  <label className="block text-xs font-semibold text-navy mb-1 mt-3">Date visa agent</label>
                  <input type="date" value={repForm.dateVisaAgent} onChange={(e) => setRepForm({ ...repForm, dateVisaAgent: e.target.value })} className="input" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={submittingRep} className="btn-primary">
                  {submittingRep ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  {submittingRep ? "Enregistrement..." : editRepId ? "Modifier" : "Creer"}
                </button>
                <button type="button" onClick={() => { setShowRepForm(false); resetRepForm(); }} className="btn-secondary">Annuler</button>
              </div>
            </form>
          </div>
        )}

        {/* Liste */}
        {loadingRep ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-orange" /></div>
        ) : reports.length === 0 ? (
          <div className="text-center py-14">
            <Notebook size={44} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium">Aucun rapport journalier</p>
            <p className="text-slate-400 text-sm">Generez un rapport depuis les tickets du jour ou creez-en un manuellement.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-3 pr-4 first:pl-1">Date</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-3 pr-4">Agent</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-3 pr-4">Activites</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-3 pr-4">Observations</th>
                  <th className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-3 pr-4">Sig. Tech.</th>
                  <th className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-3 pr-4">Sig. Resp.</th>
                  <th className="w-36" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-3 pr-4 first:pl-1 text-slate-700 font-medium whitespace-nowrap">
                      {new Date(r.date).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="py-3 pr-4 text-slate-700 font-medium">{r.maintenancier?.nom}</td>
                    <td className="py-3 pr-4 text-slate-500 max-w-[200px] truncate" title={r.activites}>{r.activites}</td>
                    <td className="py-3 pr-4 text-slate-400 max-w-[150px] truncate">{r.observations || "—"}</td>
                    <td className="py-3 pr-4 text-center">
                      {r.signatureTechnicien ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">
                          <ShieldCheck size={11} /> Signe
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
                          <ShieldAlert size={11} /> En attente
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-center">
                      {r.signatureResponsable ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full" title={r.managerMaintenance || ""}>
                          <ShieldCheck size={11} /> Signe
                        </span>
                      ) : (
                        <button
                          disabled={signing === r.id}
                          onClick={() => handleSign(r.id)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold bg-orange text-white px-2.5 py-1 rounded-full hover:bg-orange/90 transition-colors disabled:opacity-60"
                        >
                          {signing === r.id ? <Loader2 size={11} className="animate-spin" /> : <PenLine size={11} />}
                          Signer
                        </button>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleExportPdf(r)} className="p-1.5 rounded-lg hover:bg-orange-50 text-slate-400 hover:text-orange-600 transition-colors" title="Export PDF">
                          <FileDown size={14} />
                        </button>
                        <button onClick={() => openEditRep(r)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title="Modifier">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                        </button>
                        <button onClick={() => handleRepDelete(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="Supprimer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
