import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, Request, Res, Header,
} from "@nestjs/common";
import { Response } from "express";
import { RondeService } from "./ronde.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("rondes")
@UseGuards(JwtAuthGuard, RolesGuard)
export class RondeController {
  constructor(private service: RondeService) {}

  // ─── CONFIGURATION ──────────────────────────────────────────────

  @Get("config/:supermarketId")
  getConfig(@Param("supermarketId") supermarketId: string) {
    return this.service.getConfig(supermarketId);
  }

  @Post("config/:supermarketId")
  @Roles("SUPER_ADMIN")
  upsertConfig(
    @Param("supermarketId") supermarketId: string,
    @Body() body: { zones: any[] },
  ) {
    return this.service.upsertConfig(supermarketId, body.zones);
  }

  // ─── RONDES JOURNALIÈRES ─────────────────────────────────────────

  @Get()
  findAll(
    @Query("supermarketId") supermarketId?: string,
    @Query("maintenancierId") maintenancierId?: string,
    @Query("dateDebut") dateDebut?: string,
    @Query("dateFin") dateFin?: string,
  ) {
    return this.service.findAll({ supermarketId, maintenancierId, dateDebut, dateFin });
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    return this.service.findById(id);
  }

  @Get(":id/pdf")
  @Header("Content-Type", "application/pdf")
  @Header("Content-Disposition", 'attachment; filename="bilan-ronde.pdf"')
  async exportPdf(@Param("id") id: string, @Res() res: Response) {
    const buffer = await this.service.exportPdf(id);
    res.send(buffer);
  }

  @Post()
  @Roles("SUPER_ADMIN", "MAINTENANCIER")
  create(@Body() body: any, @Request() req: any) {
    return this.service.create({
      ...body,
      maintenancierId: body.maintenancierId || req.user?.id,
    });
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "MAINTENANCIER")
  update(@Param("id") id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Patch(":id/signer")
  @Roles("SUPER_ADMIN", "MAINTENANCIER")
  signer(
    @Param("id") id: string,
    @Body() body: { role: "technicien" | "permanent" | "dm"; nom?: string },
    @Request() req: any,
  ) {
    return this.service.signer(id, body.role, body.nom || req.user?.nom || "");
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN")
  delete(@Param("id") id: string) {
    return this.service.delete(id);
  }
}
