import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class MaintenanciersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      where: { role: "MAINTENANCIER", active: true },
      select: { id: true, nom: true, email: true, phone: true },
    });
  }
}
