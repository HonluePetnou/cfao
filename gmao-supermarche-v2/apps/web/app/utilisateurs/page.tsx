"use client";
import Shell from "@/components/Shell";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Users, PlusCircle, Loader2, Trash2, Check, X, Eye, EyeOff, KeyRound } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin", MAINTENANCIER: "Maintenancier", USER: "Demandeur",
};

export default function UtilisateursPage() {
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [localisations, setLocalisations] = useState<any[]>([]);
  const [supermarkets, setSupermarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState("");
  const [filterDept, setFilterDept] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Reset password modal
  const [resetTarget, setResetTarget] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  const getCurrentSupermarketId = () =>
    typeof window !== "undefined" ? sessionStorage.getItem("gmao_current_supermarket") : null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sid = getCurrentSupermarketId();
      const [users, loc, sms] = await Promise.all([
        api.getUsers(),
        sid ? api.getLocalisations(sid) : api.getLocalisations(),
        api.getSupermarkets(),
      ]);
      setLocalisations(loc);
      setSupermarkets(sms);
      // Seul un "USER" (demandeur) est rattaché à un site précis. Un Super
      // Admin ou un Maintenancier est universel par conception (voir
      // PLAN_IMPLEMENTATION_GMAO_v2.md) : il doit rester visible quel que
      // soit le site sélectionné dans la barre du haut, sinon deux admins
      // peuvent devenir mutuellement invisibles selon leur sélection.
      setData(sid ? users.filter((u: any) => u.role !== "USER" || u.supermarketId === sid || !u.supermarketId) : users);
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const filteredData = data.filter((u) => {
    if (filterRole && u.role !== filterRole) return false;
    // Même raisonnement que dans `load` : un Super Admin/Maintenancier n'a
    // pas de site, donc ce filtre ne doit s'appliquer qu'aux Demandeurs —
    // sinon choisir un département masque systématiquement tous les admins.
    if (filterDept && u.role === "USER" && u.supermarketId !== filterDept) return false;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      // Seul un "USER" (demandeur) doit être rattaché au site actuellement
      // sélectionné dans la barre du haut. Un Super Admin ou un Maintenancier
      // est universel — lui coller ce site le rend invisible dans la liste
      // dès qu'un autre site est sélectionné (voir le filtre dans `load`).
      const payload: any = { ...form, supermarketId: form.role === "USER" ? getCurrentSupermarketId() : null };
      if (editId) {
        if (!payload.password) delete payload.password;
        await api.updateUser(editId, payload);
      } else {
        await api.createUser(payload);
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
    if (!confirm("Supprimer cet utilisateur ?")) return;
    try { await api.deleteUser(id); await load(); }
    catch { alert("Impossible de supprimer cet utilisateur."); }
  };

  const startEdit = (item: any) => {
    setForm({ nom: item.nom, email: item.email, role: item.role, localisationId: item.localisationId || "" });
    setEditId(item.id);
    setShowForm(true);
  };

  const handleResetPassword = async () => {
    if (!resetTarget || !newPassword) return;
    setResetting(true);
    try {
      await api.updateUser(resetTarget.id, { password: newPassword });
      setResetTarget(null);
      setNewPassword("");
      alert("Mot de passe réinitialisé avec succès");
    } catch {
      alert("Erreur lors de la réinitialisation");
    } finally {
      setResetting(false);
    }
  };

  return (
    <Shell title="Utilisateurs" subtitle="Gestion des utilisateurs">
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Users size={18} className="text-slate-500" />
              Utilisateurs
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{filteredData.length} / {data.length} utilisateur(s)</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl pl-3 pr-7 py-1.5 appearance-none bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange/30">
              <option value="">Tous les rôles</option>
              {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl pl-3 pr-7 py-1.5 appearance-none bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange/30">
              <option value="">Tous les départements</option>
              {supermarkets.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
            <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({}); }} className="btn-primary">
            {showForm ? <X size={15} /> : <PlusCircle size={15} />}
            {showForm ? "Fermer" : "Ajouter"}
          </button>
          </div>
        </div>

        {showForm && (
          <div className="bg-slate-50 rounded-2xl p-5 mb-5 border border-slate-200 animate-fade-in">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">
              {editId ? "Modifier" : "Nouvel"} utilisateur
            </h3>
            {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nom complet <span className="text-orange">*</span></label>
                  <input value={form.nom || ""} onChange={(e) => setForm({ ...form, nom: e.target.value })} required placeholder="Ex: Jean Dupont" className="input" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email <span className="text-orange">*</span></label>
                  <input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="jean@gmao.local" className="input" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Mot de passe {!editId && <span className="text-orange">*</span>}
                    {editId && <span className="text-slate-400 text-[10px] ml-1">(laisser vide pour conserver)</span>}
                  </label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} value={form.password || ""} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editId} placeholder="••••••••" className="input pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Rôle <span className="text-orange">*</span></label>
                  <select value={form.role || ""} onChange={(e) => setForm({ ...form, role: e.target.value })} required className="select">
                    <option value="">Sélectionner...</option>
                    {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Localisation</label>
                  <select value={form.localisationId || ""} onChange={(e) => setForm({ ...form, localisationId: e.target.value })} className="select">
                    <option value="">Aucun</option>
                    {localisations.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
                  </select>
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

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-orange" /></div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-14">
            <Users size={44} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium">Aucun utilisateur</p>
            <p className="text-slate-400 text-sm">Aucun résultat pour ces filtres.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-3 pr-4 first:pl-1">Nom</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-3 pr-4">Email</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-3 pr-4">Rôle</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-3 pr-4">Mot de passe</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredData.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-3 pr-4 first:pl-1 text-slate-700 font-medium">{row.nom}</td>
                    <td className="py-3 pr-4 text-slate-500">{row.email}</td>
                    <td className="py-3 pr-4">
                      <span className="status-badge status-assigne">{ROLE_LABEL[row.role] || row.role}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <button onClick={() => { setResetTarget(row); setNewPassword(""); }} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-orange transition-colors">
                        <KeyRound size={13} /> Réinitialiser
                      </button>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(row)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title="Modifier">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                        </button>
                        <button onClick={() => handleDelete(row.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="Supprimer">
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

      {/* Reset password modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setResetTarget(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-navy mb-1">Réinitialiser le mot de passe</h3>
            <p className="text-xs text-slate-400 mb-4">{resetTarget.nom} ({resetTarget.email})</p>
            <label className="block text-xs font-semibold text-navy mb-1">Nouveau mot de passe</label>
            <div className="relative mb-4">
              <input type={showNewPwd ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="input pr-10" autoFocus />
              <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={handleResetPassword} disabled={resetting || !newPassword} className="btn-primary flex-1">
                {resetting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                {resetting ? "Réinitialisation..." : "Réinitialiser"}
              </button>
              <button onClick={() => setResetTarget(null)} className="btn-secondary">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
