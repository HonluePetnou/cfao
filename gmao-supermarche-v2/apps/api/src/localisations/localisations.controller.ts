import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from "@nestjs/common";
import { LocalisationsService } from "./localisations.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("localisations")
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocalisationsController {
  constructor(private service: LocalisationsService) {}

  @Get()
  @Roles("SUPER_ADMIN", "MAINTENANCIER", "USER")
  findAll(@Query("supermarketId") supermarketId?: string) { return this.service.findAll(supermarketId); }

  @Get(":id")
  @Roles("SUPER_ADMIN", "MAINTENANCIER", "USER")
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
