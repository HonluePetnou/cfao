import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class RondeService {
  constructor(private prisma: PrismaService) {}

  // ─── CONFIGURATION ───────────────────────────────────────────────

  async getConfig(supermarketId: string) {
    return this.prisma.rondeConfiguration.findUnique({ where: { supermarketId } });
  }

  async upsertConfig(supermarketId: string, zones: any[]) {
    return this.prisma.rondeConfiguration.upsert({
      where: { supermarketId },
      update: { zones: JSON.stringify(zones) },
      create: { supermarketId, zones: JSON.stringify(zones) },
    });
  }

  // ─── RONDES JOURNALIÈRES ─────────────────────────────────────────

  async findAll(params?: {
    supermarketId?: string;
    maintenancierId?: string;
    dateDebut?: string;
    dateFin?: string;
  }) {
    const where: any = {};
    if (params?.supermarketId) where.supermarketId = params.supermarketId;
    if (params?.maintenancierId) where.maintenancierId = params.maintenancierId;
    if (params?.dateDebut || params?.dateFin) {
      where.date = {};
      if (params?.dateDebut) where.date.gte = new Date(params.dateDebut);
      if (params?.dateFin) where.date.lte = new Date(params.dateFin);
    }
    return this.prisma.rondeJournaliere.findMany({
      where,
      include: {
        maintenancier: { select: { id: true, nom: true, email: true } },
        supermarket: { select: { id: true, nom: true, code: true } },
      },
      orderBy: { date: "desc" },
    });
  }

  async findById(id: string) {
    const ronde = await this.prisma.rondeJournaliere.findUnique({
      where: { id },
      include: {
        maintenancier: { select: { id: true, nom: true, email: true } },
        supermarket: { select: { id: true, nom: true, code: true } },
      },
    });
    if (!ronde) throw new NotFoundException("Ronde non trouvée");
    return ronde;
  }

  async create(data: {
    date: string;
    supermarketId: string;
    maintenancierId?: string;
    checks: any[];
    observationsGenerales?: string;
  }) {
    return this.prisma.rondeJournaliere.create({
      data: {
        date: new Date(data.date),
        supermarketId: data.supermarketId,
        maintenancierId: data.maintenancierId || null,
        checks: JSON.stringify(data.checks),
        observationsGenerales: data.observationsGenerales || null,
      },
      include: {
        maintenancier: { select: { id: true, nom: true } },
        supermarket: { select: { id: true, nom: true } },
      },
    });
  }

  async update(id: string, data: {
    checks?: any[];
    observationsGenerales?: string;
    maintenancierId?: string;
  }) {
    const updateData: any = {};
    if (data.checks !== undefined) updateData.checks = JSON.stringify(data.checks);
    if (data.observationsGenerales !== undefined) updateData.observationsGenerales = data.observationsGenerales;
    if (data.maintenancierId !== undefined) updateData.maintenancierId = data.maintenancierId;
    return this.prisma.rondeJournaliere.update({
      where: { id },
      data: updateData,
      include: {
        maintenancier: { select: { id: true, nom: true } },
        supermarket: { select: { id: true, nom: true } },
      },
    });
  }

  async signer(id: string, role: "technicien" | "permanent" | "dm", nom: string) {
    const data: any = {};
    if (role === "technicien") data.signatureTechnicien = nom;
    else if (role === "permanent") data.signaturePermanent = nom;
    else if (role === "dm") data.signatureDM = nom;
    return this.prisma.rondeJournaliere.update({
      where: { id },
      data,
      include: {
        maintenancier: { select: { id: true, nom: true } },
        supermarket: { select: { id: true, nom: true } },
      },
    });
  }

  async delete(id: string) {
    return this.prisma.rondeJournaliere.delete({ where: { id } });
  }

  // ─── BILAN PDF ───────────────────────────────────────────────────
  async exportPdf(id: string) {
    const ronde = await this.findById(id);

    const pdfmake = require("pdfmake");
    const robotoFont = require("pdfmake/build/fonts/Roboto");
    Object.keys(robotoFont.vfs).forEach((key: string) => {
      pdfmake.virtualfs.storage[key] = Buffer.from(robotoFont.vfs[key].data, "base64");
    });
    pdfmake.setFonts(robotoFont.fonts);

    let zones: { zone: string; equipements: { nom: string; "09h"?: string; "15h"?: string; observation?: string }[] }[] = [];
    try { zones = JSON.parse(ronde.checks || "[]"); } catch { zones = []; }

    let totalPoints = 0, okCount = 0, nokCount = 0, nonRenseigne = 0;
    for (const z of zones) {
      for (const eq of z.equipements || []) {
        for (const creneau of ["09h", "15h"] as const) {
          const v = (eq as any)[creneau];
          totalPoints++;
          if (v === "OK") okCount++;
          else if (v === "NOK") nokCount++;
          else nonRenseigne++;
        }
      }
    }
    const tauxConformite = totalPoints - nonRenseigne > 0 ? Math.round((okCount / (totalPoints - nonRenseigne)) * 100) : 0;

    const dateFr = new Date(ronde.date).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    const siteNom = ronde.supermarket?.nom || "—";
    const technicienNom = ronde.maintenancier?.nom || "—";

    const statusCell = (v?: string) => {
      if (v === "OK") return { text: "OK", alignment: "center", bold: true, color: "#2E8B57" };
      if (v === "NOK") return { text: "NOK", alignment: "center", bold: true, color: "#C0392B" };
      return { text: "—", alignment: "center", color: "#94a3b8" };
    };

    const zonesContent: any[] = [];
    for (const z of zones) {
      zonesContent.push({ text: z.zone, style: "subsectionTitle" });
      zonesContent.push({
        table: {
          widths: ["*", "auto", "auto", "*"],
          body: [
            [
              { text: "Équipement", style: "tableHeader" },
              { text: "09h", style: "tableHeader", alignment: "center" },
              { text: "15h", style: "tableHeader", alignment: "center" },
              { text: "Observation", style: "tableHeader" },
            ],
            ...(z.equipements || []).map((eq) => [
              { text: eq.nom, fontSize: 9, color: "#334155" },
              statusCell(eq["09h"]),
              statusCell(eq["15h"]),
              { text: eq.observation || "", fontSize: 8, color: "#64748b", italics: !eq.observation },
            ]),
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 2, 0, 12],
      });
    }

    const docDefinition: any = {
      pageSize: "A4",
      pageMargins: [40, 60, 40, 60],
      defaultStyle: { font: "Roboto" },
      info: { title: `Bilan de ronde - ${dateFr} - ${siteNom}`, author: "GMAO", subject: "Bilan de ronde journalière" },
      header: () => ({
        columns: [
          { text: "GMAO — Maintenance", alignment: "left", fontSize: 8, color: "#94a3b8", margin: [40, 20, 0, 0] },
          { text: "Bilan de ronde", alignment: "right", fontSize: 8, color: "#94a3b8", margin: [0, 20, 40, 0] },
        ],
      }),
      footer: (currentPage: number, pageCount: number) => ({
        text: `Page ${currentPage} / ${pageCount}`,
        alignment: "center", fontSize: 8, color: "#94a3b8", margin: [0, 10, 0, 0],
      }),
      content: [
        { canvas: [{ type: "rect", x: 0, y: 0, w: 515, h: 4, color: "#FA5B07" }], margin: [0, 0, 0, 16] },
        { text: "Bilan de ronde journalière", style: "header" },
        {
          layout: "noBorders",
          table: {
            widths: ["auto", "*"],
            body: [
              [{ text: "Date :", style: "infoLabel" }, { text: dateFr, style: "infoValue" }],
              [{ text: "Site :", style: "infoLabel" }, { text: siteNom, style: "infoValue" }],
              [{ text: "Technicien :", style: "infoLabel" }, { text: technicienNom, style: "infoValue", margin: [0, 0, 0, 12] }],
            ],
          },
          margin: [0, 8, 0, 4],
        },

        {
          columns: [
            { width: "*", stack: [{ text: String(totalPoints), style: "statValue", color: "#060537" }, { text: "Points contrôlés", style: "statLabel" }] },
            { width: "*", stack: [{ text: String(okCount), style: "statValue", color: "#2E8B57" }, { text: "Conformes (OK)", style: "statLabel" }] },
            { width: "*", stack: [{ text: String(nokCount), style: "statValue", color: "#C0392B" }, { text: "Anomalies (NOK)", style: "statLabel" }] },
            { width: "*", stack: [{ text: `${tauxConformite}%`, style: "statValue", color: "#FA5B07" }, { text: "Taux de conformité", style: "statLabel" }] },
          ],
          margin: [0, 4, 0, 14],
        },

        ...(nokCount > 0
          ? [{
              table: { widths: ["*"], body: [[{ text: `⚠ ${nokCount} anomalie(s) relevée(s) pendant cette ronde — voir le détail par zone ci-dessous.`, color: "#C0392B", bold: true, fontSize: 9, margin: [8, 6, 8, 6] }]] },
              layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => "#FBE2DF" },
              margin: [0, 0, 0, 14],
            }]
          : []),

        { text: "Détail par zone", style: "sectionTitle" },
        ...zonesContent,

        ...(ronde.observationsGenerales
          ? [
              { text: "Observations générales", style: "sectionTitle" },
              { text: ronde.observationsGenerales, style: "body", margin: [0, 4, 0, 16] },
            ]
          : []),

        { text: "Signatures", style: "sectionTitle" },
        {
          table: {
            widths: ["*", "*", "*"],
            body: [
              [
                { text: "Technicien", style: "tableHeader" },
                { text: "Responsable Permanent", style: "tableHeader" },
                { text: "Directeur Magasin", style: "tableHeader" },
              ],
              [
                { text: ronde.signatureTechnicien || "_________________________", alignment: "center", margin: [0, 24, 0, 0], color: "#475569" },
                { text: ronde.signaturePermanent || "_________________________", alignment: "center", margin: [0, 24, 0, 0], color: "#475569" },
                { text: ronde.signatureDM || "_________________________", alignment: "center", margin: [0, 24, 0, 0], color: "#475569" },
              ],
            ],
          },
          layout: { hLineWidth: () => 0.5, vLineWidth: () => 0, hLineColor: () => "#e2e8f0" },
          margin: [0, 4, 0, 24],
        },

        { canvas: [{ type: "rect", x: 0, y: 0, w: 515, h: 2, color: "#FA5B07" }], margin: [0, 0, 0, 12] },
        { text: "Document généré par le Système GMAO", alignment: "center", fontSize: 7, color: "#94a3b8", margin: [0, 8, 0, 0] },
      ],
      styles: {
        header: { fontSize: 18, bold: true, color: "#060537", margin: [0, 0, 0, 4] },
        infoLabel: { fontSize: 9, bold: true, color: "#060537", margin: [0, 2, 8, 2] },
        infoValue: { fontSize: 9, color: "#475569", margin: [0, 2, 0, 2] },
        sectionTitle: { fontSize: 12, bold: true, color: "#FA5B07", margin: [0, 8, 0, 4] },
        subsectionTitle: { fontSize: 10, bold: true, color: "#060537", margin: [0, 6, 0, 4] },
        body: { fontSize: 9, color: "#334155", lineHeight: 1.5 },
        tableHeader: { fontSize: 8, bold: true, color: "#060537", fillColor: "#f1f5f9", margin: [4, 5, 4, 5] },
        statValue: { fontSize: 20, bold: true, alignment: "center" },
        statLabel: { fontSize: 8, color: "#64748b", alignment: "center", margin: [0, 2, 0, 0] },
      },
    };

    const doc = pdfmake.createPdf(docDefinition, {});
    return doc.getBuffer();
  }
}
