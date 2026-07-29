"use client";
import Shell from "@/components/Shell";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useConfirm } from "@/components/Confirm";
import { useToast } from "@/components/Toast";
import { Building2, PlusCircle, Loader2, Trash2, X, Check, Download, Calendar, FileDown } from "lucide-react";

type Section = "supermarkets" | "export";

export default function AdminPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const { success, error: toastError } = useToast();
  const [activeSection, setActiveSection] = useState<Section>("supermarkets");

  // Supermarkets
  const [supermarkets, setSupermarkets] = useState<any[]>([]);
  const [loadingSm, setLoadingSm] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Export
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState("");
  const [exportSmId, setExportSmId] = useState("");

  // KPIs
  const [kpis, setKpis] = useState<any>(null);
  const [loadingKpis, setLoadingKpis] = useState(false);

  const loadSm = useCallback(async () => {
    setLoadingSm(true);
    try { setSupermarkets(await api.getSupermarkets()); }
    catch { router.push("/login"); }
    finally { setLoadingSm(false); }
  }, [router]);

  useEffect(() => { loadSm(); }, [loadSm]);

  useEffect(() => {
    (async () => {
      if (activeSection === "export") {
        setLoadingKpis(true);
        try { setKpis(await api.getKpi()); } catch {}
        setLoadingKpis(false);
      }
    })();
  }, [activeSection]);

  const handleSmSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError(""); setSubmitting(true);
    try {
      if (editId) await api.updateSupermarket(editId, formData);
      else await api.createSupermarket(formData);
      setFormData({}); setShowForm(false); setEditId(null); await loadSm();
    } catch { setFormError("Erreur lors de l'enregistrement."); }
    finally { setSubmitting(false); }
  };

  const handleSmDelete = async (id: string) => {
    const ok = await confirm({
      title: "Supprimer le supermarché",
      message: "Voulez-vous vraiment supprimer définitivement ce supermarché ? Cette action effacera également les équipements et localisations liés.",
      confirmText: "Supprimer",
      type: "danger",
    });
    if (!ok) return;
    try {
      await api.deleteSupermarket(id);
      success("Supermarché supprimé", "L'élément a été retiré avec succès");
      await loadSm();
    } catch {
      toastError("Erreur", "Impossible de supprimer ce supermarché.");
    }
  };

  const startSmEdit = (item: any) => {
    setFormData({ nom: item.nom, code: item.code || "" });
    setEditId(item.id); setShowForm(true);
  };

  const handleExport = async (format: "xlsx" | "pdf") => {
    setExportError(""); setExporting(format);
    try {
      if (format === "xlsx") {
        const blob = await api.exportXlsx(exportFrom || undefined, exportTo || undefined, exportSmId || undefined);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `export-gmao-${new Date().toISOString().split("T")[0]}.xlsx`;
        a.click(); URL.revokeObjectURL(url);
      } else {
        const blob = await api.exportPdf(exportFrom || undefined, exportTo || undefined, exportSmId || undefined);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `export-gmao-${new Date().toISOString().split("T")[0]}.pdf`;
        a.click(); URL.revokeObjectURL(url);
      }
    } catch { setExportError("Erreur lors de l'export."); }
    finally { setExporting(null); }
  };

  return (
    <Shell title="Paramètres" subtitle="Configuration du système">
      <div className="flex gap-1 mb-5 bg-navy rounded-xl p-1 w-fit overflow-x-auto">
        <button onClick={() => setActiveSection("supermarkets")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeSection === "supermarkets" ? "bg-orange text-white shadow-sm" : "text-white/70 hover:text-white"}`}>
          <Building2 size={16} /> Supermarchés
        </button>
        <button onClick={() => setActiveSection("export")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeSection === "export" ? "bg-orange text-white shadow-sm" : "text-white/70 hover:text-white"}`}>
          <FileDown size={16} /> Export
        </button>
      </div>

      {/* ─────────────── SUPERMARCHES ─────────────── */}
      {activeSection === "supermarkets" && (
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-navy flex items-center gap-2">
                <Building2 size={18} className="text-slate-500" /> Supermarchés
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{supermarkets.length} entrée{supermarkets.length !== 1 ? "s" : ""}</p>
            </div>
            <button onClick={() => { setShowForm(!showForm); setEditId(null); setFormData({}); }} className="btn-primary">
              {showForm ? <X size={15} /> : <PlusCircle size={15} />}
              {showForm ? "Fermer" : "Ajouter"}
            </button>
          </div>

          {showForm && (
            <div className="bg-slate-50 rounded-2xl p-5 mb-5 border border-slate-200 animate-fade-in">
              <h3 className="text-sm font-semibold text-navy mb-4">{editId ? "Modifier" : "Nouveau"} supermarché</h3>
              {formError && <div className="text-sm text-orange bg-orange-50 border border-orange-100 rounded-xl p-3 mb-4">{formError}</div>}
              <form onSubmit={handleSmSubmit}>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-navy mb-1">Nom <span className="text-orange">*</span></label>
                    <input value={formData.nom || ""} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} required placeholder="Ex: Supermarché Douala" className="input" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-navy mb-1">Code <span className="text-orange">*</span></label>
                    <input value={formData.code || ""} onChange={(e) => setFormData({ ...formData, code: e.target.value })} required placeholder="Ex: LILLE" className="input uppercase" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button type="submit" disabled={submitting} className="btn-primary">
                    {submitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    {submitting ? "Enregistrement..." : editId ? "Modifier" : "Créer"}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); setEditId(null); setFormData({}); }} className="btn-secondary">Annuler</button>
                </div>
              </form>
            </div>
          )}

          {loadingSm ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-orange" /></div>
          ) : supermarkets.length === 0 ? (
            <div className="text-center py-14">
              <Building2 size={44} className="mx-auto text-slate-200 mb-3" />
              <p className="text-slate-500 font-medium">Aucun supermarché</p>
              <p className="text-slate-400 text-sm">Cliquez sur « Ajouter » pour créer le premier.</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm min-w-[400px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-3 pr-4 first:pl-1">Nom</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-3 pr-4">Code</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {supermarkets.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="py-3 pr-4 first:pl-1 text-slate-700 font-medium">{row.nom}</td>
                      <td className="py-3 pr-4 text-slate-500 font-mono uppercase">{row.code || "—"}</td>
                      <td className="py-3">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startSmEdit(row)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title="Modifier">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                          </button>
                          <button onClick={() => handleSmDelete(row.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="Supprimer">
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
      )}

      {/* ─────────────── EXPORT ─────────────── */}
      {activeSection === "export" && (
        <div className="card">
          <h2 className="text-base font-bold text-navy flex items-center gap-2 mb-1">
            <Download size={18} className="text-slate-500" /> Export des données
          </h2>
          <p className="text-xs text-slate-400 mb-5">Télécharger toutes les données GMAO avec KPIs, tableaux et graphiques.</p>

          {exportError && <div className="text-sm text-orange bg-orange-50 border border-orange-100 rounded-xl p-3 mb-4">{exportError}</div>}

          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 mb-5">
            <h3 className="text-xs font-bold text-navy flex items-center gap-1.5 mb-3">
              <Calendar size={14} className="text-orange" /> Filtres d'export (optionnels)
            </h3>
            <p className="text-[10px] text-slate-400 mb-3">Sélectionnez un supermarché ou une période pour filtrer les données à exporter.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">Supermarché</label>
                <select value={exportSmId} onChange={(e) => setExportSmId(e.target.value)} className="select text-xs">
                  <option value="">Tous les supermarchés</option>
                  {supermarkets.map((sm) => <option key={sm.id} value={sm.id}>{sm.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">Du</label>
                <input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} className="input text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">Au</label>
                <input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} className="input text-xs" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button onClick={() => handleExport("xlsx")} disabled={exporting !== null}
              className="flex items-center justify-center gap-3 bg-orange text-white font-bold rounded-2xl py-5 hover:bg-orange-600 transition-all disabled:opacity-50 shadow-lg shadow-orange/20 text-sm">
              {exporting === "xlsx" ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
              Excel (.xlsx)
            </button>
            <button onClick={() => handleExport("pdf")} disabled={exporting !== null}
              className="flex items-center justify-center gap-3 bg-navy text-white font-bold rounded-2xl py-5 hover:bg-navy/80 transition-all disabled:opacity-50 shadow-lg shadow-navy/20 text-sm">
              {exporting === "pdf" ? <Loader2 size={20} className="animate-spin" /> : <FileDown size={20} />}
              PDF
            </button>
          </div>

          {/* KPIs aperçu */}
          {loadingKpis ? (
            <div className="flex items-center justify-center py-10 mt-5"><Loader2 size={20} className="animate-spin text-orange" /></div>
          ) : kpis ? (
            <div className="mt-8 border-t border-slate-100 pt-6">
              <h3 className="text-sm font-bold text-navy mb-4">Aperçu des KPIs inclus dans l'export</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-navy">{kpis.totalTickets}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Tickets</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-navy">{kpis.doneTickets}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Terminés</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-navy">{kpis.utilizationPct}%</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Taux fermeture</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-navy">{kpis.avgResolutionDays}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Jours résolution</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Shell>
  );
}
