import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from "@nestjs/common";
import { EquipmentsService } from "./equipments.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("equipments")
@UseGuards(JwtAuthGuard, RolesGuard)
export class EquipmentsController {
  constructor(private service: EquipmentsService) {}

  @Get()
  @Roles("SUPER_ADMIN", "MAINTENANCIER", "USER", "VIEWER")
  findAll(
    @Query("supermarketId") supermarketId?: string,
    @Query("localisationId") localisationId?: string,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.service.findAll({ supermarketId, localisationId, includeInactive: includeInactive === "true" });
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "MAINTENANCIER", "USER", "VIEWER")
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
