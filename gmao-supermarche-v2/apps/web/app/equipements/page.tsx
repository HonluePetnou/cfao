"use client";
import Shell from "@/components/Shell";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useConfirm } from "@/components/Confirm";
import { useToast } from "@/components/Toast";
import { Settings, PlusCircle, Loader2, Trash2, Check, X, Search } from "lucide-react";
import { CORPS_ETAT_LIST } from "@/lib/constants";
import Combobox from "@/components/Combobox";
import SortIcon from "@/components/SortIcon";
import { compareValues, compareCriticite, type SortDir } from "@/lib/sort";

type SortKey = "nom" | "localisation" | "corpsEtat" | "criticite";

export default function EquipementsPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const { success, error: toastError } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [localisations, setLocalisations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterLocalisation, setFilterLocalisation] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const getCurrentSupermarketId = () =>
    typeof window !== "undefined"
      ? sessionStorage.getItem("gmao_current_supermarket")
      : null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sid = getCurrentSupermarketId();
      const [eq, loc] = await Promise.all([
        sid ? api.getEquipments({ supermarketId: sid }) : api.getEquipments(),
        sid ? api.getLocalisations(sid) : api.getLocalisations(),
      ]);
      setData(eq);
      setLocalisations(loc);
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredData = data
    .filter((d) => !filterLocalisation || d.localisationId === filterLocalisation)
    .filter((d) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        d.nom?.toLowerCase().includes(q) ||
        d.localisation?.nom?.toLowerCase().includes(q) ||
        d.corpsEtat?.toLowerCase().includes(q)
      );
    });

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filteredData].sort((a, b) => {
      if (sortKey === "criticite") return compareCriticite(a.criticite, b.criticite) * dir;
      const va = sortKey === "nom" ? a.nom : sortKey === "localisation" ? a.localisation?.nom : a.corpsEtat;
      const vb = sortKey === "nom" ? b.nom : sortKey === "localisation" ? b.localisation?.nom : b.corpsEtat;
      return compareValues(va, vb) * dir;
    });
  }, [filteredData, sortKey, sortDir]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = { ...form, supermarketId: getCurrentSupermarketId() };
      if (editId) {
        await api.updateEquipment(editId, form);
      } else {
        await api.createEquipment(payload);
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
      title: "Supprimer l'équipement",
      message:
        "Voulez-vous vraiment supprimer cet équipement ? Toutes les interventions passées et les plans préventifs liés y resteront rattachés.",
      confirmText: "Supprimer",
      type: "danger",
    });
    if (!ok) return;
    try {
      await api.deleteEquipment(id);
      success("Équipement supprimé", "L'équipement a été supprimé avec succès");
      await load();
    } catch {
      toastError("Erreur", "Impossible de supprimer cet équipement.");
    }
  };

  const startEdit = (item: any) => {
    setForm({
      nom: item.nom,
      localisationId: item.localisationId || "",
      corpsEtat: item.corpsEtat || "",
    });
    setEditId(item.id);
    setShowForm(true);
  };

  return (
    <Shell
      title="Équipements"
      subtitle="Gestion des équipements par supermarché"
    >
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Settings size={18} className="text-slate-500" />
              Équipements
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {filteredData.length} / {data.length} entrée(s)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un équipement..."
                className="text-xs border border-slate-200 rounded-xl pl-7 pr-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange/30 w-48"
              />
            </div>
            <select
              value={filterLocalisation}
              onChange={(e) => setFilterLocalisation(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl pl-3 pr-7 py-1.5 appearance-none bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange/30"
            >
              <option value="">Toutes les localisations</option>
              {localisations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setShowForm(!showForm);
                setEditId(null);
                setForm({});
              }}
              className="btn-primary"
            >
              {showForm ? <X size={15} /> : <PlusCircle size={15} />}
              {showForm ? "Fermer" : "Ajouter"}
            </button>
          </div>
        </div>

        {showForm && (
          <div className="bg-slate-50 rounded-2xl p-5 mb-5 border border-slate-200 animate-fade-in">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">
              {editId ? "Modifier" : "Nouvel"} équipement
            </h3>
            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Nom
                  </label>
                  <input
                    value={form.nom || ""}
                    onChange={(e) => setForm({ ...form, nom: e.target.value })}
                    required
                    placeholder="Ex: Chambre froide"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Localisation
                  </label>
                  <Combobox
                    value={form.localisationId || ""}
                    onChange={(v) => setForm({ ...form, localisationId: v })}
                    required
                    placeholder="Rechercher une localisation..."
                    options={localisations.map((d) => ({ value: d.id, label: d.nom }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Corps d'état
                  </label>
                  <Combobox
                    value={form.corpsEtat || ""}
                    onChange={(v) => setForm({ ...form, corpsEtat: v })}
                    placeholder="Rechercher un corps d'état..."
                    options={CORPS_ETAT_LIST.map((ce) => ({ value: ce, label: ce }))}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Nécessaire pour que cet équipement apparaisse dans le filtre de création de ticket.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                >
                  {submitting ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Check size={15} />
                  )}
                  {submitting
                    ? "Enregistrement..."
                    : editId
                      ? "Modifier"
                      : "Créer"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditId(null);
                    setForm({});
                  }}
                  className="btn-secondary"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-orange" />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-14">
            <Settings size={44} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium">Aucun équipement</p>
            <p className="text-slate-400 text-sm">
              Aucun résultat pour {search.trim() ? "cette recherche" : "cette localisation"}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-3 pr-4 first:pl-1 cursor-pointer select-none hover:text-slate-600" onClick={() => handleSort("nom")}>
                    <span className="inline-flex items-center gap-1">Nom <SortIcon active={sortKey === "nom"} dir={sortDir} /></span>
                  </th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-3 pr-4 cursor-pointer select-none hover:text-slate-600" onClick={() => handleSort("localisation")}>
                    <span className="inline-flex items-center gap-1">Localisation <SortIcon active={sortKey === "localisation"} dir={sortDir} /></span>
                  </th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-3 pr-4 cursor-pointer select-none hover:text-slate-600" onClick={() => handleSort("corpsEtat")}>
                    <span className="inline-flex items-center gap-1">Corps d'état <SortIcon active={sortKey === "corpsEtat"} dir={sortDir} /></span>
                  </th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-3 pr-4 cursor-pointer select-none hover:text-slate-600" onClick={() => handleSort("criticite")}>
                    <span className="inline-flex items-center gap-1">Criticité <SortIcon active={sortKey === "criticite"} dir={sortDir} /></span>
                  </th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedData.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    <td className="py-3 pr-4 first:pl-1 text-slate-700 font-medium">
                      {row.nom}
                    </td>
                    <td className="py-3 pr-4 text-slate-500">
                      {row.localisation?.nom || "—"}
                    </td>
                    <td className="py-3 pr-4">
                      {row.corpsEtat ? (
                        <span className="text-slate-500">{row.corpsEtat}</span>
                      ) : (
                        <span
                          className="text-amber-600 text-[11px] font-semibold"
                          title="Sans corps d'état, cet équipement n'apparaît pas dans le filtre de création de ticket"
                        >
                          Manquant
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {row.criticite ? (
                        <span className={`badge badge-${row.criticite}`}>
                          {row.criticite}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(row)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                          title="Modifier"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            <path d="m15 5 4 4" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(row.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                          title="Supprimer"
                        >
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
