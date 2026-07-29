import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

interface KpiFilter {
  supermarketId?: string;
  equipmentId?: string;
  dateDebut?: Date;
  dateFin?: Date;
  financement?: string;
  imputation?: string;
}

function msToHours(ms: number) { return ms / 3_600_000; }
function roundH(h: number) { return Math.round(h * 10) / 10; }

@Injectable()
export class KpiService {
  constructor(private prisma: PrismaService) {}

  // ─── Endpoint legacy (dashboard simple) ─────────────────────────────────────
  async compute() {
    const totalTickets = await this.prisma.ticket.count();
    const closedTickets = await this.prisma.ticket.count({ where: { status: "FERME" } });
    const doneTickets = await this.prisma.ticket.count({ where: { status: { in: ["TERMINE", "FERME"] } } });
    const preventivePlans = await this.prisma.preventivePlan.count({ where: { active: true } });
    const pendingTasks = await this.prisma.preventiveTask.count({ where: { status: { in: ["PLANIFIE", "EN_RETARD"] } } });
    const overdueTasks = await this.prisma.preventiveTask.count({ where: { status: { in: ["PLANIFIE", "EN_RETARD"] }, dueDate: { lt: new Date() } } });
    const avgResolutionDays = await this.getAvgResolutionDays();
    const byPriority = await this.getByPriority();
    return { totalTickets, closedTickets, doneTickets, utilizationPct: totalTickets ? Math.round((closedTickets / totalTickets) * 100) : 0, avgResolutionDays, preventivePlans, pendingTasks, overdueTasks, byPriority };
  }

  // ─── Dashboard GMAO complet (calqué sur le board Excel) ─────────────────────
  async getGmaoKpis(filter: KpiFilter) {
    const where = await this.buildWhere(filter);

    const [
      // ── Compteurs top ──
      totalInterventions,
      interventionEnAttente,
      maintenanceCorrective,
      maintenancePreventive,
      equipementPlusImpactant,

      // ── Fiabilité ──
      reliability,

      // ── Préventif ──
      preventive,

      // ── Coûts ──
      costs,

      // ── Répartitions count ──
      byCorpsEtat,
      byTypeTravaux,
      byLocalisation,
      bySupermarket,
    ] = await Promise.all([
      // total interventions
      this.prisma.ticket.count({ where }),
      // en attente = NOUVEAU + ASSIGNE
      this.prisma.ticket.count({ where: { ...where, status: { in: ["NOUVEAU", "ASSIGNE"] } } }),
      // corrective
      this.prisma.ticket.count({ where: { ...where, typeTravaux: "MAINT_CORRECTIVE" } }),
      // préventive
      this.prisma.ticket.count({ where: { ...where, typeTravaux: "MAINT_PREVENTIVE" } }),
      // équipement le plus impacté (le + de tickets correctifs)
      this.getEquipementPlusImpactant(where),

      // fiabilité
      this.computeReliability(filter, where),
      // taux préventif
      this.computePreventiveRate(where),
      // coûts
      this.computeCosts(where),

      // répartitions
      this.countByCorpsEtat(where),
      this.countByTypeTravaux(where),
      this.countByLocalisation(where),
      this.countBySupermarket(where),
    ]);

    return {
      // Compteurs top (ligne 1 du board Excel)
      totalInterventions,
      interventionEnAttente,
      maintenanceCorrective,
      maintenancePreventive,
      equipementPlusImpactant,

      // Fiabilité
      reliability,

      // Préventif
      preventive,

      // Coûts
      costs,

      // Répartitions
      byCorpsEtat,
      byTypeTravaux,
      byLocalisation,
      bySupermarket,
    };
  }

  // ─── Équipement le plus impacté ───────────────────────────────────────────────
  private async getEquipementPlusImpactant(where: any) {
    const tickets = await this.prisma.ticket.findMany({
      where: { ...where, typeTravaux: "MAINT_CORRECTIVE" },
      select: { equipmentId: true },
    });
    if (!tickets.length) return null;

    const counts: Record<string, number> = {};
    tickets.forEach((t) => { counts[t.equipmentId] = (counts[t.equipmentId] ?? 0) + 1; });
    const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!topId) return null;

