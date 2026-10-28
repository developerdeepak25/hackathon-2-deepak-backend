import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Change, ChangeSchema } from '../schema/change.schema.js';
import { Company, CompanySchema } from '../schema/company.schema.js';
import { PolicyVersion, PolicyVersionSchema } from '../schema/policy-version.schema.js';
import { ChangesController } from './changes.controller.js';
import { CompanyController } from './company.controller.js';
import { CompanyService } from './company.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Company.name, schema: CompanySchema },
      { name: Change.name, schema: ChangeSchema },
      { name: PolicyVersion.name, schema: PolicyVersionSchema },
    ]),
  ],
  controllers: [CompanyController, ChangesController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
