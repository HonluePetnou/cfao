import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from "@nestjs/common";
import { TicketsService } from "./tickets.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("tickets")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
  constructor(private service: TicketsService) {}

  @Get()
  findAll(@Query("status") status?: string, @Query("maintenancierId") maintenancierId?: string, @Query("createdById") createdById?: string, @Query("supermarketId") supermarketId?: string) {
    return this.service.findAll({ status, maintenancierId, createdById, supermarketId });
  }

  @Get(":id")
  findById(@Param("id") id: string) { return this.service.findById(id); }

  @Post()
  @Roles("USER", "MAINTENANCIER", "SUPER_ADMIN")
  create(@Body() body: any, @Req() req: any) {
    return this.service.create({ ...body, createdById: req.user.id });
  }

  @Patch(":id/start")
  @Roles("MAINTENANCIER")
  startTicket(@Param("id") id: string, @Req() req: any) { return this.service.startTicket(id, req.user.id); }

  @Patch(":id/done")
  @Roles("MAINTENANCIER")
  markDone(@Param("id") id: string, @Body() body: any, @Req() req: any) { return this.service.markDone(id, req.user.id, body); }

  @Patch(":id/close")
  @Roles("SUPER_ADMIN")
  closeTicket(@Param("id") id: string, @Req() req: any) { return this.service.closeTicket(id, req.user.id); }

  @Patch(":id/send-back")
  @Roles("SUPER_ADMIN")
  sendBack(@Param("id") id: string, @Body() body: { motif: string }, @Req() req: any) { return this.service.sendBack(id, req.user.id, body.motif); }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "MAINTENANCIER")
  update(@Param("id") id: string, @Body() body: any) { return this.service.update(id, body); }

  @Delete(":id")
  @Roles("SUPER_ADMIN")
  delete(@Param("id") id: string) { return this.service.delete(id); }
}
