import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class RapportJournalierService {
  constructor(private prisma: PrismaService) {}

  findAll(params?: { maintenancierId?: string; dateDebut?: string; dateFin?: string }) {
    const where: any = {};
    if (params?.maintenancierId) where.maintenancierId = params.maintenancierId;
    if (params?.dateDebut || params?.dateFin) {
      where.date = {};
      if (params.dateDebut) where.date.gte = new Date(params.dateDebut);
      if (params.dateFin) where.date.lte = new Date(params.dateFin);
    }
    return this.prisma.rapportJournalier.findMany({
      where,
      include: { maintenancier: { select: { id: true, nom: true, email: true } } },
      orderBy: { date: "desc" },
    });
  }

  findById(id: string) {
    return this.prisma.rapportJournalier.findUnique({
      where: { id },
      include: { maintenancier: { select: { id: true, nom: true, email: true } } },
    });
  }

  create(data: {
    date: string;
    maintenancierId: string;
    activites: string;
    observations?: string;
    managerMaintenance?: string;
    dateVisaAgent?: string;
  }) {
    return this.prisma.rapportJournalier.create({
      data: {
        date: new Date(data.date),
        maintenancierId: data.maintenancierId,
        activites: data.activites,
        observations: data.observations,
        managerMaintenance: data.managerMaintenance,
        dateVisaAgent: data.dateVisaAgent ? new Date(data.dateVisaAgent) : null,
      },
      include: { maintenancier: { select: { id: true, nom: true } } },
    });
  }

  update(id: string, data: {
    date?: string;
    activites?: string;
    observations?: string;
    managerMaintenance?: string;
    dateVisaAgent?: string;
  }) {
    const updateData: any = {};
    if (data.date) updateData.date = new Date(data.date);
    if (data.activites !== undefined) updateData.activites = data.activites;
    if (data.observations !== undefined) updateData.observations = data.observations;
    if (data.managerMaintenance !== undefined) updateData.managerMaintenance = data.managerMaintenance;
    if (data.dateVisaAgent !== undefined) updateData.dateVisaAgent = new Date(data.dateVisaAgent);
    return this.prisma.rapportJournalier.update({
      where: { id },
      data: updateData,
      include: { maintenancier: { select: { id: true, nom: true } } },
    });
  }

  delete(id: string) {
    return this.prisma.rapportJournalier.delete({ where: { id } });
  }

  async signTechnicien(id: string) {
    const now = new Date();
    return this.prisma.rapportJournalier.update({
      where: { id },
      data: {
        signatureTechnicien: true,
        dateSignatureTechnicien: now,
        dateVisaAgent: now,
      },
      include: { maintenancier: { select: { id: true, nom: true } } },
    });
  }

  async signResponsable(id: string, managerName: string) {
    const now = new Date();
    return this.prisma.rapportJournalier.update({
      where: { id },
      data: {
        signatureResponsable: true,
        dateSignatureResponsable: now,
        managerMaintenance: managerName,
      },
      include: { maintenancier: { select: { id: true, nom: true } } },
    });
  }

  async signAllResponsable(ids: string[], managerName: string) {
    const now = new Date();
    const results = await this.prisma.rapportJournalier.updateMany({
      where: { id: { in: ids }, signatureResponsable: false },
      data: {
        signatureResponsable: true,
        dateSignatureResponsable: now,
        managerMaintenance: managerName,
      },
    });
    return { count: results.count };
  }

  /** Appose la signature du technicien OU du responsable sur un rapport */
  async signer(id: string, role: "technicien" | "responsable", nom?: string) {
    const now = new Date();
    const data: any = {};
    if (role === "technicien") {
      data.signatureTechnicien = true;
      data.dateSignatureTechnicien = now;
    } else {
      data.signatureResponsable = true;
      data.dateSignatureResponsable = now;
      if (nom) data.managerMaintenance = nom;
    }
    return this.prisma.rapportJournalier.update({
      where: { id },
      data,
      include: { maintenancier: { select: { id: true, nom: true } } },
    });
  }

  /** Signe en tant que responsable tous les rapports d'une journée donnée */
  async signerTous(date: string, nom?: string) {
    const targetDate = new Date(date);
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const rapports = await this.prisma.rapportJournalier.findMany({
      where: {
        date: { gte: dayStart, lte: dayEnd },
        signatureResponsable: false,
      },
    });

    const now = new Date();
    const updates = rapports.map((r) =>
      this.prisma.rapportJournalier.update({
        where: { id: r.id },
        data: {
          signatureResponsable: true,
          dateSignatureResponsable: now,
          ...(nom ? { managerMaintenance: nom } : {}),
        },
      }),
    );
    await this.prisma.$transaction(updates);
    return { signed: rapports.length };
  }

  async generate(date: string) {
    const targetDate = new Date(date);
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const tickets = await this.prisma.ticket.findMany({
      where: {
        OR: [
          { updatedAt: { gte: dayStart, lte: dayEnd } },
          { createdAt: { gte: dayStart, lte: dayEnd } },
          { dateTermine: { gte: dayStart, lte: dayEnd } },
        ],
      },
      include: {
        assignedMaintenancier: { select: { id: true, nom: true } },
        equipment: { select: { nom: true, corpsEtat: true } },
      },
    });

    const preventiveTasks = await this.prisma.preventiveTask.findMany({
      where: {
        doneAt: { gte: dayStart, lte: dayEnd },
        status: "EFFECTUE",
      },
      include: {
        plan: {
          select: {
            titre: true,
            assignedMaintenancier: { select: { id: true, nom: true } },
            equipment: { select: { nom: true } },
          },
        },
      },
    });

    if (!tickets.length && !preventiveTasks.length) {
      throw new BadRequestException("Aucune activité trouvée pour cette date");
    }

    const maintenancierIds = [...new Set([
      ...tickets.filter(t => t.assignedMaintenancier).map(t => t.assignedMaintenancier!.id),
      ...preventiveTasks.filter(t => t.plan?.assignedMaintenancier).map(t => t.plan!.assignedMaintenancier!.id),
    ])];

    const created: any[] = [];
    for (const mtnId of maintenancierIds) {
      const mtnTickets = tickets.filter(t => t.assignedMaintenancier?.id === mtnId);
      const mtnPreventiveTasks = preventiveTasks.filter(t => t.plan?.assignedMaintenancier?.id === mtnId);
      const mtn = mtnTickets[0]?.assignedMaintenancier || mtnPreventiveTasks[0]?.plan?.assignedMaintenancier!;

      const ticketLines = mtnTickets.map(t => {
        const type = t.typeTravaux || "Maint. Corrective";
        return `- [${type}] ${t.titre} (${t.equipment?.nom || "N/A"})${t.commentaireMaintenancier ? ` : ${t.commentaireMaintenancier}` : ""}`;
      });

      const preventiveLines = mtnPreventiveTasks.map(t =>
        `- [Maint. Préventive] ${t.plan.titre} (${t.plan.equipment?.nom || "N/A"})${t.note ? ` : ${t.note}` : ""}`
      );

      const activites = [...ticketLines, ...preventiveLines].join("\n");
      const totalCount = mtnTickets.length + mtnPreventiveTasks.length;
      const summary = `${totalCount} intervention(s) traitée(s) le ${date}`;

      const existing = await this.prisma.rapportJournalier.findFirst({
        where: {
          maintenancierId: mtn.id,
          date: { gte: dayStart, lte: dayEnd },
        },
      });

      if (existing) {
        await this.prisma.rapportJournalier.update({
          where: { id: existing.id },
          data: { activites },
        });
        created.push({ ...existing, activites, maintenancier: mtn });
      } else {
        const rapport = await this.prisma.rapportJournalier.create({
          data: {
            date: targetDate,
            maintenancierId: mtn.id,
            activites,
            observations: summary,
          },
          include: { maintenancier: { select: { id: true, nom: true } } },
        });
        created.push(rapport);
      }
    }

    return created.length === 1 ? created[0] : created;
  }

  async exportPdf(id: string) {
    const rapport = await this.prisma.rapportJournalier.findUnique({
      where: { id },
      include: { maintenancier: { select: { id: true, nom: true, email: true } } },
    });
    if (!rapport) throw new NotFoundException("Rapport non trouvé");

    const pdfmake = require("pdfmake");
    const robotoFont = require("pdfmake/build/fonts/Roboto");
    Object.keys(robotoFont.vfs).forEach((key: string) => {
      pdfmake.virtualfs.storage[key] = Buffer.from(robotoFont.vfs[key].data, "base64");
    });
    pdfmake.setFonts(robotoFont.fonts);

    const dateFr = new Date(rapport.date).toLocaleDateString("fr-FR");
    const maintenancierNom = rapport.maintenancier?.nom || "N/A";
    const maintenancierEmail = rapport.maintenancier?.email || "N/A";

    const docDefinition: any = {
      pageSize: "A4",
      pageMargins: [40, 60, 40, 60],
      defaultStyle: { font: "Roboto" },
      info: {
        title: `Rapport Journalier - ${dateFr} - ${maintenancierNom}`,
        author: "GMAO",
        subject: "Rapport d'Activités Journalières",
      },
      header: () => ({
        columns: [
          { text: "GMAO - Maintenance", alignment: "left", fontSize: 8, color: "#94a3b8", margin: [40, 20, 0, 0] },
          { text: "Rapport Journalier", alignment: "right", fontSize: 8, color: "#94a3b8", margin: [0, 20, 40, 0] },
        ],
      }),
      footer: (currentPage: number, pageCount: number) => ({
        text: `Page ${currentPage} / ${pageCount}`,
        alignment: "center",
        fontSize: 8,
        color: "#94a3b8",
        margin: [0, 10, 0, 0],
      }),
      content: [
        {
          canvas: [{ type: "rect", x: 0, y: 0, w: 515, h: 4, color: "#FA5B07" }],
          margin: [0, 0, 0, 16],
        },
        { text: "Rapport d'Activités Journalières", style: "header" },
        {
          layout: "noBorders",
          table: {
            widths: ["auto", "*"],
            body: [
              [{ text: "Date :", style: "infoLabel" }, { text: dateFr, style: "infoValue" }],
              [{ text: "Agent :", style: "infoLabel" }, { text: maintenancierNom, style: "infoValue" }],
              [{ text: "Email :", style: "infoLabel" }, { text: maintenancierEmail, style: "infoValue", margin: [0, 0, 0, 12] }],
            ],
          },
          margin: [0, 8, 0, 12],
        },

        { text: "Activités Réalisées", style: "sectionTitle" },
        {
          stack: (rapport.activites || "").split("\n").filter(Boolean).map((line: string) => ({
            text: line,
            style: "body",
            margin: [8, 2, 0, 2],
          })),
          margin: [0, 4, 0, 16],
        },

        ...(rapport.observations
          ? [
              { text: "Observations", style: "sectionTitle" },
              { text: rapport.observations, style: "body", margin: [0, 4, 0, 16] },
            ]
          : []),

        { text: "Visa et Signatures", style: "sectionTitle" },
        {
          table: {
            widths: ["*", "*"],
            body: [
              [
                { text: "Responsable Maintenance", style: "tableHeader" },
                { text: "Agent de Maintenance", style: "tableHeader" },
              ],
              [
                { text: rapport.managerMaintenance || "_________________________", alignment: "center", margin: [0, 24, 0, 0], color: "#475569" },
                { text: rapport.dateVisaAgent ? new Date(rapport.dateVisaAgent).toLocaleDateString("fr-FR") : "_________________________", alignment: "center", margin: [0, 24, 0, 0], color: "#475569" },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => "#e2e8f0",
          },
          margin: [0, 4, 0, 24],
        },

        {
          canvas: [{ type: "rect", x: 0, y: 0, w: 515, h: 2, color: "#FA5B07" }],
          margin: [0, 0, 0, 12],
        },

        { text: "Document généré par le Système GMAO", alignment: "center", fontSize: 7, color: "#94a3b8", margin: [0, 8, 0, 0] },
      ],
      styles: {
        header: { fontSize: 18, bold: true, color: "#060537", margin: [0, 0, 0, 4] },
        infoLabel: { fontSize: 9, bold: true, color: "#060537", margin: [0, 2, 8, 2] },
        infoValue: { fontSize: 9, color: "#475569", margin: [0, 2, 0, 2] },
        sectionTitle: { fontSize: 12, bold: true, color: "#FA5B07", margin: [0, 8, 0, 4] },
        body: { fontSize: 9, color: "#334155", lineHeight: 1.5 },
        tableHeader: { fontSize: 9, bold: true, color: "#060537", fillColor: "#f1f5f9", margin: [4, 6, 4, 6] },
      },
    };

    const doc = pdfmake.createPdf(docDefinition, {});
    return doc.getBuffer();
  }
}
