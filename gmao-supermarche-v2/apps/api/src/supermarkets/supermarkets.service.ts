import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

const DEFAULT_LOCALISATIONS = [
  "Boucherie",
  "Charcuterie",
  "Boulangerie",
  "Bureaux / Locaux sociaux",
  "Chambres Froides",
  "Exterieur / Parking",
  "Galerie marchande",
  "Jules",
  "La Grande Recré",
  "Lacoste",
  "Locaux Techniques",
  "Meubles froids",
  "Patisserie",
  "Poissonerie",
  "Surface de Vente",
  "Reception",
  "Reserve"
];

// Old defaults to remove during migration cleanup
const STALE_LOCALISATIONS = [
  "Entrée / Caisses",
  "Rayon produit laitier",
  "Rayon fruits et légumes",
  "Traiteur",
  "Boucherie / Charcuterie",
  "Atelier Stock",
  "IT",
  "Local photovoltaïque",
  "Local chambres froides",
];

@Injectable()
export class SupermarketsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    console.log("Syncing default localisations for all supermarkets...");
    try {
      const supermarkets = await this.prisma.supermarket.findMany({
        include: { localisations: true },
      });

      for (const sm of supermarkets) {
        // 1. Remove stale localisations from the old default list
        const staleIds = sm.localisations
          .filter((l) => STALE_LOCALISATIONS.includes(l.nom))
          .map((l) => l.id);

        if (staleIds.length > 0) {
          console.log(`Removing ${staleIds.length} stale localisations from "${sm.nom}"...`);
          await this.prisma.localisation.deleteMany({
            where: { id: { in: staleIds } },
          });
        }

        // 2. Compute remaining names after deletion
        const remainingNoms = new Set(
          sm.localisations
            .filter((l) => !STALE_LOCALISATIONS.includes(l.nom))
            .map((l) => l.nom)
        );

        // 3. Add any missing default localisations
        const missing = DEFAULT_LOCALISATIONS.filter((nom) => !remainingNoms.has(nom));
        if (missing.length > 0) {
          console.log(`Adding ${missing.length} default localisations to "${sm.nom}"...`);
          await this.prisma.localisation.createMany({
            data: missing.map((nom) => ({
              nom,
              supermarketId: sm.id,
            })),
          });
        }
      }
      console.log("Default localisations sync complete.");
    } catch (e) {
      console.error("Failed to sync default localisations:", e);
    }
  }

  findAll() { return this.prisma.supermarket.findMany(); }

  findById(id: string) { return this.prisma.supermarket.findUnique({ where: { id }, include: { localisations: true, equipments: true } }); }

  async create(data: { nom: string; code: string }) {
    const supermarket = await this.prisma.supermarket.create({ data });
    
    await this.prisma.localisation.createMany({
      data: DEFAULT_LOCALISATIONS.map((nom) => ({
        nom,
        supermarketId: supermarket.id,
      })),
    });

    return supermarket;
  }

  update(id: string, data: { nom?: string; code?: string }) { return this.prisma.supermarket.update({ where: { id }, data }); }

  async delete(id: string) {
    // Cascade delete: tickets → equipments → localisations → supermarket
    const equipments = await this.prisma.equipment.findMany({ where: { supermarketId: id }, select: { id: true } });
    const eqIds = equipments.map(e => e.id);
    if (eqIds.length > 0) {
      await this.prisma.preventiveTask.deleteMany({ where: { plan: { equipmentId: { in: eqIds } } } });
      await this.prisma.preventivePlan.deleteMany({ where: { equipmentId: { in: eqIds } } });
      await this.prisma.ticket.deleteMany({ where: { equipmentId: { in: eqIds } } });
    }
    await this.prisma.equipment.deleteMany({ where: { supermarketId: id } });
    await this.prisma.localisation.deleteMany({ where: { supermarketId: id } });
    await this.prisma.user.deleteMany({ where: { supermarketId: id } });
    await this.prisma.rapportJournalier.deleteMany({ where: { maintenancier: { supermarketId: id } } });
    return this.prisma.supermarket.delete({ where: { id } });
  }
}
