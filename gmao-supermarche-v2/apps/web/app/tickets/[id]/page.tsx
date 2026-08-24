"use client";
import Shell from "@/components/Shell";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  CheckCircle2, Loader2, AlertTriangle, ArrowLeft,
  Wrench, User, Calendar, XCircle, RotateCcw, Clock,
  MapPin, FolderOpen, Briefcase, DollarSign, Trash2, Edit, Save
} from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  NOUVEAU: "Nouveau", ASSIGNE: "Assigné", EN_COURS: "En cours",
  TERMINE: "Terminé", A_REPRENDRE: "À reprendre", FERME: "Fermé",
};
const PRIORITY_LABEL: Record<string, string> = {
  CRITIQUE: "Critique", HAUTE: "Haute", MOYENNE: "Moyenne", BASSE: "Basse",
};
const PRIORITY_BADGE: Record<string, string> = {
  CRITIQUE: "badge-critique", HAUTE: "badge-haute", MOYENNE: "badge-moyenne", BASSE: "badge-basse",
};
const STATUS_BADGE: Record<string, string> = {
  NOUVEAU: "status-nouveau", ASSIGNE: "status-assigne", EN_COURS: "status-en_cours",
  TERMINE: "status-termine", A_REPRENDRE: "status-a_reprendre", FERME: "status-ferme",
};
const STEPS = ["ASSIGNE", "EN_COURS", "TERMINE", "FERME"];

