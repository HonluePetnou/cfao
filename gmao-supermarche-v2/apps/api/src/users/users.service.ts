import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import * as bcrypt from "bcryptjs";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({ select: { id: true, nom: true, email: true, role: true, supermarketId: true, localisationId: true, active: true } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: { id: true, nom: true, email: true, role: true, supermarketId: true, localisationId: true, phone: true, active: true } });
  }

  async create(data: { nom: string; email: string; password: string; role: string; supermarketId?: string; localisationId?: string; phone?: string }) {
    const hashed = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: { ...data, password: hashed } as any,
      select: { id: true, nom: true, email: true, role: true },
    });
  }

  async update(id: string, data: { nom?: string; email?: string; password?: string; role?: string; active?: boolean; supermarketId?: string; localisationId?: string }) {
    const updateData: any = { ...data };
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    } else {
      delete updateData.password;
    }
    return this.prisma.user.update({ where: { id }, data: updateData, select: { id: true, nom: true, email: true, role: true, active: true } });
  }

  async delete(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }
}
