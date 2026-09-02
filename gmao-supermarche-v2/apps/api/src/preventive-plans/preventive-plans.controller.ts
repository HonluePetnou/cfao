import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { PreventivePlansService } from "./preventive-plans.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("preventive-plans")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PreventivePlansController {
  constructor(private service: PreventivePlansService) {}

  @Get()
  @Roles("SUPER_ADMIN", "MAINTENANCIER", "VIEWER")
  findAll() { return this.service.findAll(); }

  @Get(":id")
  @Roles("SUPER_ADMIN", "MAINTENANCIER", "VIEWER")
  findById(@Param("id") id: string) { return this.service.findById(id); }

  @Post()
  @Roles("SUPER_ADMIN")
  create(@Body() body: any) { return this.service.create(body); }

  @Patch(":id")
  @Roles("SUPER_ADMIN")
  update(@Param("id") id: string, @Body() body: any) { return this.service.update(id, body); }

  @Delete(":id")
  @Roles("SUPER_ADMIN")
  delete(@Param("id") id: string) { return this.service.delete(id); }
}
