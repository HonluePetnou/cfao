import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private service: UsersService) {}

  @Get()
  @Roles("SUPER_ADMIN")
  findAll() { return this.service.findAll(); }

  @Get(":id")
  @Roles("SUPER_ADMIN")
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
