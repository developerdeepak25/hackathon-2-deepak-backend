import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PolicyRunService } from './policy-run.service.js';

@Injectable()
export class PolicyCronService {
  private readonly logger = new Logger(PolicyCronService.name);

  constructor(private readonly policyRunService: PolicyRunService) {}

  /** Runs the daily check at midnight UTC; the per-company lock skips duplicate checks. */
  @Cron('0 0 * * *', { timeZone: 'UTC' })
  async runDailyChecks(): Promise<void> {
    this.logger.log('Starting scheduled daily policy checks');
    try {
      const result = await this.policyRunService.run(undefined, 'cron');
      this.logger.log(
        `Scheduled daily policy checks finished with status '${result.status}'`,
      );
    } catch (error) {
      this.logger.error(
        `Scheduled daily policy checks failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
