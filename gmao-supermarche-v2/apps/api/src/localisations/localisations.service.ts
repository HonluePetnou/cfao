import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class LocalisationsService {
  constructor(private prisma: PrismaService) {}

  findAll(supermarketId?: string) {
    const where = supermarketId ? { supermarketId } : {};
    return this.prisma.localisation.findMany({ where, include: { supermarket: { select: { nom: true } } } });
  }

  findById(id: string) { return this.prisma.localisation.findUnique({ where: { id }, include: { supermarket: true, equipments: true } }); }

  create(data: { nom: string; supermarketId: string }) { return this.prisma.localisation.create({ data }); }

  update(id: string, data: { nom?: string }) { return this.prisma.localisation.update({ where: { id }, data }); }

  delete(id: string) { return this.prisma.localisation.delete({ where: { id } }); }
}
