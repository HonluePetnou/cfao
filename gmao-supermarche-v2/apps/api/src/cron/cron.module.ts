import { Module } from "@nestjs/common";
import { CronService } from "./cron.service";
import { CronController } from "./cron.controller";
import { PrismaService } from "../prisma.service";
import { PreventivePlansService } from "../preventive-plans/preventive-plans.service";

@Module({
  controllers: [CronController],
  providers: [CronService, PrismaService, PreventivePlansService],
})
export class CronModule {}
