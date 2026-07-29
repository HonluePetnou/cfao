import { Module } from "@nestjs/common";
import { RapportJournalierService } from "./rapport-journalier.service";
import { RapportJournalierController } from "./rapport-journalier.controller";
import { PrismaService } from "../prisma.service";

@Module({
  controllers: [RapportJournalierController],
  providers: [RapportJournalierService, PrismaService],
})
export class RapportJournalierModule {}
