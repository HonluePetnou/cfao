import { Injectable, Logger } from "@nestjs/common";
import { PreventivePlansService } from "../preventive-plans/preventive-plans.service";

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(private preventivePlans: PreventivePlansService) {}

  async handlePreventiveCron() {
    this.logger.log("Generating preventive tasks...");
    const created = await this.preventivePlans.generateTasks();
    this.logger.log(`${created.length} tasks generated`);
  }
}
