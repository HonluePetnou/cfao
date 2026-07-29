import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { SupermarketsService } from "./supermarkets.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("supermarkets")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupermarketsController {
  constructor(private service: SupermarketsService) {}

  @Get()
  @Roles("SUPER_ADMIN", "MAINTENANCIER", "USER")
  findAll() { return this.service.findAll(); }

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
