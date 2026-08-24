import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { KpiService } from "../kpi/kpi.service";
import * as ExcelJS from "exceljs";

// ─── Palette de marque, réutilisée pour l'Excel et le PDF ──────────────────────
const NAVY = "16233C";
const ORANGE = "FA5B07";
const CATEGORY_COLORS = ["FA5B07", "16233C", "2F6FB0", "2E8B57", "B8790F", "C0392B", "7A4FB5", "5B6472"];

const STATUS_LABEL: Record<string, string> = {
  NOUVEAU: "Nouveau", ASSIGNE: "Assigné", EN_COURS: "En cours",
  TERMINE: "Terminé", A_REPRENDRE: "À reprendre", FERME: "Fermé",
};
const STATUS_COLOR: Record<string, string> = {
  NOUVEAU: "64748B", ASSIGNE: "2F6FB0", EN_COURS: "B8790F",
  TERMINE: "2E8B57", A_REPRENDRE: "C0392B", FERME: "5B6472",
};
const PRIORITY_LABEL: Record<string, string> = {
  BASSE: "Basse", MOYENNE: "Moyenne", HAUTE: "Haute", CRITIQUE: "Critique",
};
const PRIORITY_COLOR: Record<string, string> = {
  BASSE: "2E8B57", MOYENNE: "B8790F", HAUTE: "FA5B07", CRITIQUE: "C0392B",
};

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService, private kpi: KpiService) {}

  // ─── Filtres communs (date / supermarché) ────────────────────────────────────
  private buildFilters(from?: string, to?: string, supermarketId?: string) {
    const dateFilter: any = {};
    if (from || to) {
      dateFilter.gte = from ? new Date(from) : undefined;
      dateFilter.lte = to ? new Date(to) : undefined;
    }
    const whereDate = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

    const supermarketFilter = supermarketId ? { id: supermarketId } : {};
    const subSupermarketFilter = supermarketId ? { supermarketId } : {};

    const ticketFilter: any = { ...whereDate };
    if (supermarketId) ticketFilter.equipment = { supermarketId };

    const planFilter: any = {};
    if (supermarketId) planFilter.equipment = { supermarketId };

    const taskFilter: any = { ...whereDate };
    if (supermarketId) taskFilter.plan = { equipment: { supermarketId } };

    const rapportFilter: any = {};
    if (from || to) {
      const rDate: any = {};
      if (from) rDate.gte = new Date(from);
      if (to) rDate.lte = new Date(to);
      rapportFilter.date = rDate;
    }
    if (supermarketId) rapportFilter.maintenancier = { supermarketId };

    const rondeFilter: any = { ...subSupermarketFilter };
    if (from || to) {
      const rDate: any = {};
      if (from) rDate.gte = new Date(from);
      if (to) rDate.lte = new Date(to);
      rondeFilter.date = rDate;
    }

    return { dateFilter, whereDate, supermarketFilter, subSupermarketFilter, ticketFilter, planFilter, taskFilter, rapportFilter, rondeFilter };
  }

  // ─── KPI tickets par équipement (utilisé par Excel et PDF) ───────────────────
  private async getEquipmentTicketStats(ticketFilter: any, limit = 30) {
    const tickets = await this.prisma.ticket.findMany({
      where: ticketFilter,
      select: { equipmentId: true, cout: true, tempsArret: true, equipment: { select: { nom: true, supermarket: { select: { nom: true } } } } },
    });
    const byEquipment = new Map<string, { equipmentId: string; nom: string; supermarche: string; count: number; cout: number; tempsArret: number }>();
    for (const t of tickets) {
      const key = t.equipmentId;
      const entry = byEquipment.get(key) || { equipmentId: key, nom: t.equipment?.nom || "—", supermarche: t.equipment?.supermarket?.nom || "—", count: 0, cout: 0, tempsArret: 0 };
      entry.count += 1;
      entry.cout += t.cout ?? 0;
      entry.tempsArret += t.tempsArret ?? 0;
      byEquipment.set(key, entry);
    }
    return Array.from(byEquipment.values()).sort((a, b) => b.count - a.count).slice(0, limit);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  EXCEL — feuilles stylées (ExcelJS) avec barres de données pour les KPI
  // ══════════════════════════════════════════════════════════════════════════
  async exportXlsx(from?: string, to?: string, supermarketId?: string) {
    const { dateFilter, whereDate, supermarketFilter, subSupermarketFilter, ticketFilter, planFilter, taskFilter, rapportFilter, rondeFilter } = this.buildFilters(from, to, supermarketId);

    const [
      supermarkets, localisations, users, equipments, tickets, plans, tasks, rapports, rondes, gmaoKpis, equipmentStats,
    ] = await Promise.all([
      this.prisma.supermarket.findMany({ where: supermarketFilter }),
      this.prisma.localisation.findMany({ where: subSupermarketFilter, include: { supermarket: { select: { nom: true } } } }),
      this.prisma.user.findMany({
        where: supermarketId ? { supermarketId } : {},
        select: { id: true, nom: true, email: true, role: true, phone: true, active: true, supermarketId: true, createdAt: true },
        orderBy: { nom: "asc" },
      }),
      this.prisma.equipment.findMany({
        where: { ...(supermarketId ? { supermarketId } : {}), ...(Object.keys(whereDate).length ? { createdAt: dateFilter } : {}) },
        include: { supermarket: { select: { nom: true } }, localisation: { select: { nom: true } } },
        orderBy: { nom: "asc" },
      }),
      this.prisma.ticket.findMany({
        where: ticketFilter,
        include: { equipment: { select: { nom: true } }, createdBy: { select: { nom: true } }, assignedMaintenancier: { select: { nom: true } }, closedBy: { select: { nom: true } } },
        orderBy: { numero: "desc" },
      }),
      this.prisma.preventivePlan.findMany({ where: planFilter, include: { equipment: { select: { nom: true } }, assignedMaintenancier: { select: { nom: true } } } }),
      this.prisma.preventiveTask.findMany({ where: taskFilter, include: { plan: { select: { titre: true, equipment: { select: { nom: true } } } } } }),
      this.prisma.rapportJournalier.findMany({ where: rapportFilter, include: { maintenancier: { select: { nom: true, supermarket: { select: { nom: true } } } } } }),
      this.prisma.rondeJournaliere.findMany({ where: rondeFilter, include: { maintenancier: { select: { nom: true } }, supermarket: { select: { nom: true } } } }),
      this.kpi.getGmaoKpis({ supermarketId, dateDebut: dateFilter.gte, dateFin: dateFilter.lte }),
      this.getEquipmentTicketStats(ticketFilter),
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = "GMAO Supermarché";
    wb.created = new Date();

    this.buildDashboardSheet(wb, gmaoKpis, tickets.length);
    this.buildPreventifKpiSheet(wb, gmaoKpis.preventive);
    this.buildEquipmentKpiSheet(wb, equipmentStats);

    this.addStyledSheet(wb, "Supermarchés", [
      { header: "Nom", key: "nom", width: 32 },
      { header: "Code", key: "code", width: 16 },
      { header: "Créé le", key: "createdAt", width: 14 },
    ], supermarkets.map((s) => ({ nom: s.nom, code: s.code, createdAt: fmtDate(s.createdAt) })));

    this.addStyledSheet(wb, "Localisations", [
      { header: "Nom", key: "nom", width: 26 },
      { header: "Supermarché", key: "sm", width: 32 },
    ], localisations.map((l) => ({ nom: l.nom, sm: l.supermarket?.nom || "" })));

    this.addStyledSheet(wb, "Utilisateurs", [
      { header: "Nom", key: "nom", width: 26 },
      { header: "Email", key: "email", width: 30 },
      { header: "Rôle", key: "role", width: 16 },
      { header: "Téléphone", key: "phone", width: 16 },
      { header: "Actif", key: "actif", width: 10 },
      { header: "Créé le", key: "createdAt", width: 14 },
    ], users.map((u) => ({ nom: u.nom, email: u.email, role: u.role, phone: u.phone || "", actif: u.active ? "Oui" : "Non", createdAt: fmtDate(u.createdAt) })));

    this.addStyledSheet(wb, "Équipements", [
      { header: "Nom", key: "nom", width: 28 },
      { header: "Corps d'état", key: "ce", width: 24 },
      { header: "Criticité", key: "crit", width: 14 },
      { header: "Supermarché", key: "sm", width: 26 },
      { header: "Localisation", key: "loc", width: 20 },
      { header: "Actif", key: "actif", width: 10 },
      { header: "Créé le", key: "createdAt", width: 14 },
    ], equipments.map((e) => ({ nom: e.nom, ce: e.corpsEtat || "", crit: e.criticite || "", sm: e.supermarket?.nom || "", loc: e.localisation?.nom || "", actif: e.active ? "Oui" : "Non", createdAt: fmtDate(e.createdAt) })));

    const ticketsSheet = this.addStyledSheet(wb, "Tickets", [
      { header: "N°", key: "numero", width: 8 },
      { header: "Titre", key: "titre", width: 32 },
      { header: "Priorité", key: "priorite", width: 12 },
      { header: "Statut", key: "statut", width: 12 },
      { header: "Équipement", key: "equipement", width: 24 },
      { header: "Demandeur", key: "demandeur", width: 20 },
      { header: "Maintenancier", key: "maintenancier", width: 20 },
      { header: "Type travaux", key: "type", width: 18 },
      { header: "Corps d'état", key: "ce", width: 20 },
      { header: "Localisation", key: "loc", width: 16 },
      { header: "Coût (XAF)", key: "cout", width: 14, numFmt: "#,##0" },
      { header: "Temps arrêt (h)", key: "arret", width: 14 },
      { header: "Créé le", key: "createdAt", width: 14 },
      { header: "Fermé le", key: "closedAt", width: 14 },
    ], tickets.map((t) => ({
      numero: t.numero, titre: t.titre, priorite: PRIORITY_LABEL[t.priority] || t.priority, statut: STATUS_LABEL[t.status] || t.status,
      equipement: t.equipment?.nom || "", demandeur: t.createdBy?.nom || "", maintenancier: t.assignedMaintenancier?.nom || "",
      type: t.typeTravaux || "", ce: t.corpsEtat || "", loc: t.localisation || "",
      cout: t.cout ?? null, arret: t.tempsArret ?? null,
      createdAt: fmtDate(t.createdAt), closedAt: t.dateFerme ? fmtDate(t.dateFerme) : "",
    })));
    this.colorizeColumn(ticketsSheet, "statut", STATUS_COLOR, STATUS_LABEL);
    this.colorizeColumn(ticketsSheet, "priorite", PRIORITY_COLOR, PRIORITY_LABEL);

    this.addStyledSheet(wb, "Plans préventifs", [
      { header: "Titre", key: "titre", width: 30 },
      { header: "Équipement", key: "eq", width: 24 },
      { header: "Fréquence", key: "freq", width: 16 },
      { header: "Maintenancier", key: "mtn", width: 20 },
      { header: "Actif", key: "actif", width: 10 },
      { header: "Prochaine échéance", key: "next", width: 16 },
    ], plans.map((p) => ({ titre: p.titre, eq: p.equipment?.nom || "", freq: `${p.intervalValue} ${p.intervalUnit}`, mtn: p.assignedMaintenancier?.nom || "Prestataire externe", actif: p.active ? "Oui" : "Non", next: fmtDate(p.nextDate) })));

    this.addStyledSheet(wb, "Tâches préventives", [
      { header: "Plan", key: "plan", width: 28 },
      { header: "Équipement", key: "eq", width: 24 },
      { header: "Échéance", key: "due", width: 14 },
      { header: "Statut", key: "statut", width: 14 },
      { header: "Effectué le", key: "done", width: 14 },
    ], tasks.map((t) => ({ plan: t.plan?.titre || "", eq: t.plan?.equipment?.nom || "", due: fmtDate(t.dueDate), statut: t.status, done: t.doneAt ? fmtDate(t.doneAt) : "" })));

    this.addStyledSheet(wb, "Rapports Journaliers", [
      { header: "Date", key: "date", width: 14 },
      { header: "Maintenancier", key: "mtn", width: 20 },
      { header: "Supermarché", key: "sm", width: 26 },
      { header: "Activités", key: "act", width: 40 },
      { header: "Signé Tech.", key: "sigT", width: 12 },
      { header: "Signé Resp.", key: "sigR", width: 12 },
    ], rapports.map((r) => ({ date: fmtDate(r.date), mtn: r.maintenancier?.nom || "", sm: r.maintenancier?.supermarket?.nom || "", act: r.activites, sigT: r.signatureTechnicien ? "Oui" : "Non", sigR: r.signatureResponsable ? "Oui" : "Non" })));

    this.addStyledSheet(wb, "Rondes Journalières", [
      { header: "Date", key: "date", width: 14 },
      { header: "Supermarché", key: "sm", width: 26 },
      { header: "Maintenancier", key: "mtn", width: 20 },
      { header: "Observations", key: "obs", width: 40 },
    ], rondes.map((r) => ({ date: fmtDate(r.date), sm: r.supermarket?.nom || "", mtn: r.maintenancier?.nom || "", obs: r.observationsGenerales || "" })));

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  // ── Feuille "Tableau de bord KPI" — synthèse + barres de données ────────────
  private buildDashboardSheet(wb: ExcelJS.Workbook, k: any, ticketCount: number) {
    const ws = wb.addWorksheet("Tableau de bord KPI", { views: [{ showGridLines: false }] });
    ws.getColumn(1).width = 4;
    ws.getColumn(2).width = 34;
    ws.getColumn(3).width = 14;
    for (let c = 4; c <= 8; c++) ws.getColumn(c).width = 12;

    this.title(ws, "B2:H2", "GMAO Supermarché — Tableau de bord KPI");
    ws.getCell("B3").value = `Généré le ${fmtDate(new Date())} · ${ticketCount} ticket(s) dans le périmètre exporté`;
    ws.getCell("B3").font = { italic: true, color: { argb: "FF64748B" }, size: 10 };

    let row = 5;
    row = this.statRow(ws, row, [
      ["Interventions totales", k.totalInterventions],
      ["En attente", k.interventionEnAttente],
      ["Corrective", k.maintenanceCorrective],
      ["Préventive", k.maintenancePreventive],
    ]);
    row++;
    row = this.statRow(ws, row, [
      ["Disponibilité (%)", `${k.reliability.disponibilite}%`],
      ["MTBF (h)", k.reliability.mtbfH],
      ["MTTR (h)", k.reliability.mttrH],
      ["Coût total (XAF)", Math.round(k.costs.total).toLocaleString("fr-FR")],
    ]);
    row += 2;

    row = this.sectionBarChart(ws, row, "Interventions par corps d'état", k.byCorpsEtat.slice(0, 10).map((c: any) => ({ label: c.corpsEtat, value: c.count })));
    row += 2;
    row = this.sectionBarChart(ws, row, "Interventions par site", k.bySupermarket.slice(0, 10).map((s: any) => ({ label: s.nom, value: s.count })));
    row += 2;
    row = this.sectionBarChart(ws, row, "Coût par corps d'état (XAF)", Object.entries(k.costs.byCorpsEtat as Record<string, number>).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 10).map(([label, value]) => ({ label, value: Math.round(value as number) })));
  }

  private buildPreventifKpiSheet(wb: ExcelJS.Workbook, p: any) {
    const ws = wb.addWorksheet("KPI Préventif", { views: [{ showGridLines: false }] });
    ws.getColumn(1).width = 4;
    ws.getColumn(2).width = 34;
    ws.getColumn(3).width = 14;
    ws.getColumn(4).width = 40;

    this.title(ws, "B2:D2", "Indicateurs de maintenance préventive");

    let row = 4;
    const rows: [string, string | number][] = [
      ["Tâches planifiées (période)", p.planifiees],
      ["Tâches effectuées", p.realisees],
      ["Taux de réalisation des tâches (%)", p.tauxTaches],
      ["Tickets de type préventif", p.ticketsPreventifsTotal],
      ["Tickets préventifs terminés", p.ticketsPreventifsDone],
      ["Taux de réalisation des tickets préventifs (%)", p.tauxTickets],
    ];
    for (const [label, value] of rows) {
      ws.getCell(`B${row}`).value = label;
      ws.getCell(`B${row}`).font = { color: { argb: "FF16233C" } };
      const cell = ws.getCell(`C${row}`);
      cell.value = value;
      cell.font = { bold: true, color: { argb: "FF16233C" } };
      cell.alignment = { horizontal: "right" };
      row++;
    }
    row++;
    this.dataBarRow(ws, row, "C", "Taux de réalisation des tâches", p.tauxTaches, 100);
    row++;
    this.dataBarRow(ws, row, "C", "Taux de réalisation des tickets", p.tauxTickets, 100);
  }

  private buildEquipmentKpiSheet(wb: ExcelJS.Workbook, stats: any[]) {
    const ws = this.addStyledSheet(wb, "KPI par Équipement", [
      { header: "Équipement", key: "nom", width: 28 },
      { header: "Supermarché", key: "sm", width: 26 },
      { header: "Nb tickets", key: "count", width: 12 },
      { header: "Coût total (XAF)", key: "cout", width: 16, numFmt: "#,##0" },
      { header: "Temps d'arrêt total (h)", key: "arret", width: 18 },
    ], stats.map((s) => ({ nom: s.nom, sm: s.supermarche, count: s.count, cout: Math.round(s.cout), arret: Math.round(s.tempsArret * 10) / 10 })));

    if (stats.length) {
      const max = Math.max(...stats.map((s) => s.count));
      ws.addConditionalFormatting({
        ref: `C2:C${stats.length + 1}`,
        rules: [{ type: "dataBar", priority: 1, minLength: 0, maxLength: 100, color: { argb: "FFFA5B07" }, cfvo: [{ type: "num", value: 0 }, { type: "num", value: max }] } as any],
      });
    }
  }

  // ── Petits utilitaires de style ExcelJS ──────────────────────────────────────
  private title(ws: ExcelJS.Worksheet, range: string, text: string) {
    ws.mergeCells(range);
    const cell = ws.getCell(range.split(":")[0]);
    cell.value = text;
    cell.font = { bold: true, size: 16, color: { argb: "FF16233C" } };
  }

  private statRow(ws: ExcelJS.Worksheet, row: number, stats: [string, string | number][]): number {
    let col = 2; // B
    for (const [label, value] of stats) {
      const labelCell = ws.getCell(row, col);
      labelCell.value = label;
      labelCell.font = { size: 9, color: { argb: "FF64748B" } };
      const valueCell = ws.getCell(row + 1, col);
      valueCell.value = value;
      valueCell.font = { bold: true, size: 14, color: { argb: "FFFA5B07" } };
      col++;
    }
    return row + 3;
  }

  // Barres horizontales natives (databar) pour visualiser une répartition —
  // le tableur affiche une vraie barre colorée dans chaque cellule, sans
  // dépendre d'un graphique Excel intégré (non exposé par la librairie).
  private sectionBarChart(ws: ExcelJS.Worksheet, startRow: number, title: string, items: { label: string; value: number }[]): number {
    ws.getCell(`B${startRow}`).value = title;
    ws.getCell(`B${startRow}`).font = { bold: true, size: 11, color: { argb: "FF16233C" } };
    let row = startRow + 1;
    if (!items.length) {
      ws.getCell(`B${row}`).value = "Aucune donnée sur la période";
      ws.getCell(`B${row}`).font = { italic: true, color: { argb: "FF94A3B8" } };
      return row + 1;
    }
    const max = Math.max(...items.map((i) => i.value)) || 1;
    for (const item of items) {
      ws.getCell(`B${row}`).value = item.label;
      const valCell = ws.getCell(`C${row}`);
      valCell.value = item.value;
      valCell.alignment = { horizontal: "right" };
      ws.mergeCells(`D${row}:H${row}`);
      const barCell = ws.getCell(`D${row}`);
      barCell.value = item.value;
      row++;
    }
    ws.addConditionalFormatting({
      ref: `D${startRow + 1}:D${row - 1}`,
      rules: [{ type: "dataBar", priority: 1, minLength: 0, maxLength: 100, color: { argb: "FFFA5B07" }, cfvo: [{ type: "num", value: 0 }, { type: "num", value: max }] } as any],
    });
    return row;
  }

  private dataBarRow(ws: ExcelJS.Worksheet, row: number, col: string, label: string, value: number, max: number) {
    ws.getCell(`B${row}`).value = label;
    ws.mergeCells(`${col}${row}:${String.fromCharCode(col.charCodeAt(0) + 4)}${row}`);
    ws.getCell(`${col}${row}`).value = value;
    ws.addConditionalFormatting({
      ref: `${col}${row}:${col}${row}`,
      rules: [{ type: "dataBar", priority: 1, minLength: 0, maxLength: 100, color: { argb: "FF2E8B57" }, cfvo: [{ type: "num", value: 0 }, { type: "num", value: max }] } as any],
    });
  }

  // Feuille de données tabulaire, avec en-tête coloré, filtre automatique et
  // volet figé — le rendu par défaut de la librairie xlsx d'origine n'avait
  // aucun style (texte brut sans couleur, sans bordure, sans figeage).
  private addStyledSheet(
    wb: ExcelJS.Workbook,
    name: string,
    columns: { header: string; key: string; width: number; numFmt?: string }[],
    rows: Record<string, any>[],
  ): ExcelJS.Worksheet {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = columns.map(({ header, key, width }) => ({ header, key, width })) as any;
    for (const c of columns) {
      if (c.numFmt) ws.getColumn(c.key).numFmt = c.numFmt;
    }

    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${NAVY}` } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle" };
      cell.border = { bottom: { style: "thin", color: { argb: "FFD9DFE9" } } };
    });
    headerRow.height = 20;

    rows.forEach((r, i) => {
      const row = ws.addRow(r);
      if (i % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F4F7" } };
        });
      }
      row.eachCell((cell) => {
        cell.border = { bottom: { style: "hair", color: { argb: "FFE7EAF0" } } };
      });
    });

    if (rows.length) {
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
    }
    return ws;
  }

  // Colore les cellules d'une colonne (Statut / Priorité) selon un dictionnaire
  // de couleurs de marque, pour repérer un état en un coup d'œil.
  private colorizeColumn(ws: ExcelJS.Worksheet, key: string, colorMap: Record<string, string>, labelMap: Record<string, string>) {
    const col = ws.getColumn(key);
    const colIndex = col.number;
    const reverseLabel = Object.fromEntries(Object.entries(labelMap).map(([k, v]) => [v, k]));
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const cell = row.getCell(colIndex);
      const rawKey = reverseLabel[String(cell.value)] || String(cell.value);
      const color = colorMap[rawKey];
      if (color) {
        cell.font = { bold: true, color: { argb: `FF${color}` } };
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PDF — synthèse illustrée (barres construites en canvas pdfmake)
  // ══════════════════════════════════════════════════════════════════════════
  async exportPdf(from?: string, to?: string, supermarketId?: string) {
    const { dateFilter, ticketFilter, rapportFilter, rondeFilter } = this.buildFilters(from, to, supermarketId);

    const pdfmake = require("pdfmake");
    const robotoFont = require("pdfmake/build/fonts/Roboto");
    Object.keys(robotoFont.vfs).forEach((key: string) => {
      pdfmake.virtualfs.storage[key] = Buffer.from(robotoFont.vfs[key].data, "base64");
    });
    pdfmake.setFonts(robotoFont.fonts);

    const [
      totalTickets, closedTickets, equipmentsCount, plansCount,
      recentTickets, recentRapports, recentRondes, selectedSupermarket,
      users, supermarkets, localisations, gmaoKpis, equipmentStats,
      byStatusRaw, byPriorityRaw,
    ] = await Promise.all([
      this.prisma.ticket.count({ where: ticketFilter }),
      this.prisma.ticket.count({ where: { ...ticketFilter, status: "FERME" } }),
      this.prisma.equipment.count({ where: supermarketId ? { supermarketId } : {} }),
      this.prisma.preventivePlan.count({ where: supermarketId ? { equipment: { supermarketId } } : {} }),
      this.prisma.ticket.findMany({ where: ticketFilter, orderBy: { createdAt: "desc" }, take: 30, include: { equipment: { select: { nom: true } } } }),
      this.prisma.rapportJournalier.findMany({ where: rapportFilter, orderBy: { date: "desc" }, take: 15, include: { maintenancier: { select: { nom: true } } } }),
      this.prisma.rondeJournaliere.findMany({ where: rondeFilter, orderBy: { date: "desc" }, take: 15, include: { supermarket: { select: { nom: true } }, maintenancier: { select: { nom: true } } } }),
      supermarketId ? this.prisma.supermarket.findUnique({ where: { id: supermarketId } }) : null,
      this.prisma.user.findMany({ where: supermarketId ? { supermarketId } : {}, select: { nom: true, email: true, role: true, active: true }, orderBy: { nom: "asc" } }),
      this.prisma.supermarket.findMany({ select: { nom: true, code: true, createdAt: true } }),
      this.prisma.localisation.findMany({ where: supermarketId ? { supermarketId } : {}, include: { supermarket: { select: { nom: true } } } }),
      this.kpi.getGmaoKpis({ supermarketId, dateDebut: dateFilter.gte, dateFin: dateFilter.lte }),
      this.getEquipmentTicketStats(ticketFilter, 12),
      this.prisma.ticket.groupBy({ by: ["status"], where: ticketFilter, _count: { id: true } }),
      this.prisma.ticket.groupBy({ by: ["priority"], where: ticketFilter, _count: { id: true } }),
    ]);

    const statusItems = byStatusRaw.map((g: any) => ({ label: STATUS_LABEL[g.status] || g.status, value: g._count.id, color: `#${STATUS_COLOR[g.status] || "64748B"}` })).sort((a: any, b: any) => b.value - a.value);
    const priorityItems = byPriorityRaw.map((g: any) => ({ label: PRIORITY_LABEL[g.priority] || g.priority, value: g._count.id, color: `#${PRIORITY_COLOR[g.priority] || "64748B"}` })).sort((a: any, b: any) => b.value - a.value);

    const titlePrefix = selectedSupermarket ? `Supermarché : ${selectedSupermarket.nom}` : "Tous les supermarchés";
    const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: "Super Admin", MAINTENANCIER: "Maintenancier", USER: "Demandeur" };

    const docDefinition: any = {
      pageSize: "A4",
      pageMargins: [35, 50, 35, 50],
      defaultStyle: { font: "Roboto" },
      info: { title: "Rapport GMAO complet", author: "Système GMAO" },
      content: [
        { canvas: [{ type: "rect", x: 0, y: 0, w: 525, h: 4, color: `#${ORANGE}` }], margin: [0, 0, 0, 10] },
        { text: "Rapport GMAO — Synthèse et sauvegarde", style: "header", margin: [0, 0, 0, 2] },
        { text: `${titlePrefix} · Période : ${from || "Début"} au ${to || "Aujourd'hui"}`, style: "subheader", margin: [0, 0, 0, 10] },

        { text: "1. Indicateurs généraux", style: "sectionTitle" },
        this.pdfStatCards([
          ["Total tickets", String(totalTickets), NAVY],
          ["Fermés", `${closedTickets} (${totalTickets > 0 ? Math.round((closedTickets / totalTickets) * 100) : 0}%)`, "2E8B57"],
          ["Équipements", String(equipmentsCount), "2F6FB0"],
          ["Plans préventifs", String(plansCount), ORANGE],
        ]),

        { text: "2. Interventions — répartitions graphiques", style: "sectionTitle" },
        {
          columns: [
            { width: "50%", stack: [{ text: "Par statut", style: "subsectionTitle" }, this.pdfBarChart(statusItems, 110, 55)] },
            { width: "50%", stack: [{ text: "Par priorité", style: "subsectionTitle" }, this.pdfBarChart(priorityItems, 100, 55)], margin: [15, 0, 0, 0] },
          ],
          margin: [0, 0, 0, 4],
        },
        { text: "Par corps d'état", style: "subsectionTitle" },
        this.pdfBarChart(gmaoKpis.byCorpsEtat.slice(0, 8).map((c: any, i: number) => ({ label: c.corpsEtat, value: c.count, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] })), 300, 140),

        { text: "3. Indicateurs de maintenance préventive", style: "sectionTitle" },
        this.pdfStatCards([
          ["Tâches planifiées", String(gmaoKpis.preventive.planifiees), NAVY],
          ["Tâches effectuées", String(gmaoKpis.preventive.realisees), "2E8B57"],
          ["Taux tâches", `${gmaoKpis.preventive.tauxTaches}%`, ORANGE],
          ["Taux tickets préventifs", `${gmaoKpis.preventive.tauxTickets}%`, "2F6FB0"],
        ]),

        { text: "4. Top équipements par nombre d'interventions", style: "sectionTitle" },
        this.pdfBarChart(equipmentStats.map((e, i) => ({ label: e.nom, value: e.count, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] })), 300, 140),
        {
          table: {
            widths: ["*", "auto", "auto", "auto"],
            body: [
              [{ text: "Équipement", style: "tableHeader" }, { text: "Nb tickets", style: "tableHeader" }, { text: "Coût (XAF)", style: "tableHeader" }, { text: "Arrêt (h)", style: "tableHeader" }],
              ...equipmentStats.slice(0, 12).map((e) => [e.nom, String(e.count), Math.round(e.cout).toLocaleString("fr-FR"), String(Math.round(e.tempsArret * 10) / 10)]),
            ],
          },
          fontSize: 8,
          layout: "lightHorizontalLines",
          margin: [0, 6, 0, 15],
        },

        { text: "5. Sites du réseau", style: "sectionTitle" },
        {
          table: {
            widths: ["*", "auto", "auto"],
            body: [
              [{ text: "Nom", style: "tableHeader" }, { text: "Code", style: "tableHeader" }, { text: "Créé le", style: "tableHeader" }],
              ...supermarkets.map((s) => [s.nom, s.code, s.createdAt.toISOString().split("T")[0]]),
            ],
          },
          fontSize: 8,
          layout: "lightHorizontalLines",
          margin: [0, 2, 0, 15],
        },

        { text: "6. Localisations", style: "sectionTitle" },
        {
          table: {
            widths: ["*", "*"],
            body: [
              [{ text: "Nom", style: "tableHeader" }, { text: "Supermarché", style: "tableHeader" }],
              ...localisations.map((l) => [l.nom, l.supermarket?.nom || ""]),
            ],
          },
          fontSize: 8,
          layout: "lightHorizontalLines",
          margin: [0, 2, 0, 15],
        },

        { text: "7. Utilisateurs", style: "sectionTitle" },
        {
          table: {
            widths: ["*", "*", "auto", "auto"],
            body: [
              [{ text: "Nom", style: "tableHeader" }, { text: "Email", style: "tableHeader" }, { text: "Rôle", style: "tableHeader" }, { text: "Actif", style: "tableHeader" }],
              ...users.map((u) => [u.nom, u.email, ROLE_LABEL[u.role] || u.role, u.active ? "Oui" : "Non"]),
            ],
          },
          fontSize: 8,
          layout: "lightHorizontalLines",
          margin: [0, 2, 0, 15],
        },

        { text: "8. Derniers tickets (Top 30)", style: "sectionTitle" },
        {
          table: {
            widths: ["auto", "auto", "*", "auto", "auto", "auto"],
            body: [
              [{ text: "N°", style: "tableHeader" }, { text: "Date", style: "tableHeader" }, { text: "Titre", style: "tableHeader" }, { text: "Priorité", style: "tableHeader" }, { text: "Statut", style: "tableHeader" }, { text: "Équipement", style: "tableHeader" }],
              ...recentTickets.map((t) => [String(t.numero), t.createdAt.toISOString().split("T")[0], t.titre, PRIORITY_LABEL[t.priority] || t.priority, STATUS_LABEL[t.status] || t.status, t.equipment?.nom || "—"]),
            ],
          },
          fontSize: 8,
          layout: "lightHorizontalLines",
          margin: [0, 2, 0, 15],
        },

        { text: "9. Derniers rapports journaliers (Top 15)", style: "sectionTitle" },
        {
          table: {
            widths: ["auto", "auto", "*", "auto", "auto"],
            body: [
              [{ text: "Date", style: "tableHeader" }, { text: "Maintenancier", style: "tableHeader" }, { text: "Activités", style: "tableHeader" }, { text: "Sig Tech", style: "tableHeader" }, { text: "Sig Resp", style: "tableHeader" }],
              ...recentRapports.map((r) => [r.date.toISOString().split("T")[0], r.maintenancier?.nom || "—", { text: r.activites || "—", maxLines: 2 }, r.signatureTechnicien ? "Oui" : "Non", r.signatureResponsable ? "Oui" : "Non"]),
            ],
          },
          fontSize: 8,
          layout: "lightHorizontalLines",
          margin: [0, 2, 0, 15],
        },

        { text: "10. Dernières rondes journalières (Top 15)", style: "sectionTitle" },
        {
          table: {
            widths: ["auto", "auto", "auto", "*", "auto"],
            body: [
              [{ text: "Date", style: "tableHeader" }, { text: "Supermarché", style: "tableHeader" }, { text: "Maintenancier", style: "tableHeader" }, { text: "Observations", style: "tableHeader" }, { text: "Signatures", style: "tableHeader" }],
              ...recentRondes.map((r) => {
                const sigs = [r.signatureTechnicien ? "Tech" : "", r.signaturePermanent ? "Perm" : "", r.signatureDM ? "DM" : ""].filter(Boolean).join(", ") || "Aucune";
                return [r.date.toISOString().split("T")[0], r.supermarket?.nom || "—", r.maintenancier?.nom || "—", r.observationsGenerales || "—", sigs];
              }),
            ],
          },
          fontSize: 8,
          layout: "lightHorizontalLines",
          margin: [0, 2, 0, 15],
        },

        { canvas: [{ type: "rect", x: 0, y: 0, w: 525, h: 2, color: `#${ORANGE}` }], margin: [0, 5, 0, 5] },
        { text: `Document de synthèse officiel GMAO · Généré le ${new Date().toLocaleString("fr-FR")}`, alignment: "center", fontSize: 8, color: "#94a3b8" },
      ],
      styles: {
        header: { fontSize: 16, bold: true, color: "#060537" },
        subheader: { fontSize: 9, color: "#475569" },
        sectionTitle: { fontSize: 12, bold: true, color: `#${ORANGE}`, margin: [0, 10, 0, 6] },
        subsectionTitle: { fontSize: 10, bold: true, color: "#060537", margin: [0, 4, 0, 4] },
        tableHeader: { fontSize: 8, bold: true, color: "#060537", fillColor: "#f1f5f9", margin: [3, 4, 3, 4] },
      },
    };

    const doc = pdfmake.createPdf(docDefinition, {});
    return doc.getBuffer();
  }

  // ── Petits utilitaires de composition PDF (cartes chiffrées, barres) ────────
  private pdfStatCards(items: [string, string, string][]) {
    return {
      columns: items.map(([label, value, color]) => ({
        width: "*",
        stack: [
          { text: value, fontSize: 16, bold: true, color: `#${color}`, alignment: "center" },
          { text: label, fontSize: 8, color: "#64748b", alignment: "center", margin: [0, 2, 0, 0] },
        ],
      })),
      columnGap: 10,
      margin: [0, 4, 0, 14],
    };
  }

  // Barre horizontale dessinée en canvas — remplace un graphique natif
  // (pdfmake n'a pas de primitive "chart") tout en restant net et lisible.
  private pdfBarChart(items: { label: string; value: number; color?: string }[], trackWidth: number, labelWidth = 130) {
    if (!items.length) {
      return { text: "Aucune donnée sur la période", fontSize: 9, color: "#94a3b8", margin: [0, 2, 0, 10] };
    }
    const max = Math.max(...items.map((i) => i.value)) || 1;
    return {
      stack: items.map((item) => {
        const w = Math.max(2, Math.round((item.value / max) * trackWidth));
        return {
          columns: [
            { width: labelWidth, text: item.label, fontSize: 8, color: "#334155", margin: [0, 4, 0, 0] },
            { width: trackWidth + 10, canvas: [{ type: "rect", x: 0, y: 3, w, h: 10, color: item.color || `#${ORANGE}`, r: 2 }] },
            { width: 32, text: String(item.value), fontSize: 8, bold: true, alignment: "right", margin: [4, 4, 0, 0] },
          ],
          columnGap: 4,
          margin: [0, 1, 0, 1],
        };
      }),
      margin: [0, 4, 0, 14],
    };
  }
}

function fmtDate(d: Date) {
  return d.toISOString().split("T")[0];
}
