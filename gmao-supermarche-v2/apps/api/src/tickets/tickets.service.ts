import { Injectable, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { EventsGateway } from "../events/events.gateway";

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  async findAll(filters?: { status?: string; maintenancierId?: string; createdById?: string; supermarketId?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.maintenancierId) where.assignedMaintenancierId = filters.maintenancierId;
    if (filters?.createdById) where.createdById = filters.createdById;
    if (filters?.supermarketId) where.equipment = { supermarketId: filters.supermarketId };
    return this.prisma.ticket.findMany({
      where,
      include: {
        equipment: { select: { id: true, nom: true } },
        createdBy: { select: { id: true, nom: true } },
        assignedMaintenancier: { select: { id: true, nom: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
  }

  async findById(id: string) {
    return this.prisma.ticket.findUnique({
      where: { id },
      include: {
        equipment: { include: { supermarket: { select: { nom: true } }, localisation: { select: { nom: true } } } },
        createdBy: { select: { id: true, nom: true, email: true } },
        assignedMaintenancier: { select: { id: true, nom: true, email: true } },
        closedBy: { select: { id: true, nom: true } },
      },
    });
  }

  async create(data: {
    titre: string;
    description?: string;
    priority: string;
    equipmentId: string;
    createdById: string;
    assignedMaintenancierId: string;
    photos?: string;
    localisation?: string;
    corpsEtat?: string;
    typeTravaux?: string;
  }) {
    const equipment = await this.prisma.equipment.findUnique({ where: { id: data.equipmentId } });
    if (!equipment) throw new ForbiddenException("Équipement introuvable");

    const maintenancier = await this.prisma.user.findFirst({
      where: { id: data.assignedMaintenancierId, role: "MAINTENANCIER" },
    });
    if (!maintenancier) throw new ForbiddenException("Maintenancier invalide");

    const ticket = await this.prisma.ticket.create({
      data: {
        titre: data.titre,
        description: data.description,
        priority: data.priority as any,
        equipmentId: data.equipmentId,
        createdById: data.createdById,
        assignedMaintenancierId: data.assignedMaintenancierId,
        photos: data.photos,
        localisation: data.localisation,
        corpsEtat: data.corpsEtat,
        typeTravaux: data.typeTravaux,
        status: "ASSIGNE",
        dateAssigned: new Date(),
      },
      include: {
        equipment: { select: { id: true, nom: true } },
        createdBy: { select: { id: true, nom: true } },
        assignedMaintenancier: { select: { id: true, nom: true } },
      },
    });
    this.events.notifyMaintenancier(data.assignedMaintenancierId, "nouveau-ticket", ticket);
    return ticket;
  }

  async startTicket(id: string, userId: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket || ticket.assignedMaintenancierId !== userId) throw new ForbiddenException("Pas votre ticket");
    if (ticket.status !== "ASSIGNE") throw new ForbiddenException("Statut invalide");
    return this.prisma.ticket.update({ where: { id }, data: { status: "EN_COURS", dateEnCours: new Date() } });
  }

  async markDone(id: string, userId: string, extra?: {
    cout?: number;
    tempsArret?: number;
    financement?: string;
    paiement?: string;
    dateDebutInterv?: string;
    dateFinInterv?: string;
    commentaireMaintenancier?: string;
    imputation?: string;
  }) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket || ticket.assignedMaintenancierId !== userId) throw new ForbiddenException("Pas votre ticket");
    if (ticket.status !== "EN_COURS") throw new ForbiddenException("Statut invalide");
    const data: any = { status: "TERMINE", dateTermine: new Date() };
    if (extra?.cout !== undefined) data.cout = extra.cout;
    if (extra?.tempsArret !== undefined) data.tempsArret = extra.tempsArret;
    if (extra?.financement) data.financement = extra.financement;
    if (extra?.paiement) data.paiement = extra.paiement;
    if (extra?.dateDebutInterv) data.dateDebutInterv = new Date(extra.dateDebutInterv);
    if (extra?.dateFinInterv) data.dateFinInterv = new Date(extra.dateFinInterv);
    if (extra?.commentaireMaintenancier) data.commentaireMaintenancier = extra.commentaireMaintenancier;
    if (extra?.imputation) data.imputation = extra.imputation;
    const updated = await this.prisma.ticket.update({ where: { id }, data });
    this.events.notifyAdmin("ticket-termine", updated);
    return updated;
  }

  async closeTicket(id: string, adminId: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (ticket?.status !== "TERMINE") throw new ForbiddenException("Le ticket doit être au statut TERMINE");
    return this.prisma.ticket.update({ where: { id }, data: { status: "FERME", closedById: adminId, dateFerme: new Date() } });
  }

  async sendBack(id: string, adminId: string, motif: string, newStatus: string = "A_REPRENDRE") {
    return this.prisma.ticket.update({ where: { id }, data: { status: newStatus as any, motifReprise: motif } });
  }

  async update(id: string, data: any) {
    const allowed = [
      "titre", "description", "priority", "localisation", "corpsEtat",
      "typeTravaux", "cout", "tempsArret", "financement", "paiement",
      "dateDebutInterv", "dateFinInterv", "commentaireMaintenancier", "imputation",
    ];
    const updateData: any = {};
    for (const key of allowed) {
      if (data[key] !== undefined) updateData[key] = data[key];
    }
    if (updateData.dateDebutInterv) updateData.dateDebutInterv = new Date(updateData.dateDebutInterv);
    if (updateData.dateFinInterv) updateData.dateFinInterv = new Date(updateData.dateFinInterv);
    return this.prisma.ticket.update({ where: { id }, data: updateData });
  }

  async delete(id: string) {
    return this.prisma.ticket.delete({ where: { id } });
  }
}
