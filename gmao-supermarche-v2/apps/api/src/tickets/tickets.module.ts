import { Module } from "@nestjs/common";
import { TicketsService } from "./tickets.service";
import { TicketsController } from "./tickets.controller";
import { PrismaService } from "../prisma.service";
import { EventsGateway } from "../events/events.gateway";

@Module({
  controllers: [TicketsController],
  providers: [TicketsService, PrismaService, EventsGateway],
})
export class TicketsModule {}
