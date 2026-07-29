import { Module } from "@nestjs/common";
import { PreventiveTasksService } from "./preventive-tasks.service";
import { PreventiveTasksController } from "./preventive-tasks.controller";
import { PrismaService } from "../prisma.service";

@Module({
  controllers: [PreventiveTasksController],
  providers: [PreventiveTasksService, PrismaService],
})
export class PreventiveTasksModule {}
