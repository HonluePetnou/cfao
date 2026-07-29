import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class EquipmentsService {
  constructor(private prisma: PrismaService) {}

  findAll(filters?: { supermarketId?: string; localisationId?: string }) {
    const where: any = {};
    if (filters?.supermarketId) where.supermarketId = filters.supermarketId;
    if (filters?.localisationId) where.localisationId = filters.localisationId;
    return this.prisma.equipment.findMany({ where, include: { supermarket: { select: { nom: true } }, localisation: { select: { nom: true } } } });
  }

  findById(id: string) { return this.prisma.equipment.findUnique({ where: { id }, include: { supermarket: true, localisation: true } }); }

  create(data: { nom: string; supermarketId: string; localisationId?: string; criticite?: string; description?: string }) {
    return this.prisma.equipment.create({ data });
  }

  update(id: string, data: any) { return this.prisma.equipment.update({ where: { id }, data }); }

  delete(id: string) { return this.prisma.equipment.delete({ where: { id } }); }
}
