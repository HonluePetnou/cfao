import { Controller, Get, Query, Res, UseGuards, Header } from "@nestjs/common";
import { Response } from "express";
import { ExportService } from "./export.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("export")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExportController {
  constructor(private service: ExportService) {}

  @Get("xlsx")
  @Roles("SUPER_ADMIN", "VIEWER")
  async exportXlsx(
    @Res() res: Response,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("supermarketId") supermarketId?: string,
  ) {
    const buffer = await this.service.exportXlsx(from, to, supermarketId);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=export-gmao-${new Date().toISOString().split("T")[0]}.xlsx`);
    res.send(buffer);
  }

  @Get("pdf")
  @Roles("SUPER_ADMIN", "VIEWER")
  @Header("Content-Type", "application/pdf")
  async exportPdf(
    @Res() res: Response,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("supermarketId") supermarketId?: string,
  ) {
    const buffer = await this.service.exportPdf(from, to, supermarketId);
    res.setHeader("Content-Disposition", `attachment; filename=export-gmao-${new Date().toISOString().split("T")[0]}.pdf`);
    res.send(buffer);
  }
}
