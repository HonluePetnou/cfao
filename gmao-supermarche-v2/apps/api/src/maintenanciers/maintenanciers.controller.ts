import { Controller, Get, UseGuards } from "@nestjs/common";
import { MaintenanciersService } from "./maintenanciers.service";
import { JwtAuthGuard } from "../auth/jwt.guard";

@Controller("maintenanciers")
@UseGuards(JwtAuthGuard)
export class MaintenanciersController {
  constructor(private service: MaintenanciersService) {}

  @Get()
  findAll() { return this.service.findAll(); }
}
