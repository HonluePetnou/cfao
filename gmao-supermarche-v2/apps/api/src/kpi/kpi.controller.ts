import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { KpiService } from "./kpi.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("kpi")
@UseGuards(JwtAuthGuard, RolesGuard)
export class KpiController {
  constructor(private service: KpiService) {}

  @Get()
  @Roles("SUPER_ADMIN", "MAINTENANCIER", "USER", "VIEWER")
  getKpi() { return this.service.compute(); }

  @Get("gmao")
  @Roles("SUPER_ADMIN", "MAINTENANCIER", "VIEWER")
  getGmaoKpis(
    @Query("supermarketId") supermarketId?: string,
    @Query("equipmentId") equipmentId?: string,
    @Query("dateDebut") dateDebut?: string,
    @Query("dateFin") dateFin?: string,
    @Query("financement") financement?: string,
    @Query("imputation") imputation?: string,
  ) {
    const clean = (val?: string) => (val && val !== "undefined" && val !== "null") ? val : undefined;

    let parsedDateFin: Date | undefined = undefined;
    if (clean(dateFin)) {
      parsedDateFin = new Date(dateFin!);
      parsedDateFin.setUTCHours(23, 59, 59, 999); // Set to end of day
    }

    return this.service.getGmaoKpis({
      supermarketId: clean(supermarketId),
      equipmentId: clean(equipmentId),
      dateDebut: clean(dateDebut) ? new Date(dateDebut!) : undefined,
      dateFin: parsedDateFin,
      financement: clean(financement),
      imputation: clean(imputation),
    });
  }
}
