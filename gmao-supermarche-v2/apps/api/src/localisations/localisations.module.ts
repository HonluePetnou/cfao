import { Module } from "@nestjs/common";
import { LocalisationsService } from "./localisations.service";
import { LocalisationsController } from "./localisations.controller";
import { PrismaService } from "../prisma.service";

@Module({
  controllers: [LocalisationsController],
  providers: [LocalisationsService, PrismaService],
})
export class LocalisationsModule {}
