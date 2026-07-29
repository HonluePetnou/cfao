import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PreventivePlansService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.preventivePlan.findMany({
      include: {
        equipment: { select: { id: true, nom: true } },
        assignedMaintenancier: { select: { id: true, nom: true } },
      },
    });
  }

  findById(id: string) {
    return this.prisma.preventivePlan.findUnique({
      where: { id },
      include: { equipment: true, assignedMaintenancier: true, tasks: true },
    });
  }

  create(data: {
    titre: string;
    equipmentId: string;
    intervalValue: number;
    intervalUnit: string;
    assignedMaintenancierId?: string;
    prestataire?: string;
    checklist?: string;
    nextDate?: string;
  }) {
    return this.prisma.preventivePlan.create({
      data: {
        titre: data.titre,
        equipmentId: data.equipmentId,
        intervalValue: data.intervalValue,
        intervalUnit: data.intervalUnit as any,
        assignedMaintenancierId: data.assignedMaintenancierId,
        prestataire: data.prestataire,
        checklist: data.checklist,
        nextDate: data.nextDate ? new Date(data.nextDate) : new Date(),
      },
      include: {
        equipment: { select: { id: true, nom: true } },
        assignedMaintenancier: { select: { id: true, nom: true } },
      },
    });
  }

  update(id: string, data: any) {
    const payload: any = {};
    if (data.titre !== undefined) payload.titre = data.titre;
    if (data.equipmentId !== undefined) payload.equipmentId = data.equipmentId;
    if (data.intervalValue !== undefined) payload.intervalValue = data.intervalValue;
    if (data.intervalUnit !== undefined) payload.intervalUnit = data.intervalUnit;
    if (data.assignedMaintenancierId !== undefined) payload.assignedMaintenancierId = data.assignedMaintenancierId;
    if (data.prestataire !== undefined) payload.prestataire = data.prestataire;
    if (data.checklist !== undefined) payload.checklist = data.checklist;
    if (data.active !== undefined) payload.active = data.active;
    if (data.nextDate !== undefined) payload.nextDate = new Date(data.nextDate);
    if (data.lastDate !== undefined) payload.lastDate = data.lastDate;
    return this.prisma.preventivePlan.update({
      where: { id },
      data: payload,
      include: {
        equipment: { select: { id: true, nom: true } },
        assignedMaintenancier: { select: { id: true, nom: true } },
      },
    });
  }

  delete(id: string) {
    return this.prisma.preventivePlan.delete({ where: { id } });
  }

  async generateTasks() {
    const now = new Date();
    const plans = await this.prisma.preventivePlan.findMany({
      where: { active: true, nextDate: { lte: now } },
      include: { assignedMaintenancier: true },
    });
    const created: any[] = [];
    for (const plan of plans) {
      const task = await this.prisma.preventiveTask.create({
        data: {
          planId: plan.id,
          dueDate: plan.nextDate,
        },
      });
      created.push(task);
      const delta = plan.intervalUnit === "DAYS" ? plan.intervalValue :
        plan.intervalUnit === "WEEKS" ? plan.intervalValue * 7 :
        plan.intervalUnit === "MONTHS" ? plan.intervalValue * 30 :
        plan.intervalValue * 365;
      const next = new Date(plan.nextDate.getTime() + delta * 86400000);
      await this.prisma.preventivePlan.update({
        where: { id: plan.id },
        data: { lastDate: plan.nextDate, nextDate: next },
      });
    }
    return created;
  }
}
