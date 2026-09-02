"use client";
import Shell from "@/components/Shell";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useConfirm } from "@/components/Confirm";
import { useToast } from "@/components/Toast";
import { Layers, PlusCircle, Loader2, Trash2, Check, X } from "lucide-react";
import SortIcon from "@/components/SortIcon";
import { compareValues, type SortDir } from "@/lib/sort";

type SortKey = "nom" | "supermarket";

export default function LocalisationsPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const { success, error: toastError } = useToast();
  // Rôle Viewer : accès en lecture seule, pas d'actions de création/édition/suppression.
  const currentUser = typeof window !== "undefined" ? JSON.parse(sessionStorage.getItem("gmao_user") || "null") : null;
  const isViewer = currentUser?.role === "VIEWER";
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  /* ── Form ── */
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const getCurrentSupermarketId = () =>
    typeof window !== "undefined" ? sessionStorage.getItem("gmao_current_supermarket") : null;

  const load = useCallback(async (redirect?: (url: string) => void) => {
    setLoading(true);
    try {
      const sid = getCurrentSupermarketId();
      const list = sid ? await api.getLocalisations(sid) : await api.getLocalisations();
      setData(list);
    } catch {
      redirect?.("/login");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(router.push.bind(router)); }, [load, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = { ...form, supermarketId: getCurrentSupermarketId() };
      if (editId) {
        await api.updateLocalisation(editId, form);
      } else {
        await api.createLocalisation(payload);
      }
      setForm({});
      setShowForm(false);
      setEditId(null);
      await load();
    } catch {
      setError("Erreur lors de l'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Supprimer la localisation",
      message: "Voulez-vous vraiment supprimer cette localisation ? Tous les équipements associés perdront leur localisation associée.",
      confirmText: "Supprimer",
      type: "danger",
    });
    if (!ok) return;
    try {
      await api.deleteLocalisation(id);
      success("Localisation supprimée", "Le département a été retiré");
      await load();
    } catch {
      toastError("Erreur", "Impossible de supprimer ce département.");
    }
  };

  const startEdit = (item: any) => {
    setForm({ nom: item.nom });
    setEditId(item.id);
    setShowForm(true);
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      const va = sortKey === "nom" ? a.nom : a.supermarket?.nom;
      const vb = sortKey === "nom" ? b.nom : b.supermarket?.nom;
      return compareValues(va, vb) * dir;
    });
  }, [data, sortKey, sortDir]);

  return (
    <Shell title="Localisations" subtitle="Gestion des localisations par supermarché">
      <div className="card">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Layers size={18} className="text-slate-500" />
              Localisations
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{data.length} entrée{data.length !== 1 ? "s" : ""}</p>
          </div>
          {!isViewer && (
            <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({}); }} className="btn-primary">
              {showForm ? <X size={15} /> : <PlusCircle size={15} />}
              {showForm ? "Fermer" : "Ajouter"}
            </button>
          )}
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-slate-50 rounded-2xl p-5 mb-5 border border-slate-200 animate-fade-in">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">
              {editId ? "Modifier" : "Nouvelle"} localisation
            </h3>
            {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nom</label>
                  <input value={form.nom || ""} onChange={(e) => setForm({ ...form, nom: e.target.value })} required placeholder="Ex: Boucherie" className="input" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  {submitting ? "Enregistrement..." : editId ? "Modifier" : "Créer"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm({}); }} className="btn-secondary">Annuler</button>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-orange" /></div>
        ) : data.length === 0 ? (
          <div className="text-center py-14">
            <Layers size={44} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium">Aucune localisation</p>
            <p className="text-slate-400 text-sm">Cliquez sur « Ajouter » pour créer le premier.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-3 pr-4 first:pl-1 cursor-pointer select-none hover:text-slate-600" onClick={() => handleSort("nom")}>
                    <span className="inline-flex items-center gap-1">Nom <SortIcon active={sortKey === "nom"} dir={sortDir} /></span>
                  </th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-3 pr-4 cursor-pointer select-none hover:text-slate-600" onClick={() => handleSort("supermarket")}>
                    <span className="inline-flex items-center gap-1">Supermarché <SortIcon active={sortKey === "supermarket"} dir={sortDir} /></span>
                  </th>
                  {!isViewer && <th className="w-20" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedData.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-3 pr-4 first:pl-1 text-slate-700 font-medium">{row.nom}</td>
                    <td className="py-3 pr-4 text-slate-500">{row.supermarket?.nom || "—"}</td>
                    {!isViewer && (
                      <td className="py-3">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(row)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title="Modifier">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                          </button>
                          <button onClick={() => handleDelete(row.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="Supprimer">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
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
