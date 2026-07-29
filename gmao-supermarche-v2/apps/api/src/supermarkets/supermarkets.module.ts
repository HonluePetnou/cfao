import { Module } from "@nestjs/common";
import { SupermarketsService } from "./supermarkets.service";
import { SupermarketsController } from "./supermarkets.controller";
import { PrismaService } from "../prisma.service";

@Module({
  controllers: [SupermarketsController],
  providers: [SupermarketsService, PrismaService],
})
export class SupermarketsModule {}
