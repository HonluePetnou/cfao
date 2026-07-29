import { Controller, Post, UseGuards } from "@nestjs/common";
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
}
