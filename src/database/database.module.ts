import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PolicyVersion, PolicyVersionSchema } from '../schema/policy-version.schema.js';
import { Change, ChangeSchema } from '../schema/change.schema.js';
import { JobRun, JobRunSchema } from '../schema/job-run.schema.js';
import { Company, CompanySchema } from '../schema/company.schema.js';

// Registers every model once. Feature modules in later phases just import DatabaseModule.
const models = MongooseModule.forFeature([
  { name: Company.name, schema: CompanySchema },
  { name: PolicyVersion.name, schema: PolicyVersionSchema },
  { name: Change.name, schema: ChangeSchema },
  { name: JobRun.name, schema: JobRunSchema },
]);

@Module({ imports: [models], exports: [models] })
export class DatabaseModule {}