export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [ticket, setTicket] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showDoneForm, setShowDoneForm] = useState(false);
  const [motif, setMotif] = useState("");
  const [showMotifInput, setShowMotifInput] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});

  // Done form fields
  const [doneCout, setDoneCout] = useState("");
  const [doneTempsArret, setDoneTempsArret] = useState("");
  const [doneFinancement, setDoneFinancement] = useState("OPEX");
  const [donePaiement, setDonePaiement] = useState("Espèces");
  const [doneDateDebut, setDoneDateDebut] = useState("");
  const [doneDateFin, setDoneDateFin] = useState("");
  const [doneCommentaire, setDoneCommentaire] = useState("");
  const [doneImputation, setDoneImputation] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("gmao_user");
    if (raw) setUser(JSON.parse(raw));
    api.getTicket(id)
      .then((res) => {
        setTicket(res);
        setEditData({
          titre: res.titre,
          description: res.description || "",
          priority: res.priority,
          typeTravaux: res.typeTravaux || "",
          corpsEtat: res.corpsEtat || "",
        });
      })
      .catch(() => router.push("/tickets"))
      .finally(() => setLoading(false));
  }, [id, router]);

  const doAction = async (action: string) => {
    setActionLoading(action);
    try {
      if (action === "start") await api.startTicket(ticket.id);
      if (action === "done") {
        const data: any = {};
        if (doneCout) data.cout = parseFloat(doneCout);
        if (doneTempsArret) data.tempsArret = parseFloat(doneTempsArret);
        if (doneFinancement) data.financement = doneFinancement;
        if (donePaiement) data.paiement = donePaiement;
        if (doneDateDebut) data.dateDebutInterv = doneDateDebut;
        if (doneDateFin) data.dateFinInterv = doneDateFin;
        if (doneCommentaire) data.commentaireMaintenancier = doneCommentaire;
        if (doneImputation) data.imputation = doneImputation;
        await api.markDone(ticket.id, data);
      }
      if (action === "close") await api.closeTicket(ticket.id);
      if (action === "sendback") { await api.sendBack(ticket.id, motif); setShowMotifInput(false); }
      if (action === "delete") {
        if (!window.confirm("Voulez-vous vraiment supprimer ce ticket ? Cette action est irréversible.")) return setActionLoading(null);
        await api.deleteTicket(ticket.id);
        router.push("/tickets");
        return;
      }
      if (action === "save_edit") {
        await api.updateTicket(ticket.id, editData);
        setIsEditing(false);
      }
      const updated = await api.getTicket(ticket.id);
      setTicket(updated);
    } catch {
      // TODO: error toast
    } finally {
      setActionLoading(null);
    }
  };

  if (loading || !ticket) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-orange" />
        </div>
      </Shell>
    );
  }

  const isAdmin      = user?.role === "SUPER_ADMIN";
  const isMaintainer = user?.role === "MAINTENANCIER";
  const isMine       = ticket.assignedMaintenancier?.id === user?.id;
  const effectiveStatus = ticket.status === "A_REPRENDRE" ? "EN_COURS" : ticket.status;
  const stepIndex    = STEPS.indexOf(effectiveStatus);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const nowTime = now.toTimeString().slice(0, 5);

  if (user?.role === "USER" || user?.role === "MAINTENANCIER") {
    return (
      <div className="min-h-screen bg-slate-50 pb-20">
        <header className="sticky top-0 z-20 bg-white border-b border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 px-4 h-14">
            <button
              onClick={() => router.push(user?.role === "USER" ? "/demandeur" : "/maintenancier")}
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors shrink-0"
            >
              <ArrowLeft size={17} className="text-slate-700" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-slate-800 leading-tight">Détails de l'intervention</h1>
              <p className="text-[10px] text-slate-400">
                {ticket.equipment?.nom}
              </p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-orange/10 flex items-center justify-center">
              <Wrench size={16} className="text-orange" />
            </div>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
          {/* ── Motif banner ──────────────────────────── */}
          {ticket.status === "A_REPRENDRE" && ticket.motifReprise && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-start gap-3 animate-fade-in">
              <AlertTriangle size={18} className="text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-800">Travail à reprendre</p>
                <p className="text-sm text-yellow-700 mt-0.5">{ticket.motifReprise}</p>
              </div>
            </div>
          )}

          {/* ── Header card ───────────────────────────── */}
          <div className="card">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-mono font-bold text-slate-400">#{ticket.numero}</p>
                <h1 className="text-base font-bold text-slate-900 leading-tight">{ticket.titre}</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  {ticket.equipment?.nom}
                  {ticket.equipment?.localisation?.nom ? ` — ${ticket.equipment.localisation.nom}` : ""}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className={`badge ${PRIORITY_BADGE[ticket.priority]}`}>
                  {PRIORITY_LABEL[ticket.priority]}
                </span>
                <span className={`status-badge ${STATUS_BADGE[ticket.status]}`}>
                  {STATUS_LABEL[ticket.status]}
                </span>
              </div>
            </div>

            {/* Timeline */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex items-start justify-between relative">
                <div className="absolute left-[14px] right-[14px] top-[13px] h-0.5 bg-slate-200 z-0" />
                {STEPS.map((step, i) => {
                  const done   = i < stepIndex;
                  const active = i === stepIndex;
                  return (
                    <div key={step} className="relative z-10 flex flex-col items-center gap-1.5 flex-1">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center border-2 transition-all ${
                        done ? "bg-emerald-500 border-emerald-500" : active ? "bg-orange border-orange" : "bg-white border-slate-200"
                      }`}>
                        {done ? <CheckCircle2 size={14} className="text-white" /> : (
                          <div className={`h-2.5 w-2.5 rounded-full ${active ? "bg-white" : "bg-slate-200"}`} />
                        )}
                      </div>
                      <span className={`text-[10px] font-medium text-center ${
                        active ? "text-orange" : done ? "text-emerald-600" : "text-slate-400"
                      }`}>{STATUS_LABEL[step]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Détails GMAO ─────────────────────────── */}
          <div className="card space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Détails de la demande</h2>
            {ticket.description && (
              <p className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3 leading-relaxed">
                {ticket.description}
              </p>
            )}
            <div className="grid grid-cols-1 gap-2 text-xs text-slate-500">
              <InfoRow icon={<MapPin size={13} />}      label="Localisation"    value={ticket.localisation} />
              <InfoRow icon={<FolderOpen size={13} />}   label="Corps d'état"    value={ticket.corpsEtat} />
              <InfoRow icon={<Briefcase size={13} />}    label="Type de travaux" value={ticket.typeTravaux} />
              <InfoRow icon={<User size={13} />}         label="Demandeur"       value={ticket.createdBy?.nom} />
              <InfoRow icon={<Wrench size={13} />}       label="Technicien"      value={ticket.assignedMaintenancier?.nom || "Non assigné"} />
              <InfoRow icon={<Calendar size={13} />}     label="Créé le"         value={fmtDate(ticket.createdAt)} />
              {ticket.dateEnCours  && <InfoRow icon={<Clock size={13} />}        label="Pris en charge"  value={fmtDate(ticket.dateEnCours)} />}
              {ticket.dateTermine  && <InfoRow icon={<CheckCircle2 size={13} />} label="Terminé le"      value={fmtDate(ticket.dateTermine)} />}
              {ticket.dateFerme    && <InfoRow icon={<CheckCircle2 size={13} />} label="Fermé le"        value={fmtDate(ticket.dateFerme)} />}
            </div>
          </div>

          {/* ── Rapport d'intervention (maintenancier) ──── */}
          {(ticket.cout || ticket.tempsArret || ticket.financement || ticket.commentaireMaintenancier) && (
            <div className="card space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Rapport d'intervention</h2>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                {ticket.cout !== null && ticket.cout !== undefined && (
                  <InfoRow icon={<DollarSign size={13} />} label="Coût" value={`${ticket.cout.toLocaleString()} FCFA`} />
                )}
                {ticket.tempsArret !== null && ticket.tempsArret !== undefined && (
                  <InfoRow icon={<Clock size={13} />} label="Temps d'arrêt" value={`${ticket.tempsArret} h`} />
                )}
                {ticket.financement && <InfoRow icon={<Briefcase size={13} />} label="Financement" value={ticket.financement} />}
                {ticket.imputation && <InfoRow icon={<Briefcase size={13} />} label="Imputation" value={ticket.imputation} />}
                {ticket.paiement && <InfoRow icon={<DollarSign size={13} />} label="Paiement" value={ticket.paiement} />}
              </div>
              {ticket.commentaireMaintenancier && (
                <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 leading-relaxed">
                  <p className="font-semibold text-slate-700 mb-1">Commentaire du technicien :</p>
                  {ticket.commentaireMaintenancier}
                </div>
              )}
            </div>
          )}

          {/* ── Actions pour le technicien ── */}
          {isMaintainer && isMine && ["ASSIGNE", "A_REPRENDRE"].includes(ticket.status) && (
            <div className="card">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Actions disponibles</h2>
              <button onClick={() => doAction("start")} disabled={!!actionLoading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold rounded-2xl py-3.5 text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-md shadow-blue-500/20"
              >
                {actionLoading === "start" ? <Loader2 size={17} className="animate-spin" /> : <Wrench size={17} />}
                Prendre en charge
              </button>
            </div>
          )}

          {/* Formulaire de finalisation d'intervention */}
          {isMaintainer && isMine && ticket.status === "EN_COURS" && (
            <div className="card space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Finaliser l'intervention</h2>

              {!showDoneForm ? (
                <button onClick={() => setShowDoneForm(true)}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-semibold rounded-2xl py-3.5 text-sm hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-500/20"
                >
                  <CheckCircle2 size={17} /> Saisir le rapport d'intervention
                </button>
              ) : (
                <div className="space-y-3.5 animate-fade-in">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Coût (FCFA)</label>
                      <input type="number" value={doneCout} onChange={(e) => setDoneCout(e.target.value)}
                        placeholder="0" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Temps d'arrêt (heures)</label>
                      <input type="number" step="0.01" value={doneTempsArret} onChange={(e) => setDoneTempsArret(e.target.value)}
                        placeholder="0" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Financement</label>
                      <select value={doneFinancement} onChange={(e) => setDoneFinancement(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange transition-all">
                        <option value="OPEX">OPEX</option>
                        <option value="CAPEX">CAPEX</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Paiement</label>
                      <select value={donePaiement} onChange={(e) => setDonePaiement(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange transition-all">
                        <option value="Espèces">Espèces</option>
                        <option value="Bon de commande">Bon de commande</option>
                        <option value="Contrat de maintenance">Contrat de maintenance</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Imputation</label>
                      <select value={doneImputation} onChange={(e) => setDoneImputation(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange transition-all">
                        <option value="">-- Sélectionner --</option>
                        <option value="PLAYCE">PLAYCE</option>
                        <option value="ADIALEA">ADIALEA</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Commentaire du technicien</label>
                    <textarea value={doneCommentaire} onChange={(e) => setDoneCommentaire(e.target.value)}
                      rows={3} placeholder="Travaux effectués, observations..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange transition-all resize-none" />
                  </div>
                  <div className="flex gap-2 pt-1.5">
                    <button onClick={() => setShowDoneForm(false)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors">
                      Annuler
                    </button>
                    <button onClick={() => doAction("done")} disabled={!!actionLoading}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors shadow-sm">
                      {actionLoading === "done" ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      Valider
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <Shell title={ticket.equipment?.nom || "Ticket"} subtitle={ticket.equipment?.supermarket?.nom}>
      <div className="max-w-2xl mx-auto space-y-4 animate-slide-up">
        <button
          onClick={() => {
            if (user?.role === "USER") router.push("/demandeur");
            else if (user?.role === "MAINTENANCIER") router.push("/maintenancier");
            else router.back();
          }}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={15} /> {user?.role === "USER" ? "Retour à l'accueil" : user?.role === "MAINTENANCIER" ? "Mes interventions" : "Retour aux tickets"}
        </button>

        {/* ── Header card ───────────────────────────── */}
        <div className="card">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-mono font-bold text-slate-400">#{ticket.numero}</p>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">{ticket.titre}</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {ticket.equipment?.nom}
                {ticket.equipment?.localisation?.nom ? ` — ${ticket.equipment.localisation.nom}` : ""}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className={`badge ${PRIORITY_BADGE[ticket.priority]}`}>
                {PRIORITY_LABEL[ticket.priority]}
              </span>
              <span className={`status-badge ${STATUS_BADGE[ticket.status]}`}>
                {STATUS_LABEL[ticket.status]}
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-start justify-between relative">
              <div className="absolute left-[14px] right-[14px] top-[13px] h-0.5 bg-slate-200 z-0" />
              {STEPS.map((step, i) => {
                const done   = i < stepIndex;
                const active = i === stepIndex;
                return (
                  <div key={step} className="relative z-10 flex flex-col items-center gap-1.5 flex-1">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center border-2 transition-all ${
                      done ? "bg-emerald-500 border-emerald-500" : active ? "bg-orange border-orange" : "bg-white border-slate-200"
                    }`}>
                      {done ? <CheckCircle2 size={14} className="text-white" /> : (
                        <div className={`h-2.5 w-2.5 rounded-full ${active ? "bg-white" : "bg-slate-200"}`} />
                      )}
                    </div>
                    <span className={`text-[10px] font-medium text-center ${
                      active ? "text-orange" : done ? "text-emerald-600" : "text-slate-400"
                    }`}>{STATUS_LABEL[step]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Motif banner ──────────────────────────── */}
        {ticket.status === "A_REPRENDRE" && ticket.motifReprise && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-start gap-3 animate-fade-in">
            <AlertTriangle size={18} className="text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-800">Travail à reprendre</p>
              <p className="text-sm text-yellow-700 mt-0.5">{ticket.motifReprise}</p>
            </div>
          </div>
        )}

        {/* ── Admin Edit/Delete Controls ───────────── */}
        {isAdmin && (
          <div className="flex gap-2 justify-end mb-4 animate-fade-in">
            {!isEditing ? (
              <>
                <button onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                  <Edit size={14} /> Éditer
                </button>
                <button onClick={() => doAction("delete")} disabled={!!actionLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
                  {actionLoading === "delete" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Supprimer
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setIsEditing(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                  Annuler
                </button>
                <button onClick={() => doAction("save_edit")} disabled={!!actionLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-orange text-white rounded-lg hover:bg-orange/90 transition-colors disabled:opacity-50">
                  {actionLoading === "save_edit" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Détails GMAO ─────────────────────────── */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Détails de la demande</h2>
          
          {isEditing ? (
            <div className="space-y-3 animate-fade-in border-l-2 border-orange pl-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Titre</label>
                <input type="text" value={editData.titre} onChange={(e) => setEditData({...editData, titre: e.target.value})} className="input" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                <textarea value={editData.description} onChange={(e) => setEditData({...editData, description: e.target.value})} rows={3} className="input resize-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Priorité</label>
                  <select value={editData.priority} onChange={(e) => setEditData({...editData, priority: e.target.value})} className="select">
                    <option value="CRITIQUE">Critique</option>
                    <option value="HAUTE">Haute</option>
                    <option value="MOYENNE">Moyenne</option>
                    <option value="BASSE">Basse</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Type de travaux</label>
                  <select value={editData.typeTravaux} onChange={(e) => setEditData({...editData, typeTravaux: e.target.value})} className="select">
                    <option value="MAINT_CORRECTIVE">Maint. Corrective</option>
                    <option value="MAINT_PREVENTIVE">Maint. Préventive</option>
                    <option value="TRAVAUX_NEUFS">Travaux Neufs</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Corps d'état</label>
                  <input type="text" value={editData.corpsEtat} onChange={(e) => setEditData({...editData, corpsEtat: e.target.value})} className="input" />
                </div>
              </div>
            </div>
          ) : (
            <>
              {ticket.description && (
                <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 leading-relaxed">
                  {ticket.description}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-500">
                <InfoRow icon={<MapPin size={13} />}      label="Localisation"    value={ticket.localisation} />
                <InfoRow icon={<FolderOpen size={13} />}   label="Corps d'état"    value={ticket.corpsEtat} />
                <InfoRow icon={<Briefcase size={13} />}    label="Type de travaux" value={ticket.typeTravaux} />
                <InfoRow icon={<User size={13} />}         label="Demandeur"       value={ticket.createdBy?.nom} />
                <InfoRow icon={<Wrench size={13} />}       label="Technicien"      value={ticket.assignedMaintenancier?.nom || "Non assigné"} />
                <InfoRow icon={<Calendar size={13} />}     label="Créé le"         value={fmtDate(ticket.createdAt)} />
                {ticket.dateEnCours  && <InfoRow icon={<Clock size={13} />}        label="Pris en charge"  value={fmtDate(ticket.dateEnCours)} />}
                {ticket.dateTermine  && <InfoRow icon={<CheckCircle2 size={13} />} label="Terminé le"      value={fmtDate(ticket.dateTermine)} />}
                {ticket.dateFerme    && <InfoRow icon={<CheckCircle2 size={13} />} label="Fermé le"        value={fmtDate(ticket.dateFerme)} />}
                {ticket.closedBy     && <InfoRow icon={<User size={13} />}         label="Fermé par"       value={ticket.closedBy?.nom} />}
              </div>
            </>
          )}
        </div>

        {/* ── Rapport d'intervention (maintenancier) ──── */}
        {(ticket.cout || ticket.tempsArret || ticket.financement || ticket.commentaireMaintenancier) && (
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Rapport d'intervention</h2>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
              {ticket.cout !== null && ticket.cout !== undefined && (
                <InfoRow icon={<DollarSign size={13} />} label="Coût" value={`${ticket.cout.toLocaleString()} FCFA`} />
              )}
              {ticket.tempsArret !== null && ticket.tempsArret !== undefined && (
                <InfoRow icon={<Clock size={13} />} label="Temps d'arrêt" value={`${ticket.tempsArret} h`} />
              )}
              {ticket.financement && <InfoRow icon={<Briefcase size={13} />} label="Financement" value={ticket.financement} />}
              {ticket.imputation && <InfoRow icon={<Briefcase size={13} />} label="Imputation" value={ticket.imputation} />}
              {ticket.paiement && <InfoRow icon={<DollarSign size={13} />} label="Paiement" value={ticket.paiement} />}
              {ticket.dateDebutInterv && <InfoRow icon={<Calendar size={13} />} label="Début interv." value={fmtDate(ticket.dateDebutInterv)} />}
              {ticket.dateFinInterv && <InfoRow icon={<Calendar size={13} />} label="Fin interv." value={fmtDate(ticket.dateFinInterv)} />}
            </div>
            {ticket.commentaireMaintenancier && (
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 leading-relaxed">
                <p className="font-semibold text-slate-700 mb-1">Commentaire du technicien :</p>
                {ticket.commentaireMaintenancier}
              </div>
            )}
          </div>
        )}

        {/* ── Actions ───────────────────────────────── */}
        {isMaintainer && isMine && ["ASSIGNE", "A_REPRENDRE"].includes(ticket.status) && (
          <div className="card">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Actions disponibles</h2>
            <button onClick={() => doAction("start")} disabled={!!actionLoading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold rounded-xl py-3 text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {actionLoading === "start" ? <Loader2 size={17} className="animate-spin" /> : <Wrench size={17} />}
              Prendre en charge
            </button>
          </div>
        )}

        {/* Maintenancier — marquer terminé + formulaire */}
        {isMaintainer && isMine && ticket.status === "EN_COURS" && (
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">Finaliser l'intervention</h2>

            {!showDoneForm ? (
              <button onClick={() => setShowDoneForm(true)}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-semibold rounded-xl py-3 text-sm hover:bg-emerald-700 transition-colors"
              >
                <CheckCircle2 size={17} /> Saisir le rapport d'intervention
              </button>
            ) : (
              <div className="space-y-3 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Coût (FCFA)</label>
                    <input type="number" value={doneCout} onChange={(e) => setDoneCout(e.target.value)}
                      placeholder="0" className="input" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Temps d'arrêt (heures)</label>
                    <input type="number" step="0.01" value={doneTempsArret} onChange={(e) => setDoneTempsArret(e.target.value)}
                      placeholder="0" className="input" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Financement</label>
                    <select value={doneFinancement} onChange={(e) => setDoneFinancement(e.target.value)} className="select">
                      <option value="OPEX">OPEX</option>
                      <option value="CAPEX">CAPEX</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Paiement</label>
                    <select value={donePaiement} onChange={(e) => setDonePaiement(e.target.value)} className="select">
                      <option value="Espèces">Espèces</option>
                      <option value="Bon de commande">Bon de commande</option>
                      <option value="Contrat de maintenance">Contrat de maintenance</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Imputation</label>
                    <select value={doneImputation} onChange={(e) => setDoneImputation(e.target.value)} className="select">
                      <option value="">-- Sélectionner --</option>
                      <option value="PLAYCE">PLAYCE</option>
                      <option value="ADIALEA">ADIALEA</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Date début intervention</label>
                    <input type="datetime-local" value={doneDateDebut} onChange={(e) => setDoneDateDebut(e.target.value)}
                      className="input" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Date fin intervention</label>
                    <input type="datetime-local" value={doneDateFin} onChange={(e) => setDoneDateFin(e.target.value)}
                      className="input" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Commentaire du technicien</label>
                  <textarea value={doneCommentaire} onChange={(e) => setDoneCommentaire(e.target.value)}
                    rows={3} placeholder="Travaux effectués, pièces remplacées, observations..."
                    className="input resize-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowDoneForm(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
                    Annuler
                  </button>
                  <button onClick={() => doAction("done")} disabled={!!actionLoading}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
                    {actionLoading === "done" ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    Valider et terminer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Admin */}
        {isAdmin && ticket.status === "TERMINE" && (
          <div className="card">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Validation finale (Admin)</h2>
            <div className="space-y-2">
              <button onClick={() => doAction("close")} disabled={!!actionLoading}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-semibold rounded-xl py-3 text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50">
                {actionLoading === "close" ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
                Fermer définitivement le ticket
              </button>
              {!showMotifInput ? (
                <button onClick={() => setShowMotifInput(true)}
                  className="w-full flex items-center justify-center gap-2 border-2 border-red-200 text-red-600 font-semibold rounded-xl py-3 text-sm hover:bg-red-50 transition-colors">
                  <RotateCcw size={17} /> Renvoyer avec motif
                </button>
              ) : (
                <div className="space-y-2 animate-fade-in">
                  <textarea value={motif} onChange={(e) => setMotif(e.target.value)}
                    rows={3} placeholder="Expliquez pourquoi le travail n'est pas satisfaisant..."
                    className="input resize-none border-red-200 focus:border-red-400 focus:ring-red-100" />
                  <div className="flex gap-2">
                    <button onClick={() => { setShowMotifInput(false); setMotif(""); }}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
                      Annuler
                    </button>
                    <button onClick={() => doAction("sendback")} disabled={!motif.trim() || !!actionLoading}
                      className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
                      {actionLoading === "sendback" ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                      Renvoyer
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400">{icon}</span>
      <span>{label} : <b className="text-slate-700 font-medium">{value || "—"}</b></span>
    </div>
  );
}

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
