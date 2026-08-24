import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Res, Header, Request,
} from "@nestjs/common";
import { Response } from "express";
import { RapportJournalierService } from "./rapport-journalier.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("rapports-journaliers")
@UseGuards(JwtAuthGuard, RolesGuard)
export class RapportJournalierController {
  constructor(private service: RapportJournalierService) {}

  @Get()
  findAll(
    @Query("maintenancierId") maintenancierId?: string,
    @Query("dateDebut") dateDebut?: string,
    @Query("dateFin") dateFin?: string,
  ) {
    return this.service.findAll({ maintenancierId, dateDebut, dateFin });
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    return this.service.findById(id);
  }

  @Post()
  @Roles("SUPER_ADMIN", "MAINTENANCIER")
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @Post("generate")
  generate(@Body() body: { date: string }) {
    return this.service.generate(body.date);
  }

  @Get(":id/pdf")
  @Header("Content-Type", "application/pdf")
  @Header("Content-Disposition", 'attachment; filename="rapport-journalier.pdf"')
  async exportPdf(@Param("id") id: string, @Res() res: Response) {
    const buffer = await this.service.exportPdf(id);
    res.send(buffer);
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "MAINTENANCIER")
  update(@Param("id") id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Patch(":id/sign-technicien")
  signTechnicien(@Param("id") id: string) {
    return this.service.signTechnicien(id);
  }

  @Patch(":id/sign-responsable")
  @Roles("SUPER_ADMIN")
  signResponsable(@Param("id") id: string, @Body() body: { nom: string }) {
    return this.service.signResponsable(id, body.nom);
  }

  @Post("sign-all-responsable")
  @Roles("SUPER_ADMIN")
  signAllResponsable(@Body() body: { ids: string[]; nom: string }) {
    return this.service.signAllResponsable(body.ids, body.nom);
  }

  // Signature groupée par journée (utilisée par le bouton "Visa Responsable"
  // de la page Journaux) — signe tous les rapports non signés de la date donnée.
  @Post("signer-tous")
  @Roles("SUPER_ADMIN")
  signerTous(@Body() body: { date: string; nom?: string }) {
    return this.service.signerTous(body.date, body.nom);
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN")
  delete(@Param("id") id: string) {
    return this.service.delete(id);
  }
}
