import { Module } from "@nestjs/common";
import { RondeService } from "./ronde.service";
import { RondeController } from "./ronde.controller";
import { PrismaService } from "../prisma.service";

@Module({
  controllers: [RondeController],
  providers: [RondeService, PrismaService],
})
export class RondeModule {}
