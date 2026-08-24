import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { addInterval } from "../common/date.util";

@Injectable()
export class PreventiveTasksService {
  constructor(private prisma: PrismaService) {}

  // Tâches réelles en attente d'un maintenancier
  findByMaintenancier(maintenancierId: string) {
    return this.prisma.preventiveTask.findMany({
      where: {
        plan: { assignedMaintenancierId: maintenancierId },
        status: { in: ["PLANIFIE", "EN_RETARD"] },
      },
      include: {
        plan: {
          include: {
            equipment: { select: { id: true, nom: true, corpsEtat: true, supermarket: { select: { nom: true } } } },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });
  }

  // Tâches réelles et projetées (sur 12 mois) pour le calendrier de l'admin
  async findAllProjected() {
    // 1. Charger toutes les tâches réelles en base
    const realTasks = await this.prisma.preventiveTask.findMany({
      include: {
        plan: {
          include: {
            equipment: { select: { id: true, nom: true, corpsEtat: true, supermarket: { select: { nom: true } } } },
            assignedMaintenancier: { select: { id: true, nom: true } },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    // 2. Charger les plans actifs pour projeter les tâches futures
    const activePlans = await this.prisma.preventivePlan.findMany({
      where: { active: true },
      include: {
        equipment: { select: { id: true, nom: true, corpsEtat: true, supermarket: { select: { nom: true } } } },
        assignedMaintenancier: { select: { id: true, nom: true } },
      },
    });

    const now = new Date();
    const endLimit = new Date();
    endLimit.setMonth(endLimit.getMonth() + 12); // Limite de 12 mois dans le futur

    const projectedTasks: any[] = [...realTasks];

    for (const plan of activePlans) {
      let currentDate = new Date(plan.nextDate);

      // S'assurer qu'on ne boucle pas indéfiniment si intervalValue <= 0
      const val = plan.intervalValue > 0 ? plan.intervalValue : 30;

      while (currentDate <= endLimit) {
        // Est-ce qu'une tâche réelle existe déjà pour ce plan à cette date précise (même jour) ?
        const exists = realTasks.some(
          (t) =>
            t.planId === plan.id &&
            new Date(t.dueDate).toDateString() === currentDate.toDateString()
        );

        if (!exists) {
          projectedTasks.push({
            id: `projected-${plan.id}-${currentDate.getTime()}`,
            planId: plan.id,
            dueDate: new Date(currentDate),
            status: "PLANIFIE",
            doneAt: null,
            note: null,
            isProjected: true,
            plan: {
              id: plan.id,
              titre: plan.titre,
              checklist: plan.checklist,
              intervalValue: plan.intervalValue,
              intervalUnit: plan.intervalUnit,
              equipment: plan.equipment,
              assignedMaintenancier: plan.assignedMaintenancier,
            },
            createdAt: plan.createdAt,
            updatedAt: plan.updatedAt,
          });
        }

        // Incrémenter la date pour la récurrence
        currentDate = addInterval(currentDate, plan.intervalUnit as any, val);
      }
    }

    // Trier par date d'échéance
    return projectedTasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }

  // Obtenir les détails d'une tâche (réelle ou projetée) pour le formulaire public du prestataire
  async findPublicTask(id: string) {
    if (id.startsWith("projected-")) {
      const parts = id.split("-");
      const planId = parts[1];
      const time = parseInt(parts[2], 10);

      const plan = await this.prisma.preventivePlan.findUnique({
        where: { id: planId },
        include: {
          equipment: { select: { id: true, nom: true, corpsEtat: true, supermarket: { select: { id: true, nom: true } } } },
        },
      });

      if (!plan) throw new NotFoundException("Plan préventif introuvable");

      return {
        id,
        planId: plan.id,
        dueDate: new Date(time),
        status: "PLANIFIE",
        isProjected: true,
        plan: {
          id: plan.id,
          titre: plan.titre,
          checklist: plan.checklist,
          equipment: plan.equipment,
        },
      };
    }

    const task = await this.prisma.preventiveTask.findUnique({
      where: { id },
      include: {
        plan: {
          include: {
            equipment: { select: { id: true, nom: true, corpsEtat: true, supermarket: { select: { id: true, nom: true } } } },
          },
        },
      },
    });

    if (!task) throw new NotFoundException("Tâche préventive introuvable");
    return task;
  }

  // Validation publique d'une tâche par le prestataire + création d'un ticket préventif fermé
  async submitPublicTask(id: string, data: { note: string; cout?: number; tempsArret?: number; imputation?: string }) {
    let task: any;

    if (id.startsWith("projected-")) {
      const parts = id.split("-");
      const planId = parts[1];
      const time = new Date(parseInt(parts[2], 10));

      // 1. Créer la tâche réelle en base
      task = await this.prisma.preventiveTask.create({
        data: {
          planId,
          dueDate: time,
          status: "EFFECTUE",
          doneAt: new Date(),
          note: data.note,
          imputation: data.imputation || null,
        },
        include: {
          plan: {
            include: {
              equipment: true,
            },
          },
        },
      });

      // 2. Mettre à jour la prochaine date d'échéance du plan si nécessaire
      const plan = task.plan;
      if (time >= plan.nextDate) {
        const val = plan.intervalValue > 0 ? plan.intervalValue : 30;
        const next = addInterval(time, plan.intervalUnit as any, val);

        await this.prisma.preventivePlan.update({
          where: { id: planId },
          data: { lastDate: time, nextDate: next },
        });
      }
    } else {
      // Tâche réelle déjà existante
      task = await this.prisma.preventiveTask.update({
        where: { id },
        data: {
          status: "EFFECTUE",
          doneAt: new Date(),
          note: data.note,
          imputation: data.imputation || null,
        },
        include: {
          plan: {
            include: {
              equipment: true,
            },
          },
        },
      });
    }

    // 3. Créer un Ticket fermé de type MAINT_PREVENTIVE pour faire remonter le coût et les heures d'arrêt
    const plan = task.plan;
    const eq = plan.equipment;

    await this.prisma.ticket.create({
      data: {
        titre: `[PREVENTIF] ${plan.titre}`,
        description: `Maintenance préventive effectuée par prestataire.\nRapport : ${data.note || "Aucun commentaire"}`,
        status: "FERME",
        priority: "MOYENNE",
        equipmentId: eq.id,
        localisation: eq.localisationId ? (await this.prisma.localisation.findUnique({ where: { id: eq.localisationId } }))?.nom : null,
        corpsEtat: eq.corpsEtat,
        typeTravaux: "MAINT_PREVENTIVE",
        cout: data.cout !== undefined && data.cout !== null && (data.cout as any) !== "" ? parseFloat(data.cout as any) : null,
        tempsArret: data.tempsArret !== undefined && data.tempsArret !== null && (data.tempsArret as any) !== "" ? parseFloat(data.tempsArret as any) : 0,
        financement: "OPEX",
        paiement: "Facture prestataire",
        dateDebutInterv: task.dueDate,
        dateFinInterv: new Date(),
        dateAssigned: new Date(),
        dateEnCours: new Date(),
        dateTermine: new Date(),
        dateFerme: new Date(),
        imputation: data.imputation || null,
      },
    });

    return task;
  }

  async markDone(id: string, note?: string) {
    return this.prisma.preventiveTask.update({
      where: { id },
      data: { status: "EFFECTUE", doneAt: new Date(), note },
    });
  }
}