    const eq = await this.prisma.equipment.findUnique({
      where: { id: topId },
      select: { id: true, nom: true, corpsEtat: true },
    });
    return eq ? { ...eq, count: counts[topId] } : null;
  }

  // ─── Fiabilité ────────────────────────────────────────────────────────────────
  private async computeReliability(filter: KpiFilter, where: any) {
    const now = new Date();
    const dateDebut = filter.dateDebut ?? new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const dateFin = filter.dateFin ?? now;
    const periodeMs = dateFin.getTime() - dateDebut.getTime();

    const pannes = await this.prisma.ticket.findMany({
      where: { ...where, typeTravaux: "MAINT_CORRECTIVE", tempsArret: { gt: 0 } },
      select: { tempsArret: true },
    });

    const nbPannes = pannes.length;
    const tempsArretMs = pannes.reduce((acc, p) => acc + (p.tempsArret ?? 0) * 3_600_000, 0);
    const tempsFonctionnementMs = Math.max(periodeMs - tempsArretMs, 0);

    const mtbfMs = nbPannes > 0 ? tempsFonctionnementMs / nbPannes : periodeMs;
    const mttrMs = nbPannes > 0 ? tempsArretMs / nbPannes : 0;
    const disponibilite = periodeMs > 0 ? (tempsFonctionnementMs / periodeMs) * 100 : 100;

    return {
      nbPannes,
      mtbfH: roundH(msToHours(mtbfMs)),
      mttrH: roundH(msToHours(mttrMs)),
      disponibilite: Math.min(Math.round(disponibilite * 100) / 100, 100),
      tempsArretH: roundH(msToHours(tempsArretMs)),
      tempsFonctionnementH: roundH(msToHours(tempsFonctionnementMs)),
    };
  }

  // ─── Taux préventif ───────────────────────────────────────────────────────────
  private async computePreventiveRate(where: any) {
    const eqIds: string[] | undefined = (where.equipmentId as any)?.in ?? (where.equipmentId ? [where.equipmentId] : undefined);
    const smFilter = eqIds
      ? { plan: { equipment: { id: { in: eqIds } } } }
      : {};

    const [planifiees, realisees, ticketsPreventifsTotal, ticketsPreventifsDone] = await Promise.all([
      this.prisma.preventiveTask.count({ where: { status: { in: ["PLANIFIE", "EN_RETARD", "EFFECTUE", "ANNULE"] }, ...smFilter } }),
      this.prisma.preventiveTask.count({ where: { status: "EFFECTUE", ...smFilter } }),
      this.prisma.ticket.count({ where: { ...where, typeTravaux: "MAINT_PREVENTIVE" } }),
      this.prisma.ticket.count({ where: { ...where, typeTravaux: "MAINT_PREVENTIVE", status: { in: ["TERMINE", "FERME"] } } }),
    ]);

    return {
      planifiees,
      realisees,
      tauxTaches: planifiees > 0 ? Math.round((realisees / planifiees) * 100) : 0,
      ticketsPreventifsTotal,
      ticketsPreventifsDone,
      tauxTickets: ticketsPreventifsTotal > 0 ? Math.round((ticketsPreventifsDone / ticketsPreventifsTotal) * 100) : 0,
    };
  }

  // ─── Coûts ────────────────────────────────────────────────────────────────────
  private async computeCosts(where: any) {
    const tickets = await this.prisma.ticket.findMany({
      where: { ...where, cout: { not: null } },
      select: { cout: true, typeTravaux: true, corpsEtat: true, financement: true, equipmentId: true },
    });

    const total = tickets.reduce((s, t) => s + (t.cout ?? 0), 0);
    const corrective = tickets.filter((t) => t.typeTravaux === "MAINT_CORRECTIVE").reduce((s, t) => s + (t.cout ?? 0), 0);
    const preventive = tickets.filter((t) => t.typeTravaux === "MAINT_PREVENTIVE").reduce((s, t) => s + (t.cout ?? 0), 0);
    const ameliorative = tickets.filter((t) => t.typeTravaux === "MAINT_AMELIORATIVE").reduce((s, t) => s + (t.cout ?? 0), 0);
    const travauxNeufs = tickets.filter((t) => t.typeTravaux === "TRAVAUX_NEUFS").reduce((s, t) => s + (t.cout ?? 0), 0);

    // Par corps d'état
    const byCorpsEtat: Record<string, number> = {};
    tickets.forEach((t) => {
      if (t.corpsEtat) byCorpsEtat[t.corpsEtat] = (byCorpsEtat[t.corpsEtat] ?? 0) + (t.cout ?? 0);
    });

    // CAPEX / OPEX
    const capex = tickets.filter((t) => t.financement?.toUpperCase() === "CAPEX").reduce((s, t) => s + (t.cout ?? 0), 0);
    const opex = tickets.filter((t) => t.financement?.toUpperCase() !== "CAPEX").reduce((s, t) => s + (t.cout ?? 0), 0);

    // Par type de travaux (pour dépenses)
    const byTypeTravaux: Record<string, number> = { corrective, preventive, ameliorative, travauxNeufs };

    return { total, corrective, preventive, ameliorative, travauxNeufs, capex, opex, byCorpsEtat, byTypeTravaux };
  }

  // ─── Comptages ────────────────────────────────────────────────────────────────
  private async countByCorpsEtat(where: any) {
    const groups = await this.prisma.ticket.groupBy({ by: ["corpsEtat"], where, _count: { id: true } });
    return groups.filter((g) => g.corpsEtat).map((g) => ({ corpsEtat: g.corpsEtat!, count: g._count.id })).sort((a, b) => b.count - a.count);
  }

  private async countByTypeTravaux(where: any) {
    const groups = await this.prisma.ticket.groupBy({ by: ["typeTravaux"], where, _count: { id: true } });
    return groups.filter((g) => g.typeTravaux).map((g) => ({ typeTravaux: g.typeTravaux!, count: g._count.id }));
  }

  private async countByLocalisation(where: any) {
    const groups = await this.prisma.ticket.groupBy({ by: ["localisation"], where, _count: { id: true } });
    return groups.filter((g) => g.localisation).map((g) => ({ localisation: g.localisation!, count: g._count.id })).sort((a, b) => b.count - a.count);
  }

  private async countBySupermarket(where: any) {
    const tickets = await this.prisma.ticket.findMany({
      where,
      select: { cout: true, equipment: { select: { supermarketId: true } } },
    });
    const counts: Record<string, number> = {};
    const costs: Record<string, number> = {};
    tickets.forEach((t) => {
      const smId = t.equipment?.supermarketId;
      if (smId) {
        counts[smId] = (counts[smId] ?? 0) + 1;
        costs[smId] = (costs[smId] ?? 0) + (t.cout ?? 0);
      }
    });
    const sms = await this.prisma.supermarket.findMany({ select: { id: true, nom: true, code: true } });
    return sms.filter((s) => counts[s.id]).map((s) => ({ supermarketId: s.id, nom: s.nom, code: s.code, count: counts[s.id], cout: costs[s.id] ?? 0 })).sort((a, b) => b.count - a.count);
  }

  // ─── buildWhere ───────────────────────────────────────────────────────────────
  private async buildWhere(filter: KpiFilter) {
    const now = new Date();
    const dateDebut = filter.dateDebut;
    const dateFin = filter.dateFin;

    let equipmentIdFilter: { in: string[] } | undefined;
    if (filter.supermarketId) {
      const equipments = await this.prisma.equipment.findMany({
        where: { supermarketId: filter.supermarketId },
        select: { id: true },
      });
      equipmentIdFilter = { in: equipments.map((e) => e.id) };
    }

    // Build date filter: match on dateFerme (historical imports) OR createdAt (new tickets)
    const dateFilter = (dateDebut || dateFin)
      ? {
          OR: [
            { dateFerme: { gte: dateDebut, lte: dateFin ?? now } },
            { createdAt: { gte: dateDebut, lte: dateFin ?? now } },
          ],
        }
      : {}; // No date filter = show all tickets

    return {
      ...(filter.equipmentId
        ? { equipmentId: filter.equipmentId }
        : equipmentIdFilter
        ? { equipmentId: equipmentIdFilter }
        : {}),
      ...(filter.financement
        ? ({ financement: { equals: filter.financement, mode: "insensitive" } } as any)
        : {}),
      ...(filter.imputation
        ? ({ imputation: { equals: filter.imputation, mode: "insensitive" } } as any)
        : {}),
      ...dateFilter,
    };
  }

  private async getAvgResolutionDays() {
    const closed = await this.prisma.ticket.findMany({
      where: { OR: [{ dateFerme: { not: null } }, { dateTermine: { not: null } }] },
      select: { createdAt: true, dateFerme: true, dateTermine: true },
    });
    if (!closed.length) return 0;
    const totalDays = closed.reduce((sum, t) => {
      const end = t.dateFerme ?? t.dateTermine!;
      return sum + (end.getTime() - t.createdAt.getTime()) / 86400000;
    }, 0);
    return Math.round((totalDays / closed.length) * 10) / 10;
  }

  private async getByPriority() {
    const groups = await this.prisma.ticket.groupBy({ by: ["priority"], _count: { id: true } });
    return groups.map((g) => ({ priority: g.priority, count: g._count.id }));
  }
}
