import { Module } from "@nestjs/common";
import { MaintenanciersService } from "./maintenanciers.service";
import { MaintenanciersController } from "./maintenanciers.controller";
import { PrismaService } from "../prisma.service";

@Module({
  controllers: [MaintenanciersController],
  providers: [MaintenanciersService, PrismaService],
})
export class MaintenanciersModule {}
