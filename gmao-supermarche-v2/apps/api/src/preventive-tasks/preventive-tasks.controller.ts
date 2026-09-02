import { Controller, Get, Patch, Param, Body, UseGuards, Req } from "@nestjs/common";
import { PreventiveTasksService } from "./preventive-tasks.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("preventive-tasks")
export class PreventiveTasksController {
  constructor(private service: PreventiveTasksService) {}

  @Get("my")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MAINTENANCIER")
  findMyTasks(@Req() req: any) {
    return this.service.findByMaintenancier(req.user.id);
  }

  @Get("projected")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "MAINTENANCIER", "VIEWER")
  findAllProjected() {
    return this.service.findAllProjected();
  }

  @Patch(":id/done")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MAINTENANCIER")
  markDone(@Param("id") id: string, @Body() body: any) {
    return this.service.markDone(id, body.note);
  }

  // ─── Endpoints Publics (Prestataire) ───

  @Get("public/:id")
  findPublicTask(@Param("id") id: string) {
    return this.service.findPublicTask(id);
  }

  @Patch("public/:id")
  submitPublicTask(@Param("id") id: string, @Body() body: any) {
    return this.service.submitPublicTask(id, {
      note: body.note,
      cout: body.cout,
      tempsArret: body.tempsArret,
    });
  }
}
