import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Company, CompanyDocument } from '../schema/company.schema.js';
import { JobRun, JobRunDocument } from '../schema/job-run.schema.js';
import { TEST_COMPANY_SLUG } from '../utils/constant.js';
import { PolicyTrackerService } from './policy-tracker.service.js';

@Injectable()
export class PolicyRunService {
  private readonly logger = new Logger(PolicyRunService.name);

  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(JobRun.name)
    private readonly jobRunModel: Model<JobRunDocument>,
    private readonly policyTracker: PolicyTrackerService,
  ) {}

  /** Returns the newest job run for the tracker, or null when none has been stored. */
  async getLatest() {
    const job = await this.jobRunModel
      .findOne()
      .sort({ startedAt: -1 })
      .lean()
      .exec();
    if (!job) {
      return null;
    }
    return {
      status: job.status,
      startedAt: new Date(job.startedAt).toISOString(),
      finishedAt: job.finishedAt
        ? new Date(job.finishedAt).toISOString()
        : null,
      companiesChecked: job.companiesChecked,
      changesFound: job.changesFound,
    };
  }

  /** Checks all active companies, or one selected slug, and stores one summary job record. */
  async run(companySlug?: string, trigger: 'manual' | 'cron' = 'manual') {
    if (companySlug === TEST_COMPANY_SLUG) {
      throw new NotFoundException(`Company '${companySlug}' was not found`);
    }
    const companyFilter = companySlug
      ? { slug: companySlug, isActive: true }
      : { isActive: true, slug: { $ne: TEST_COMPANY_SLUG } };
    const companies = await this.companyModel
      .find(companyFilter, { slug: 1 })
      .sort({ name: 1 })
      .lean()
      .exec();

    // Reject a requested slug before creating a run record if it does not exist.
    if (companySlug && companies.length === 0) {
      throw new NotFoundException(`Company '${companySlug}' was not found`);
    }

    const startedAt = new Date();
    const jobRun = await this.jobRunModel.create({
      startedAt,
      finishedAt: null,
      trigger,
      status: 'running',
      companiesChecked: 0,
      companiesSkipped: 0,
      newVersions: 0,
      changesFound: 0,
      companyErrors: [],
    });
    this.logger.log(
      `Policy run ${String(jobRun._id)} started for ${companies.length} ${companies.length === 1 ? 'company' : 'companies'}${companySlug ? ` (slug: ${companySlug})` : ''}`,
    );

    let companiesChecked = 0;
    let companiesSkipped = 0;
    let newVersions = 0;
    let changesFound = 0;
    const errors: Array<{ companySlug: string; message: string }> = [];
    const results: Array<{
      companySlug: string;
      status: 'baseline' | 'unchanged' | 'changed' | 'skipped' | 'failed';
      changeId?: string;
    }> = [];

    // Run sequentially to avoid sending bursts of requests to the policy sites.
    for (const company of companies) {
      try {
        const result = await this.policyTracker.checkCompany(company.slug);
        if (result.status === 'skipped') {
          companiesSkipped += 1;
          this.logger.log(
            `${company.slug}: skipped (${result.skipReason ?? 'already checked'})`,
          );
        } else {
          companiesChecked += 1;
        }
        if (result.status === 'baseline' || result.status === 'changed') {
          newVersions += 1;
        }
        if (result.status === 'changed') {
          changesFound += 1;
        }
        this.logger.log(
          `${company.slug}: check completed with status '${result.status}'`,
        );
        results.push({
          companySlug: result.companySlug,
          status: result.status,
          ...(result.changeId ? { changeId: result.changeId } : {}),
        });
      } catch (error) {
        companiesChecked += 1;
        const message =
          error instanceof Error ? error.message : 'Unknown policy check error';
        this.logger.error(`${company.slug}: check failed: ${message}`);
        errors.push({ companySlug: company.slug, message });
        results.push({ companySlug: company.slug, status: 'failed' });
      }
    }

    const finishedAt = new Date();
    const status =
      errors.length === 0
        ? 'success'
        : errors.length === companies.length
          ? 'failed'
          : 'partial';

    // Persist final counts and per-company errors even when some fetches failed.
    await this.jobRunModel.updateOne(
      { _id: jobRun._id },
      {
        $set: {
          finishedAt,
          status,
          companiesChecked,
          companiesSkipped,
          newVersions,
          changesFound,
          companyErrors: errors,
        },
      },
    );
    this.logger.log(
      `Policy run ${String(jobRun._id)} finished with status '${status}': ${companiesChecked} checked, ${newVersions} new versions, ${changesFound} changes, ${errors.length} errors`,
    );

    return {
      runId: String(jobRun._id),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      status,
      companiesChecked,
      companiesSkipped,
      newVersions,
      changesFound,
      errors,
      results,
    };
  }
}
