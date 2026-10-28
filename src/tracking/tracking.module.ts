import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Change, ChangeSchema } from '../schema/change.schema.js';
import { Company, CompanySchema } from '../schema/company.schema.js';
import { JobRun, JobRunSchema } from '../schema/job-run.schema.js';
import {
  PolicyVersion,
  PolicyVersionSchema,
} from '../schema/policy-version.schema.js';
import { PolicyCheckController } from './policy-check.controller.js';
import { PolicyCronService } from './policy-cron.service.js';
import { PolicyRunController } from './policy-run.controller.js';
import { PolicyRunService } from './policy-run.service.js';
import { PolicyChangeAiService } from './policy-change-ai.service.js';
import { PolicyTrackerService } from './policy-tracker.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Company.name, schema: CompanySchema },
      { name: PolicyVersion.name, schema: PolicyVersionSchema },
      { name: Change.name, schema: ChangeSchema },
      { name: JobRun.name, schema: JobRunSchema },
    ]),
  ],
  controllers: [PolicyCheckController, PolicyRunController],
  providers: [
    PolicyChangeAiService,
    PolicyTrackerService,
    PolicyRunService,
    PolicyCronService,
  ],
  exports: [PolicyTrackerService],
})
export class TrackingModule {}
