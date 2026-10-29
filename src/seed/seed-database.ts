/**
 * Upserts the 10 tracked companies and three sample change reports.
 * Safe to run on every process start: existing rows are updated, not duplicated.
 */

import { Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Change } from '../schema/change.schema.js';
import { Company, CompanyDocument } from '../schema/company.schema.js';
import { JobRun } from '../schema/job-run.schema.js';
import { PolicyVersion } from '../schema/policy-version.schema.js';
import { COMPANIES_SEED } from './companies.seed.js';
import { SAMPLE_CHANGES } from './sample-changes.seed.js';

const logger = new Logger('Seed');

/** Nest app or application context; both expose get(). */
type SeedApp = {
  get<T>(token: unknown): T;
};

/** Inserts or updates seed companies and replaces sample change reports. */
export async function seedDatabase(app: SeedApp): Promise<void> {
  const companyModel = app.get<Model<CompanyDocument>>(getModelToken(Company.name));
  const versionModel = app.get<Model<PolicyVersion>>(getModelToken(PolicyVersion.name));
  const changeModel = app.get<Model<Change>>(getModelToken(Change.name));

  const companyOps = COMPANIES_SEED.map((company) => ({
    updateOne: {
      filter: { slug: company.slug },
      update: {
        $set: {
          name: company.name,
          category: company.category,
          policyUrl: company.policyUrl,
        },
        $setOnInsert: {
          slug: company.slug,
          isActive: true,
          lastCheckedAt: null,
          lastChangedAt: null,
          lastFetchStatus: 'never',
        },
      },
      upsert: true,
    },
  }));
  const result = await companyModel.bulkWrite(companyOps);
  logger.log(
    `Companies: ${result.upsertedCount} inserted, ${result.modifiedCount} updated`,
  );

  const testCompany = await companyModel.findOne({ slug: 'test-company' }).lean();
  if (testCompany) {
    await changeModel.deleteMany({ companyId: testCompany._id });
    await versionModel.deleteMany({ companyId: testCompany._id });
    await companyModel.deleteOne({ _id: testCompany._id });
    logger.log('Removed PolicyHawk Test Company');
  }

  await changeModel.deleteMany({ isSample: true });
  await versionModel.deleteMany({ isSample: true });

  for (const sample of SAMPLE_CHANGES) {
    const company = await companyModel.findOne({ slug: sample.slug }).lean();
    if (!company) {
      continue;
    }
    const detectedAt = new Date(Date.now() - sample.detectedDaysAgo * 24 * 60 * 60 * 1000);
    const fromVersion = await versionModel.findOneAndUpdate(
      { companyId: company._id, contentHash: sample.previousHash },
      {
        companyId: company._id,
        fetchedAt: new Date(detectedAt.getTime() - 24 * 60 * 60 * 1000),
        text: sample.previousText,
        contentHash: sample.previousHash,
        isSample: true,
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    const toVersion = await versionModel.findOneAndUpdate(
      { companyId: company._id, contentHash: sample.currentHash },
      {
        companyId: company._id,
        fetchedAt: detectedAt,
        text: sample.currentText,
        contentHash: sample.currentHash,
        isSample: true,
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    if (!fromVersion || !toVersion) {
      continue;
    }
    await changeModel.findOneAndUpdate(
      {
        companyId: company._id,
        fromVersionId: fromVersion._id,
        toVersionId: toVersion._id,
      },
      {
        companyId: company._id,
        fromVersionId: fromVersion._id,
        toVersionId: toVersion._id,
        detectedAt,
        summary: sample.summary,
        whatItMeansForYou: sample.whatItMeansForYou,
        importance: sample.importance,
        tags: [...sample.tags],
        changedSections: [...sample.changedSections],
        aiStatus: 'ok',
        isSample: true,
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
  }
  logger.log(`Sample change examples: ${SAMPLE_CHANGES.length}`);

  for (const name of [Company.name, PolicyVersion.name, Change.name, JobRun.name]) {
    await app.get<Model<unknown>>(getModelToken(name)).syncIndexes();
  }

  const total = await companyModel.countDocuments();
  logger.log(`Total companies in DB: ${total} (expected ${COMPANIES_SEED.length})`);
}
