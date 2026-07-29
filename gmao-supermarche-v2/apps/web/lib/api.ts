const API = "";

async function fetchApi(path: string, options?: RequestInit) {
  const token = typeof window !== "undefined" ? sessionStorage.getItem("gmao_token") : null;
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "Erreur API");
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    fetchApi("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => fetchApi("/api/auth/me"),

  // Supermarkets
  getSupermarkets: () => fetchApi("/api/supermarkets"),
  createSupermarket: (data: any) =>
    fetchApi("/api/supermarkets", { method: "POST", body: JSON.stringify(data) }),
  updateSupermarket: (id: string, data: any) =>
    fetchApi(`/api/supermarkets/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSupermarket: (id: string) =>
    fetchApi(`/api/supermarkets/${id}`, { method: "DELETE" }),

  // Localisations
  getLocalisations: (supermarketId?: string) =>
    fetchApi(`/api/localisations${supermarketId ? `?supermarketId=${supermarketId}` : ""}`),
  createLocalisation: (data: any) =>
    fetchApi("/api/localisations", { method: "POST", body: JSON.stringify(data) }),
  updateLocalisation: (id: string, data: any) =>
    fetchApi(`/api/localisations/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteLocalisation: (id: string) =>
    fetchApi(`/api/localisations/${id}`, { method: "DELETE" }),

  // Equipments
  getEquipments: (params?: { supermarketId?: string; localisationId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.supermarketId) qs.set("supermarketId", params.supermarketId);
    if (params?.localisationId) qs.set("localisationId", params.localisationId);
    const query = qs.toString();
    return fetchApi(`/api/equipments${query ? `?${query}` : ""}`);
  },
  createEquipment: (data: any) =>
    fetchApi("/api/equipments", { method: "POST", body: JSON.stringify(data) }),
  updateEquipment: (id: string, data: any) =>
    fetchApi(`/api/equipments/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteEquipment: (id: string) =>
    fetchApi(`/api/equipments/${id}`, { method: "DELETE" }),

  // Maintenanciers
  getMaintenanciers: () => fetchApi("/api/maintenanciers"),

  // Tickets
  getTickets: (params?: { status?: string; maintenancierId?: string; createdById?: string; supermarketId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.maintenancierId) qs.set("maintenancierId", params.maintenancierId);
    if (params?.createdById) qs.set("createdById", params.createdById);
    if (params?.supermarketId) qs.set("supermarketId", params.supermarketId);
    const query = qs.toString();
    return fetchApi(`/api/tickets${query ? `?${query}` : ""}`);
  },
  getTicket: (id: string) => fetchApi(`/api/tickets/${id}`),
  createTicket: (data: any) =>
    fetchApi("/api/tickets", { method: "POST", body: JSON.stringify(data) }),
  startTicket: (id: string) =>
    fetchApi(`/api/tickets/${id}/start`, { method: "PATCH" }),
  markDone: (id: string, data?: any) =>
    fetchApi(`/api/tickets/${id}/done`, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  closeTicket: (id: string) =>
    fetchApi(`/api/tickets/${id}/close`, { method: "PATCH" }),
  sendBack: (id: string, motif: string) =>
    fetchApi(`/api/tickets/${id}/send-back`, { method: "PATCH", body: JSON.stringify({ motif }) }),
  updateTicket: (id: string, data: any) =>
    fetchApi(`/api/tickets/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTicket: (id: string) =>
    fetchApi(`/api/tickets/${id}`, { method: "DELETE" }),

  // Users (admin)
  getUsers: () => fetchApi("/api/users"),
  createUser: (data: any) =>
    fetchApi("/api/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) =>
    fetchApi(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteUser: (id: string) =>
    fetchApi(`/api/users/${id}`, { method: "DELETE" }),

  // Preventive plans
  getPreventivePlans: () => fetchApi("/api/preventive-plans"),
  createPreventivePlan: (data: any) =>
    fetchApi("/api/preventive-plans", { method: "POST", body: JSON.stringify(data) }),
  updatePreventivePlan: (id: string, data: any) =>
    fetchApi(`/api/preventive-plans/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePreventivePlan: (id: string) =>
    fetchApi(`/api/preventive-plans/${id}`, { method: "DELETE" }),

  // Preventive tasks
  getMyPreventiveTasks: () => fetchApi("/api/preventive-tasks/my"),
  getProjectedPreventiveTasks: () => fetchApi("/api/preventive-tasks/projected"),
  markPreventiveTaskDone: (id: string, note?: string) =>
    fetchApi(`/api/preventive-tasks/${id}/done`, { method: "PATCH", body: JSON.stringify({ note }) }),
  getPublicPreventiveTask: (id: string) =>
    fetchApi(`/api/preventive-tasks/public/${id}`),
  submitPublicPreventiveTask: (id: string, data: { note: string; cout?: number; tempsArret?: number; imputation?: string }) =>
    fetchApi(`/api/preventive-tasks/public/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // Cron
  triggerGenerateTasks: () =>
    fetchApi("/api/cron/generate-tasks", { method: "POST" }),

  // Rapports journaliers
  getRapportsJournaliers: (params?: { maintenancierId?: string; dateDebut?: string; dateFin?: string }) => {
    const qs = new URLSearchParams();
    if (params?.maintenancierId) qs.set("maintenancierId", params.maintenancierId);
    if (params?.dateDebut) qs.set("dateDebut", params.dateDebut);
    if (params?.dateFin) qs.set("dateFin", params.dateFin);
    const query = qs.toString();
    return fetchApi(`/api/rapports-journaliers${query ? `?${query}` : ""}`);
  },
  createRapportJournalier: (data: any) =>
    fetchApi("/api/rapports-journaliers", { method: "POST", body: JSON.stringify(data) }),
  updateRapportJournalier: (id: string, data: any) =>
    fetchApi(`/api/rapports-journaliers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteRapportJournalier: (id: string) =>
    fetchApi(`/api/rapports-journaliers/${id}`, { method: "DELETE" }),
  signerRapport: (id: string, role: "technicien" | "responsable", nom?: string) =>
    fetchApi(`/api/rapports-journaliers/${id}/signer`, {
      method: "PATCH",
      body: JSON.stringify({ role, nom }),
    }),
  signerTousRapports: (date: string, nom?: string) =>
    fetchApi("/api/rapports-journaliers/signer-tous", {
      method: "POST",
      body: JSON.stringify({ date, nom }),
    }),

  // Export
  exportXlsx: async (from?: string, to?: string, supermarketId?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (supermarketId) qs.set("supermarketId", supermarketId);
    const query = qs.toString();
    const token = sessionStorage.getItem("gmao_token");
    const res = await fetch(`/api/export/xlsx${query ? `?${query}` : ""}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Erreur d'export");
    return res.blob();
  },

  // Rapports journaliers - génération auto
  generateRapportJournalier: async (date: string) => {
    const token = sessionStorage.getItem("gmao_token");
    const res = await fetch("/api/rapports-journaliers/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ date }),
    });
    if (!res.ok) throw new Error("Erreur de génération du rapport");
    return res.json();
  },

  exportRapportPdf: async (id: string) => {
    const token = sessionStorage.getItem("gmao_token");
    const res = await fetch(`/api/rapports-journaliers/${id}/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Erreur d'export PDF");
    return res.blob();
  },

  exportPdf: async (from?: string, to?: string, supermarketId?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (supermarketId) qs.set("supermarketId", supermarketId);
    const query = qs.toString();
    const token = sessionStorage.getItem("gmao_token");
    const res = await fetch(`/api/export/pdf${query ? `?${query}` : ""}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Erreur d'export PDF");
    return res.blob();
  },

  // KPI
  getKpi: () => fetchApi("/api/kpi"),
  getGmaoKpis: (params?: { supermarketId?: string; equipmentId?: string; dateDebut?: string; dateFin?: string; financement?: string; imputation?: string }) => {
    const cleanParams: any = {};
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== "") {
          cleanParams[key] = value;
        }
      }
    }
    const query = new URLSearchParams(cleanParams).toString();
    return fetchApi(`/api/kpi/gmao${query ? `?${query}` : ""}`);
  },

  // Rondes journalières
  getRondeConfig: (supermarketId: string) =>
    fetchApi(`/api/rondes/config/${supermarketId}`),
  upsertRondeConfig: (supermarketId: string, zones: any[]) =>
    fetchApi(`/api/rondes/config/${supermarketId}`, {
      method: "POST",
      body: JSON.stringify({ zones }),
    }),
  getRondes: (params?: { supermarketId?: string; maintenancierId?: string; dateDebut?: string; dateFin?: string }) => {
    const qs = new URLSearchParams();
    if (params?.supermarketId) qs.set("supermarketId", params.supermarketId);
    if (params?.maintenancierId) qs.set("maintenancierId", params.maintenancierId);
    if (params?.dateDebut) qs.set("dateDebut", params.dateDebut);
    if (params?.dateFin) qs.set("dateFin", params.dateFin);
    const query = qs.toString();
    return fetchApi(`/api/rondes${query ? `?${query}` : ""}`);
  },
  getRonde: (id: string) => fetchApi(`/api/rondes/${id}`),
  createRonde: (data: any) =>
    fetchApi("/api/rondes", { method: "POST", body: JSON.stringify(data) }),
  updateRonde: (id: string, data: any) =>
    fetchApi(`/api/rondes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  signerRonde: (id: string, role: "technicien" | "permanent" | "dm", nom?: string) =>
    fetchApi(`/api/rondes/${id}/signer`, {
      method: "PATCH",
      body: JSON.stringify({ role, nom }),
    }),
  deleteRonde: (id: string) =>
    fetchApi(`/api/rondes/${id}`, { method: "DELETE" }),
};
