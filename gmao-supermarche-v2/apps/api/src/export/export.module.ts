import { Module } from "@nestjs/common";
import { ExportService } from "./export.service";
import { ExportController } from "./export.controller";
import { PrismaService } from "../prisma.service";
import { KpiService } from "../kpi/kpi.service";

@Module({
  controllers: [ExportController],
  providers: [ExportService, PrismaService, KpiService],
})
export class ExportModule {}
