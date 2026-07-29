import { Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { HealthController } from "./health/health.controller";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { SupermarketsModule } from "./supermarkets/supermarkets.module";
import { LocalisationsModule } from "./localisations/localisations.module";
import { EquipmentsModule } from "./equipments/equipments.module";
import { TicketsModule } from "./tickets/tickets.module";
import { MaintenanciersModule } from "./maintenanciers/maintenanciers.module";
import { EventsModule } from "./events/events.module";
import { PreventivePlansModule } from "./preventive-plans/preventive-plans.module";
import { PreventiveTasksModule } from "./preventive-tasks/preventive-tasks.module";
import { CronModule } from "./cron/cron.module";
import { KpiModule } from "./kpi/kpi.module";
import { ExportModule } from "./export/export.module";
import { RapportJournalierModule } from "./rapport-journalier/rapport-journalier.module";
import { RondeModule } from "./ronde/ronde.module";

@Module({
  imports: [
    AuthModule,
    UsersModule,
    SupermarketsModule,
    LocalisationsModule,
    EquipmentsModule,
    TicketsModule,
    MaintenanciersModule,
    EventsModule,
    PreventivePlansModule,
    PreventiveTasksModule,
    CronModule,
    KpiModule,
    ExportModule,
    RapportJournalierModule,
    RondeModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
