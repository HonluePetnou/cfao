import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PreventivePlansService } from "../preventive-plans/preventive-plans.service";
import { RapportJournalierService } from "../rapport-journalier/rapport-journalier.service";

// Fuseau du réseau (Cameroun, UTC+1) — explicite pour que l'heure de
// déclenchement reste correcte quel que soit le fuseau système du serveur
// (le conteneur Docker de production tourne en UTC par défaut).
const NETWORK_TIMEZONE = "Africa/Douala";
const TARGET_HOUR = 20; // 20h00, heure du réseau — fin de journée type

// Implémenté avec un simple minuteur en mémoire plutôt qu'avec la librairie
// @nestjs/schedule : ce paquet casse la résolution des dépendances de ce
// monorepo (conflit de hoisting npm avec d'autres paquets — reproduit et
// confirmé lors de l'intégration) sans qu'un simple correctif de version ne
// suffise. Un setInterval() qui vérifie l'heure chaque minute reste un vrai
// déclenchement automatique, sans dépendance supplémentaire ni ce risque.
@Injectable()
export class CronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CronService.name);
  private timer?: NodeJS.Timeout;
  private lastRunDate: string | null = null;

  constructor(
    private preventivePlans: PreventivePlansService,
    private rapportJournalier: RapportJournalierService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.checkDailyRapportSchedule(), 60_000);
    this.logger.log(`Planificateur des rapports journaliers actif (déclenchement quotidien à ${TARGET_HOUR}h00, ${NETWORK_TIMEZONE})`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private todayInNetworkTz(): string {
    return new Date().toLocaleDateString("en-CA", { timeZone: NETWORK_TIMEZONE });
  }

  private currentHourInNetworkTz(): number {
    return parseInt(
      new Intl.DateTimeFormat("en-GB", { timeZone: NETWORK_TIMEZONE, hour: "2-digit", hour12: false }).format(new Date()),
      10,
    );
  }

  // Vérifié chaque minute : dès qu'on atteint TARGET_HOUR pour la première
  // fois ce jour-là (heure réseau), déclenche la génération. La condition
  // ">=" plutôt que "===" rattrape le cas d'un redémarrage du serveur pile
  // après l'heure cible sans manquer le jour.
  private async checkDailyRapportSchedule() {
    const today = this.todayInNetworkTz();
    if (this.lastRunDate === today) return;
    if (this.currentHourInNetworkTz() < TARGET_HOUR) return;
    this.lastRunDate = today;
    await this.generateDailyRapports(today);
  }

  async handlePreventiveCron() {
    this.logger.log("Generating preventive tasks...");
    const created = await this.preventivePlans.generateTasks();
    this.logger.log(`${created.length} tasks generated`);
  }

  // Génération automatique des rapports journaliers en fin de journée
  // (tickets + tâches préventives + rondes du jour, par maintenancier).
  // Extrait en méthode publique pour être rejouable à la demande (route de
  // test manuelle) sans dupliquer la logique de date / gestion d'erreur.
  async generateDailyRapports(dateOverride?: string) {
    const date = dateOverride || this.todayInNetworkTz();
    this.logger.log(`Génération automatique des rapports journaliers pour le ${date}...`);
    try {
      const result = await this.rapportJournalier.generate(date);
      const count = Array.isArray(result) ? result.length : 1;
      this.logger.log(`${count} rapport(s) journalier(s) généré(s)/mis à jour pour le ${date}`);
      return { date, count, rapports: Array.isArray(result) ? result : [result] };
    } catch (e: any) {
      // "Aucune activité trouvée" est un cas normal (site sans mouvement ce
      // jour-là) — pas une panne à journaliser comme une erreur.
      if (e?.status === 400) {
        this.logger.log(`Aucune activité à rapporter pour le ${date}`);
        return { date, count: 0, rapports: [] };
      }
      this.logger.error(`Échec de la génération des rapports pour le ${date}`, e?.stack);
      throw e;
    }
  }
}
