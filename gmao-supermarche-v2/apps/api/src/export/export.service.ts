import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import * as XLSX from "xlsx";

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  async exportXlsx(from?: string, to?: string, supermarketId?: string) {
    const dateFilter: any = {};
    if (from || to) {
      dateFilter.gte = from ? new Date(from) : undefined;
      dateFilter.lte = to ? new Date(to) : undefined;
    }

    const whereDate = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

    // Filters based on supermarket
    const supermarketFilter = supermarketId ? { id: supermarketId } : {};
    const subSupermarketFilter = supermarketId ? { supermarketId } : {};
    const equipmentSupermarketFilter = supermarketId ? { supermarketId } : {};
    const userSupermarketFilter = supermarketId ? { supermarketId } : {};

    const ticketFilter: any = { ...whereDate };
    if (supermarketId) {
      ticketFilter.equipment = { supermarketId };
    }

    const planFilter: any = {};
    if (supermarketId) {
      planFilter.equipment = { supermarketId };
    }

    const taskFilter: any = { ...whereDate };
    if (supermarketId) {
      taskFilter.plan = { equipment: { supermarketId } };
    }

    const rapportFilter: any = {};
    if (from || to) {
      const rDate: any = {};
      if (from) rDate.gte = new Date(from);
      if (to) rDate.lte = new Date(to);
      rapportFilter.date = rDate;
    }
    if (supermarketId) {
      rapportFilter.maintenancier = { supermarketId };
    }

    const rondeFilter: any = { ...subSupermarketFilter };
    if (from || to) {
      const rDate: any = {};
      if (from) rDate.gte = new Date(from);
      if (to) rDate.lte = new Date(to);
      rondeFilter.date = rDate;
    }

    const [
      supermarkets,
      localisations,
      users,
      equipments,
      tickets,
      plans,
      tasks,
      rapports,
      rondes,
      kpi,
    ] = await Promise.all([
      this.prisma.supermarket.findMany({ where: supermarketFilter }),
      this.prisma.localisation.findMany({
        where: subSupermarketFilter,
        include: { supermarket: { select: { nom: true } } },
      }),
      this.prisma.user.findMany({
        where: userSupermarketFilter,
        select: { id: true, nom: true, email: true, role: true, phone: true, active: true, supermarketId: true, createdAt: true },
      }),
      this.prisma.equipment.findMany({
        where: {
          ...equipmentSupermarketFilter,
          ...(Object.keys(whereDate).length ? { createdAt: dateFilter } : {}),
        },
        include: { supermarket: { select: { nom: true } }, localisation: { select: { nom: true } } },
      }),
      this.prisma.ticket.findMany({
        where: ticketFilter,
        include: {
          equipment: { select: { nom: true, supermarketId: true } },
          createdBy: { select: { nom: true } },
          assignedMaintenancier: { select: { nom: true } },
          closedBy: { select: { nom: true } },
        },
      }),
      this.prisma.preventivePlan.findMany({
        where: planFilter,
        include: { equipment: { select: { nom: true } }, assignedMaintenancier: { select: { nom: true } } },
      }),
      this.prisma.preventiveTask.findMany({
        where: taskFilter,
        include: { plan: { select: { titre: true, equipment: { select: { nom: true } } } } },
      }),
      this.prisma.rapportJournalier.findMany({
        where: rapportFilter,
        include: { maintenancier: { select: { nom: true, supermarket: { select: { nom: true } } } } },
      }),
      this.prisma.rondeJournaliere.findMany({
        where: rondeFilter,
        include: {
          maintenancier: { select: { nom: true } },
          supermarket: { select: { nom: true } },
        },
      }),
      this.prisma.ticket.aggregate({
        _count: { id: true },
        where: ticketFilter,
      }),
    ]);

    const wb = XLSX.utils.book_new();

    // KPIs (première feuille)
    const totalTickets = kpi._count.id;
    const closedCount = tickets.filter(t => t.status === "FERME").length;
    const doneCount = tickets.filter(t => ["TERMINE", "FERME"].includes(t.status)).length;

    const byPriority: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    tickets.forEach(t => {
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    });

    const kpiRows = [
      { Indicateur: "Total Tickets", Valeur: totalTickets },
      { Indicateur: "Tickets Fermés", Valeur: closedCount },
      { Indicateur: "Tickets Terminés + Fermés", Valeur: doneCount },
      { Indicateur: "Taux de fermeture (%)", Valeur: totalTickets > 0 ? Math.round((closedCount / totalTickets) * 100) : 0 },
    ];
    Object.entries(byPriority).forEach(([p, count]) => kpiRows.push({ Indicateur: `Priorité ${p}`, Valeur: count }));
    Object.entries(byStatus).forEach(([s, count]) => kpiRows.push({ Indicateur: `Statut ${s}`, Valeur: count }));

    const kpiSheet = XLSX.utils.json_to_sheet(kpiRows);
    kpiSheet["!cols"] = [{ wch: 30 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, kpiSheet, "KPIs");

    // Supermarkets
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.json_to_sheet(supermarkets.map(s => ({ ID: s.id, Nom: s.nom, Code: s.code, Créé_le: s.createdAt.toISOString().split("T")[0] }))),
      "Supermarchés"
    );

    // Localisations
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.json_to_sheet(localisations.map(l => ({ ID: l.id, Nom: l.nom, Supermarché: l.supermarket?.nom || "" }))),
      "Localisations"
    );

    // Users
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.json_to_sheet(users.map(u => ({ ID: u.id, Nom: u.nom, Email: u.email, Rôle: u.role, Téléphone: u.phone || "", Actif: u.active ? "Oui" : "Non", Supermarché_ID: u.supermarketId || "", Créé_le: u.createdAt.toISOString().split("T")[0] }))),
      "Utilisateurs"
    );

    // Equipment
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.json_to_sheet(equipments.map(e => ({
        ID: e.id, Nom: e.nom, Criticité: e.criticite || "", "Corps d'état": e.corpsEtat || "",
        Supermarché: e.supermarket?.nom || "", Localisation: e.localisation?.nom || "",
        Description: e.description || "", Actif: e.active ? "Oui" : "Non",
        Créé_le: e.createdAt.toISOString().split("T")[0],
      }))),
      "Équipements"
    );

    // Tickets
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.json_to_sheet(tickets.map(t => ({
        ID: t.id, Titre: t.titre, Priorité: t.priority, Statut: t.status,
        Équipement: t.equipment?.nom || "", Demandeur: t.createdBy?.nom || "",
        Maintenancier: t.assignedMaintenancier?.nom || "",
        "Type travaux": t.typeTravaux || "", "Corps d'état": t.corpsEtat || "",
        Localisation: t.localisation || "", Coût: t.cout ?? "", "Temps arrêt": t.tempsArret ?? "",
        Financement: t.financement || "", Paiement: t.paiement || "",
        Description: t.description || "", "Commentaire MTN": t.commentaireMaintenancier || "",
        Créé_le: t.createdAt.toISOString().split("T")[0],
        Assigné_le: t.dateAssigned?.toISOString().split("T")[0] || "",
        Terminé_le: t.dateTermine?.toISOString().split("T")[0] || "",
        Fermé_le: t.dateFerme?.toISOString().split("T")[0] || "",
      }))),
      "Tickets"
    );

    // Preventive plans
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.json_to_sheet(plans.map(p => ({
        ID: p.id, Titre: p.titre, Équipement: p.equipment?.nom || "",
        Fréquence: `${p.intervalValue} ${p.intervalUnit}`, Checklist: p.checklist || "",
        Maintenancier: p.assignedMaintenancier?.nom || "Prestataire externe",
        Actif: p.active ? "Oui" : "Non", Prochaine: p.nextDate.toISOString().split("T")[0],
        Créé_le: p.createdAt.toISOString().split("T")[0],
      }))),
      "Plans préventifs"
    );

    // Preventive tasks
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.json_to_sheet(tasks.map(t => ({
        ID: t.id, Plan: t.plan?.titre || "", Équipement: t.plan?.equipment?.nom || "",
        Échéance: t.dueDate.toISOString().split("T")[0], Statut: t.status,
        Effectué_le: t.doneAt?.toISOString().split("T")[0] || "",
        Note: t.note || "",
      }))),
      "Tâches préventives"
    );

    // Rapports Journaliers
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.json_to_sheet(rapports.map(r => ({
        ID: r.id,
        Date: r.date.toISOString().split("T")[0],
        Maintenancier: r.maintenancier?.nom || "",
        Supermarché: r.maintenancier?.supermarket?.nom || "",
        Activités: r.activites,
        Observations: r.observations || "",
        Manager: r.managerMaintenance || "",
        "Signature Tech": r.signatureTechnicien ? "Oui" : "Non",
        "Signé Tech le": r.dateSignatureTechnicien?.toISOString().split("T")[0] || "",
        "Signature Resp": r.signatureResponsable ? "Oui" : "Non",
        "Signé Resp le": r.dateSignatureResponsable?.toISOString().split("T")[0] || "",
        Créé_le: r.createdAt.toISOString().split("T")[0],
      }))),
      "Rapports Journaliers"
    );

    // Rondes
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.json_to_sheet(rondes.map(r => {
        let listChecks = "";
        try {
          const chk = JSON.parse(r.checks || "[]");
          listChecks = chk.map((z: any) => `${z.zone}: [${z.equipements.map((e: any) => `${e.nom}(09h:${e["09h"] || "-"},15h:${e["15h"] || "-"})`).join(", ")}]`).join(" | ");
        } catch {}

        return {
          ID: r.id,
          Date: r.date.toISOString().split("T")[0],
          Supermarché: r.supermarket?.nom || "",
          Maintenancier: r.maintenancier?.nom || "",
          Checks_Détails: listChecks,
          Observations: r.observationsGenerales || "",
          "Sig Tech": r.signatureTechnicien || "",
          "Sig Permanent": r.signaturePermanent || "",
          "Sig DM": r.signatureDM || "",
          Créé_le: r.createdAt.toISOString().split("T")[0],
        };
      })),
      "Rondes Journalières"
    );

    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  }

  async exportPdf(from?: string, to?: string, supermarketId?: string) {
    const dateFilter: any = {};
    if (from || to) {
      dateFilter.gte = from ? new Date(from) : undefined;
      dateFilter.lte = to ? new Date(to) : undefined;
    }
    const whereDate = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

    const ticketFilter: any = { ...whereDate };
    if (supermarketId) {
      ticketFilter.equipment = { supermarketId };
    }

    const rapportFilter: any = {};
    if (from || to) {
      const rDate: any = {};
      if (from) rDate.gte = new Date(from);
      if (to) rDate.lte = new Date(to);
      rapportFilter.date = rDate;
    }
    if (supermarketId) {
      rapportFilter.maintenancier = { supermarketId };
    }

    const rondeFilter: any = supermarketId ? { supermarketId } : {};
    if (from || to) {
      const rDate: any = {};
      if (from) rDate.gte = new Date(from);
      if (to) rDate.lte = new Date(to);
      rondeFilter.date = rDate;
    }

    const pdfmake = require("pdfmake");
    const robotoFont = require("pdfmake/build/fonts/Roboto");
    Object.keys(robotoFont.vfs).forEach((key: string) => {
      pdfmake.virtualfs.storage[key] = Buffer.from(robotoFont.vfs[key].data, "base64");
    });
    pdfmake.setFonts(robotoFont.fonts);

    const [
      totalTickets,
      closedTickets,
      doneTickets,
      byPriority,
      byStatus,
      equipmentsCount,
      plansCount,
      recentTickets,
      recentRapports,
      recentRondes,
      selectedSupermarket,
    ] = await Promise.all([
      this.prisma.ticket.count({ where: ticketFilter }),
      this.prisma.ticket.count({ where: { ...ticketFilter, status: "FERME" } }),
      this.prisma.ticket.count({ where: { ...ticketFilter, status: { in: ["TERMINE", "FERME"] } } }),
      this.prisma.ticket.groupBy({ by: ["priority"], where: ticketFilter, _count: { id: true } }),
      this.prisma.ticket.groupBy({ by: ["status"], where: ticketFilter, _count: { id: true } }),
      this.prisma.equipment.count({ where: supermarketId ? { supermarketId } : {} }),
      this.prisma.preventivePlan.count({ where: supermarketId ? { equipment: { supermarketId } } : {} }),
      this.prisma.ticket.findMany({
        where: ticketFilter,
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { equipment: { select: { nom: true } } },
      }),
      this.prisma.rapportJournalier.findMany({
        where: rapportFilter,
        orderBy: { date: "desc" },
        take: 15,
        include: { maintenancier: { select: { nom: true } } },
      }),
      this.prisma.rondeJournaliere.findMany({
        where: rondeFilter,
        orderBy: { date: "desc" },
        take: 15,
        include: { supermarket: { select: { nom: true } }, maintenancier: { select: { nom: true } } },
      }),
      supermarketId ? this.prisma.supermarket.findUnique({ where: { id: supermarketId } }) : null,
    ]);

    const titlePrefix = selectedSupermarket ? `Supermarché : ${selectedSupermarket.nom}` : "Tous les supermarchés";

    const docDefinition: any = {
      pageSize: "A4",
      pageMargins: [35, 50, 35, 50],
      defaultStyle: { font: "Roboto" },
      info: { title: "Rapport GMAO complet", author: "Système GMAO" },
      content: [
        { canvas: [{ type: "rect", x: 0, y: 0, w: 525, h: 4, color: "#FA5B07" }], margin: [0, 0, 0, 10] },

        { text: "Rapport GMAO - Synthèse et Backup", style: "header", margin: [0, 0, 0, 2] },
        { text: `${titlePrefix} · Période : ${from || "Début"} au ${to || "Aujourd'hui"}`, style: "subheader", margin: [0, 0, 0, 10] },

        { text: "Indicateurs Généraux", style: "sectionTitle" },
        {
          table: {
            widths: ["*", "*", "*", "*"],
            body: [
              [
                { text: "Total Tickets", style: "tableHeader", alignment: "center" },
                { text: "Fermés", style: "tableHeader", alignment: "center" },
                { text: "Équipements", style: "tableHeader", alignment: "center" },
                { text: "Plans Préventifs", style: "tableHeader", alignment: "center" },
              ],
              [
                { text: String(totalTickets), alignment: "center", fontSize: 14, bold: true, color: "#060537", margin: [0, 5, 0, 5] },
                { text: `${closedTickets} (${totalTickets > 0 ? Math.round((closedTickets / totalTickets) * 100) : 0}%)`, alignment: "center", fontSize: 14, bold: true, color: "#059669", margin: [0, 5, 0, 5] },
                { text: String(equipmentsCount), alignment: "center", fontSize: 14, bold: true, color: "#0284c7", margin: [0, 5, 0, 5] },
                { text: String(plansCount), alignment: "center", fontSize: 14, bold: true, color: "#fa5b07", margin: [0, 5, 0, 5] },
              ],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 2, 0, 12],
        },

        {
          columns: [
            {
              width: "50%",
              stack: [
                { text: "Répartition par Priorité", style: "subsectionTitle" },
                {
                  table: {
                    widths: ["*", "auto"],
                    body: [
                      [{ text: "Priorité", style: "tableHeader" }, { text: "Nombre", style: "tableHeader" }],
                      ...byPriority.map((p: any) => [p.priority, String(p._count.id)]),
                    ],
                  },
                  layout: "lightHorizontalLines",
                },
              ],
            },
            {
              width: "50%",
              stack: [
                { text: "Répartition par Statut", style: "subsectionTitle" },
                {
                  table: {
                    widths: ["*", "auto"],
                    body: [
                      [{ text: "Statut", style: "tableHeader" }, { text: "Nombre", style: "tableHeader" }],
                      ...byStatus.map((s: any) => [s.status, String(s._count.id)]),
                    ],
                  },
                  layout: "lightHorizontalLines",
                },
              ],
              margin: [15, 0, 0, 0],
            },
          ],
          margin: [0, 0, 0, 15],
        },

        { text: `Derniers Tickets (Top 30)`, style: "sectionTitle" },
        {
          table: {
            widths: ["auto", "*", "auto", "auto", "auto"],
            body: [
              [
                { text: "Date", style: "tableHeader" },
                { text: "Titre", style: "tableHeader" },
                { text: "Priorité", style: "tableHeader" },
                { text: "Statut", style: "tableHeader" },
                { text: "Équipement", style: "tableHeader" },
              ],
              ...recentTickets.map(t => [
                t.createdAt.toISOString().split("T")[0],
                t.titre,
                t.priority,
                t.status,
                t.equipment?.nom || "—",
              ]),
            ],
          },
          fontSize: 8,
          layout: "lightHorizontalLines",
          margin: [0, 2, 0, 15],
        },

        { text: `Derniers Rapports Journaliers (Top 15)`, style: "sectionTitle" },
        {
          table: {
            widths: ["auto", "auto", "*", "auto", "auto"],
            body: [
              [
                { text: "Date", style: "tableHeader" },
                { text: "Maintenancier", style: "tableHeader" },
                { text: "Activités", style: "tableHeader" },
                { text: "Sig Tech", style: "tableHeader" },
                { text: "Sig Resp", style: "tableHeader" },
              ],
              ...recentRapports.map(r => [
                r.date.toISOString().split("T")[0],
                r.maintenancier?.nom || "—",
                { text: r.activites || "—", maxLines: 2 },
                r.signatureTechnicien ? "Oui" : "Non",
                r.signatureResponsable ? "Oui" : "Non",
              ]),
            ],
          },
          fontSize: 8,
          layout: "lightHorizontalLines",
          margin: [0, 2, 0, 15],
        },

        { text: `Dernières Rondes Journalières (Top 15)`, style: "sectionTitle" },
        {
          table: {
            widths: ["auto", "auto", "auto", "*", "auto"],
            body: [
              [
                { text: "Date", style: "tableHeader" },
                { text: "Supermarché", style: "tableHeader" },
                { text: "Maintenancier", style: "tableHeader" },
                { text: "Observations", style: "tableHeader" },
                { text: "Signatures", style: "tableHeader" },
              ],
              ...recentRondes.map(r => {
                const sigs = [
                  r.signatureTechnicien ? "Tech" : "",
                  r.signaturePermanent ? "Perm" : "",
                  r.signatureDM ? "DM" : "",
                ].filter(Boolean).join(", ") || "Aucune";

                return [
                  r.date.toISOString().split("T")[0],
                  r.supermarket?.nom || "—",
                  r.maintenancier?.nom || "—",
                  r.observationsGenerales || "—",
                  sigs,
                ];
              }),
            ],
          },
          fontSize: 8,
          layout: "lightHorizontalLines",
          margin: [0, 2, 0, 15],
        },

        { canvas: [{ type: "rect", x: 0, y: 0, w: 525, h: 2, color: "#FA5B07" }], margin: [0, 5, 0, 5] },
        { text: `Document de synthèse officiel GMAO · Généré le ${new Date().toLocaleString("fr-FR")}`, alignment: "center", fontSize: 8, color: "#94a3b8" },
      ],
      styles: {
        header: { fontSize: 16, bold: true, color: "#060537" },
        subheader: { fontSize: 9, color: "#475569" },
        sectionTitle: { fontSize: 11, bold: true, color: "#FA5B07", margin: [0, 6, 0, 4] },
        subsectionTitle: { fontSize: 10, bold: true, color: "#060537", margin: [0, 4, 0, 4] },
        tableHeader: { fontSize: 8, bold: true, color: "#060537", fillColor: "#f1f5f9", margin: [3, 4, 3, 4] },
      },
    };

    const doc = pdfmake.createPdf(docDefinition, {});
    return doc.getBuffer();
  }
}
