import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module.js';
import { Company, CompanyDocument } from '../schema/company.schema.js';
import { PolicyVersion, PolicyVersionDocument } from '../schema/policy-version.schema.js';
import { Change, ChangeDocument } from '../schema/change.schema.js';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const companyModel = app.get<Model<CompanyDocument>>(getModelToken(Company.name));
  const versionModel = app.get<Model<PolicyVersionDocument>>(getModelToken(PolicyVersion.name));
  const changeModel = app.get<Model<ChangeDocument>>(getModelToken(Change.name));

  const company = await companyModel.findOne();
  if (!company) throw new Error('No companies found. Run `npm run seed` first.');

  const versionIds: any[] = [];
  const changeIds: any[] = [];

  try {
    const v1 = await versionModel.create({
      companyId: company._id, fetchedAt: new Date('2000-01-01'),
      text: 'sanity old', contentHash: 'sanity-hash-1', isSample: true,
    });
    const v2 = await versionModel.create({
      companyId: company._id, fetchedAt: new Date('2000-01-02'),
      text: 'sanity new', contentHash: 'sanity-hash-2', isSample: true,
    });
    versionIds.push(v1._id, v2._id);

    const payload = {
      companyId: company._id, fromVersionId: v1._id, toVersionId: v2._id,
      detectedAt: new Date('2000-01-02'), summary: 'test', whatItMeansForYou: 'test',
      importance: 'high', tags: ['other'], isSample: true,
    } satisfies Partial<Change>;
    const c1 = await changeModel.create(payload);
    changeIds.push(c1._id);
    console.log('OK  - change inserted');

    try {
      const c2 = await changeModel.create(payload);
      changeIds.push(c2._id);
      console.log('FAIL - duplicate (from, to) pair was NOT rejected');
    } catch (e: any) {
      console.log(e.code === 11000
        ? 'OK  - duplicate (from, to) pair rejected'
        : `FAIL - unexpected error: ${e.message}`);
    }

    try {
      // @ts-expect-error -- deliberately invalid enum value to verify schema validation
      await changeModel.create({ ...payload, toVersionId: v1._id, importance: 'urgent' });
      console.log('FAIL - invalid importance accepted');
    } catch {
      console.log('OK  - invalid importance rejected');
    }
  } finally {
    await changeModel.deleteMany({ _id: { $in: changeIds } });
    await versionModel.deleteMany({ _id: { $in: versionIds } });
    console.log('Cleaned up test records');
    await app.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});