import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

@Injectable()
export class EquipmentsService {
  constructor(private prisma: PrismaService) {}

  findAll(filters?: { supermarketId?: string; localisationId?: string; includeInactive?: boolean }) {
    const where: any = {};
    if (filters?.supermarketId) where.supermarketId = filters.supermarketId;
    if (filters?.localisationId) where.localisationId = filters.localisationId;
    if (!filters?.includeInactive) where.active = true;
    return this.prisma.equipment.findMany({
      where,
      include: { supermarket: { select: { nom: true } }, localisation: { select: { nom: true } } },
      orderBy: { nom: "asc" },
    });
  }

  findById(id: string) { return this.prisma.equipment.findUnique({ where: { id }, include: { supermarket: true, localisation: true } }); }

  create(data: { nom: string; supermarketId: string; localisationId?: string; criticite?: string; corpsEtat?: string; description?: string }) {
    return this.prisma.equipment.create({ data });
  }

  update(id: string, data: any) { return this.prisma.equipment.update({ where: { id }, data }); }

  // Un équipement déjà référencé par des tickets ou des plans préventifs ne peut pas
  // être supprimé en base (contrainte de clé étrangère) sans perdre cet historique.
  // On le supprime réellement s'il est libre de toute référence, sinon on l'archive
  // (désactivation) pour qu'il disparaisse des listes actives tout en conservant
  // l'historique des interventions déjà rattachées.
  //
  // Selon la façon dont la contrainte a été créée en base (migration Prisma vs.
  // schéma importé en SQL brut), Postgres peut la lever comme violation "clé
  // étrangère" standard (23503, mappée par Prisma en erreur connue P2003) ou
  // comme violation RESTRICT explicite (23001, que Prisma ne reconnaît pas et
  // remonte en erreur "inconnue" sans champ `.code` exploitable) — les deux cas
  // sont donc détectés ici, y compris au texte brut renvoyé par Postgres.
  async delete(id: string) {
    try {
      return await this.prisma.equipment.delete({ where: { id } });
    } catch (e) {
      if (this.isForeignKeyConstraintError(e)) {
        return this.prisma.equipment.update({ where: { id }, data: { active: false } });
      }
      throw e;
    }
  }

  private isForeignKeyConstraintError(e: unknown): boolean {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") return true;
    const message = e instanceof Error ? e.message : String(e);
    return /23503|23001|foreign key|violates.*constraint|referenced from table/i.test(message);
  }
}
