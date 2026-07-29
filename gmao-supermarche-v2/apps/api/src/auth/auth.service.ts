import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma.service";
import * as bcrypt from "bcryptjs";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException("Email ou mot de passe invalide");
    }
    if (!user.active) throw new UnauthorizedException("Compte désactivé");
    const token = this.jwt.sign({ sub: user.id, role: user.role });
    return { token, user: { id: user.id, nom: user.nom, email: user.email, role: user.role, supermarketId: user.supermarketId, localisationId: user.localisationId } };
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nom: true, email: true, role: true, supermarketId: true, localisationId: true, phone: true },
    });
  }
}
