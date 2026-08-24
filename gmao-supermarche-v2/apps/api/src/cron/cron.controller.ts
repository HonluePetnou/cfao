import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { CronService } from "./cron.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("cron")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CronController {
  constructor(private cron: CronService) {}

  @Post("generate-tasks")
  @Roles("SUPER_ADMIN")
  generateTasks() { return this.cron.handlePreventiveCron(); }

  // Déclenche à la demande le même job que le planificateur quotidien
  // de 20h — utile pour tester ou rattraper une date sans attendre l'heure.
  @Post("generate-rapports")
  @Roles("SUPER_ADMIN")
  generateRapports(@Body() body: { date?: string }) {
    return this.cron.generateDailyRapports(body?.date);
  }
}
