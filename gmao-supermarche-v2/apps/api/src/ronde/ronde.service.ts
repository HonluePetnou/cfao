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
}
