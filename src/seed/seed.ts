import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Company, CompanyDocument } from '../schema/company.schema.js';
import { PolicyVersion } from '../schema/policy-version.schema.js';
import { Change } from '../schema/change.schema.js';
import { JobRun } from '../schema/job-run.schema.js';
import { COMPANIES_SEED } from './companies.seed.js';
import { AppModule } from '../app.module.js';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const companyModel = app.get<Model<CompanyDocument>>(getModelToken(Company.name));
  const versionModel = app.get<Model<any>>(getModelToken(PolicyVersion.name));
  const changeModel = app.get<Model<any>>(getModelToken(Change.name));

  const companyOps = COMPANIES_SEED.map((c) => ({
    updateOne: {
      filter: { slug: c.slug },
      update: {
        $set: { name: c.name, category: c.category, policyUrl: c.policyUrl },
        $setOnInsert: {
          slug: c.slug,
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
  console.log(`Companies: ${result.upsertedCount} inserted, ${result.modifiedCount} updated`);

  const whatsapp = await companyModel.findOne({ slug: 'whatsapp' }).lean();
  if (whatsapp) {
    const olderText = `We use your information to operate, maintain, and improve the service. We may use device information to keep our services secure, diagnose bugs, and improve features.`;
    const newerText = `We use your information to operate, maintain, and improve the service. We may use device information to keep our services secure, diagnose bugs, improve features, and train or improve our AI systems to deliver better product experiences.`;

    const fromVersion = await versionModel.findOneAndUpdate(
      { companyId: whatsapp._id, contentHash: 'whatsapp-demo-v1' },
      {
        companyId: whatsapp._id,
        fetchedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        text: olderText,
        contentHash: 'whatsapp-demo-v1',
        isSample: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const toVersion = await versionModel.findOneAndUpdate(
      { companyId: whatsapp._id, contentHash: 'whatsapp-demo-v2' },
      {
        companyId: whatsapp._id,
        fetchedAt: new Date(),
        text: newerText,
        contentHash: 'whatsapp-demo-v2',
        isSample: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const existing = await changeModel.findOne({
      companyId: whatsapp._id,
      fromVersionId: fromVersion._id,
      toVersionId: toVersion._id,
    });

    if (!existing) {
      await changeModel.create({
        companyId: whatsapp._id,
        fromVersionId: fromVersion._id,
        toVersionId: toVersion._id,
        detectedAt: new Date(),
        summary: 'WhatsApp updated its privacy policy to mention AI-related product improvements and model training use of user content.',
        whatItMeansForYou:
          'This signals that the company may use your content or account data to improve AI and product features. If this matters to you, review the new wording carefully.',
        importance: 'high',
        tags: ['ai-training', 'data-sharing'],
        changedSections: ['Data use', 'AI and product improvements'],
        aiStatus: 'fallback',
        isSample: true,
      });
      console.log('Demo change seed created for WhatsApp');
    } else {
      console.log('Demo change already exists for WhatsApp');
    }
  }

  for (const name of [Company.name, PolicyVersion.name, Change.name, JobRun.name]) {
    await app.get<Model<any>>(getModelToken(name)).syncIndexes();
  }

  const total = await companyModel.countDocuments();
  console.log(`Total companies in DB: ${total} (expected ${COMPANIES_SEED.length})`);

  await app.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});