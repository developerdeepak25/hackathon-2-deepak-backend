import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Change, ChangeDocument } from '../schema/change.schema.js';
import { Company, CompanyDocument } from '../schema/company.schema.js';
import {
  PolicyVersion,
  PolicyVersionDocument,
} from '../schema/policy-version.schema.js';
import { TEST_COMPANY_SLUG } from '../utils/constant.js';
import { buildPolicyExcerpts } from '../tracking/policy-excerpts.js';

export interface CompanyListEntry {
  id: string;
  slug: string;
  name: string;
  category: string;
  policyUrl: string;
  isActive: boolean;
  lastCheckedAt: Date | null;
  lastChangedAt: Date | null;
  lastFetchStatus: 'ok' | 'failed' | 'never';
  todayChangeCount: number;
  changeCount: number;
}

@Injectable()
export class CompanyService {
  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(Change.name)
    private readonly changeModel: Model<ChangeDocument>,
    @InjectModel(PolicyVersion.name)
    private readonly policyVersionModel: Model<PolicyVersionDocument>,
  ) {}

  /** Returns active companies with a count of changes detected during the current UTC day. */
  async listCompanies(): Promise<{
    total: number;
    companies: CompanyListEntry[];
  }> {
    // Use a half-open UTC range so midnight belongs to exactly one day.
    const todayStart = this.getUtcDayStart(new Date());
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

    // Fetch the small company list and grouped change counts concurrently.
    const [companies, dailyCounts, totalCounts] = await Promise.all([
      this.companyModel
        .find(
          { isActive: true, slug: { $ne: TEST_COMPANY_SLUG } },
          {
            _id: 1,
            slug: 1,
            name: 1,
            category: 1,
            policyUrl: 1,
            isActive: 1,
            lastCheckedAt: 1,
            lastChangedAt: 1,
            lastFetchStatus: 1,
          },
        )
        .sort({ name: 1 })
        .lean()
        .exec(),
      this.changeModel
        .aggregate<{ _id: string; count: number }>([
          {
            $match: {
              detectedAt: {
                $gte: todayStart,
                $lt: todayEnd,
              },
            },
          },
          {
            $group: {
              _id: '$companyId',
              count: { $sum: 1 },
            },
          },
        ])
        .exec(),
      this.changeModel
        .aggregate<{ _id: string; count: number }>([
          {
            $group: {
              _id: '$companyId',
              count: { $sum: 1 },
            },
          },
        ])
        .exec(),
    ]);

    // Convert aggregation results into constant-time lookups while formatting each company.
    const countByCompany = new Map<string, number>();
    for (const item of dailyCounts) {
      countByCompany.set(String(item._id), item.count);
    }
    const totalByCompany = new Map<string, number>();
    for (const item of totalCounts) {
      totalByCompany.set(String(item._id), item.count);
    }

    return {
      total: companies.length,
      companies: companies.map((company) => ({
        id: String(company._id),
        slug: company.slug,
        name: company.name,
        category: company.category,
        policyUrl: company.policyUrl,
        isActive: company.isActive,
        lastCheckedAt: company.lastCheckedAt ?? null,
        lastChangedAt: company.lastChangedAt ?? null,
        lastFetchStatus: company.lastFetchStatus,
        todayChangeCount: countByCompany.get(String(company._id)) ?? 0,
        changeCount: totalByCompany.get(String(company._id)) ?? 0,
      })),
    };
  }

  /** Returns a company's changes for the selected UTC date, with both policy versions attached. */
  async getCompanyChanges(
    slug: string,
    date?: string,
  ): Promise<{
    company: {
      id: string;
      slug: string;
      name: string;
      category: string;
      policyUrl: string;
    };
    date: string;
    changes: Array<{
      id: string;
      detectedAt: string;
      summary: string;
      whatItMeansForYou: string;
      importance: string;
      tags: string[];
      changedSections: string[];
      aiStatus: 'ok' | 'fallback';
      isSample: boolean;
      fromVersionText: string;
      toVersionText: string;
    }>;
  }> {
    const company = await this.companyModel
      .findOne({ slug, isActive: true })
      .lean()
      .exec();

    if (!company) {
      throw new NotFoundException(`Company '${slug}' was not found`);
    }

    // Interpret an explicit date as UTC; otherwise use the current date.
    const targetDate = date ? new Date(`${date}T00:00:00.000Z`) : new Date();
    if (Number.isNaN(targetDate.getTime())) {
      throw new BadRequestException('Date must be in YYYY-MM-DD format');
    }

    const start = this.getUtcDayStart(targetDate);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    // Query only this company's changes within the requested UTC day.
    const changes = await this.changeModel
      .find({
        companyId: company._id,
        detectedAt: {
          $gte: start,
          $lt: end,
        },
      })
      .sort({ detectedAt: -1 })
      .lean()
      .exec();

    // Load all referenced versions in one query instead of querying once per change.
    const versionIds = new Set<string>();
    for (const change of changes) {
      versionIds.add(String(change.fromVersionId));
      versionIds.add(String(change.toVersionId));
    }

    const versions = await this.policyVersionModel
      .find(
        { _id: { $in: [...versionIds].map((id) => id) } },
        { _id: 1, text: 1 },
      )
      .lean()
      .exec();

    // Pair version text with each change when constructing the API response.
    const versionTextMap = new Map<string, string>();
    for (const version of versions) {
      versionTextMap.set(String(version._id), version.text ?? '');
    }

    return {
      company: {
        id: String(company._id),
        slug: company.slug,
        name: company.name,
        category: company.category,
        policyUrl: company.policyUrl,
      },
      date: this.formatUtcDate(start),
      changes: changes.map((change) => ({
        id: String(change._id),
        detectedAt: new Date(change.detectedAt).toISOString(),
        summary: change.summary,
        whatItMeansForYou: change.whatItMeansForYou,
        importance: change.importance,
        tags: change.tags ?? [],
        changedSections: change.changedSections ?? [],
        aiStatus: change.aiStatus,
        isSample: change.isSample,
        fromVersionText: versionTextMap.get(String(change.fromVersionId)) ?? '',
        toVersionText: versionTextMap.get(String(change.toVersionId)) ?? '',
      })),
    };
  }

  /** Returns stored versions and changes for one company without policy bodies. */
  async getCompanyTimeline(slug: string) {
    const company = await this.findActiveCompany(slug);
    const [versions, changes] = await Promise.all([
      this.policyVersionModel
        .aggregate<{
          _id: Types.ObjectId;
          fetchedAt: Date;
          isSample: boolean;
          textLength: number;
        }>([
          { $match: { companyId: company._id } },
          {
            $project: {
              fetchedAt: 1,
              isSample: 1,
              textLength: { $strLenCP: '$text' },
            },
          },
          { $sort: { fetchedAt: -1 } },
        ])
        .exec(),
      this.changeModel
        .find({ companyId: company._id })
        .sort({ detectedAt: -1 })
        .lean()
        .exec(),
    ]);

    return {
      company: this.toCompanyHeader(company),
      versions: versions.map((version) => ({
        id: String(version._id),
        fetchedAt: new Date(version.fetchedAt).toISOString(),
        isSample: version.isSample,
        textLength: version.textLength ?? 0,
      })),
      changes: changes.map((change) => ({
        id: String(change._id),
        detectedAt: new Date(change.detectedAt).toISOString(),
        summary: change.summary,
        whatItMeansForYou: change.whatItMeansForYou,
        importance: change.importance,
        tags: change.tags ?? [],
        changedSections: change.changedSections ?? [],
        aiStatus: change.aiStatus,
        isSample: change.isSample,
        fromVersionId: String(change.fromVersionId),
        toVersionId: String(change.toVersionId),
      })),
    };
  }

  /** Returns one change with capped diff excerpts for the report page. */
  async getCompanyChange(slug: string, changeId: string) {
    const company = await this.findActiveCompany(slug);
    if (!Types.ObjectId.isValid(changeId)) {
      throw new NotFoundException(`Change '${changeId}' was not found`);
    }

    const change = await this.changeModel
      .findOne({ _id: changeId, companyId: company._id })
      .lean()
      .exec();
    if (!change) {
      throw new NotFoundException(`Change '${changeId}' was not found`);
    }

    const versions = await this.policyVersionModel
      .find(
        { _id: { $in: [change.fromVersionId, change.toVersionId] } },
        { _id: 1, text: 1 },
      )
      .lean()
      .exec();
    const versionText = new Map(
      versions.map((version) => [String(version._id), version.text ?? '']),
    );
    const excerpts = buildPolicyExcerpts(
      versionText.get(String(change.fromVersionId)) ?? '',
      versionText.get(String(change.toVersionId)) ?? '',
    );

    return {
      company: this.toCompanyHeader(company),
      change: {
        id: String(change._id),
        detectedAt: new Date(change.detectedAt).toISOString(),
        summary: change.summary,
        whatItMeansForYou: change.whatItMeansForYou,
        importance: change.importance,
        tags: change.tags ?? [],
        changedSections: change.changedSections ?? [],
        aiStatus: change.aiStatus,
        isSample: change.isSample,
        fromVersionId: String(change.fromVersionId),
        toVersionId: String(change.toVersionId),
        ...excerpts,
      },
    };
  }

  /** Returns the newest changes across companies for the tracker feed. */
  async listRecentChanges(limit = 10) {
    const safeLimit = Math.min(25, Math.max(1, Math.trunc(limit) || 10));
    const changes = await this.changeModel
      .find()
      .sort({ detectedAt: -1 })
      .limit(safeLimit)
      .lean()
      .exec();
    const companyIds = [...new Set(changes.map((change) => String(change.companyId)))];
    const companies = await this.companyModel
      .find({ _id: { $in: companyIds } }, { _id: 1, slug: 1, name: 1 })
      .lean()
      .exec();
    const companyById = new Map(
      companies.map((company) => [String(company._id), company]),
    );

    return {
      changes: changes.map((change) => {
        const company = companyById.get(String(change.companyId));
        return {
          id: String(change._id),
          companySlug: company?.slug ?? '',
          companyName: company?.name ?? '',
          detectedAt: new Date(change.detectedAt).toISOString(),
          summary: change.summary,
          importance: change.importance,
          isSample: change.isSample,
          aiStatus: change.aiStatus,
        };
      }),
    };
  }

  /** Loads an active company, including the demo company when requested by slug. */
  private async findActiveCompany(slug: string) {
    const company = await this.companyModel
      .findOne({ slug, isActive: true })
      .lean()
      .exec();
    if (!company) {
      throw new NotFoundException(`Company '${slug}' was not found`);
    }
    return company;
  }

  /** Shared company header for timeline and change detail responses. */
  private toCompanyHeader(company: {
    _id: unknown;
    slug: string;
    name: string;
    category: string;
    policyUrl: string;
  }) {
    return {
      id: String(company._id),
      slug: company.slug,
      name: company.name,
      category: company.category,
      policyUrl: company.policyUrl,
    };
  }

  /** Creates a UTC midnight boundary, independent of the server's local timezone. */
  private getUtcDayStart(date: Date): Date {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
  }

  /** Formats a UTC date as YYYY-MM-DD for API responses. */
  private formatUtcDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
