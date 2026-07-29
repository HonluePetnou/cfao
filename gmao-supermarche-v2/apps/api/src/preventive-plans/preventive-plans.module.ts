import { Module } from "@nestjs/common";
import { PreventivePlansService } from "./preventive-plans.service";
import { PreventivePlansController } from "./preventive-plans.controller";
import { PrismaService } from "../prisma.service";

@Module({
  controllers: [PreventivePlansController],
  providers: [PreventivePlansService, PrismaService],
  exports: [PreventivePlansService],
})
export class PreventivePlansModule {}
