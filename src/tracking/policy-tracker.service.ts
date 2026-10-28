import { createHash, randomUUID } from 'node:crypto';
import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { load } from 'cheerio';
import { Model } from 'mongoose';
import { Change, ChangeDocument } from '../schema/change.schema.js';
import { Company, CompanyDocument } from '../schema/company.schema.js';
import {
  PolicyVersion,
  PolicyVersionDocument,
} from '../schema/policy-version.schema.js';
import {
  PolicyChangeAiService,
  type PolicyChangeAnalysis,
  POLICY_CHANGE_AI_TIMEOUT_MS,
} from './policy-change-ai.service.js';

const FETCH_TIMEOUT_MS = 20_000;
const MIN_POLICY_TEXT_LENGTH = 500;

export interface PolicyCheckResult {
  companySlug: string;
  status: 'baseline' | 'unchanged' | 'changed' | 'skipped';
  fetchedAt: string;
  skipReason?: 'already-checked-today' | 'already-in-progress';
  changeId?: string;
}

@Injectable()
export class PolicyTrackerService {
  private readonly logger = new Logger(PolicyTrackerService.name);

  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(PolicyVersion.name)
    private readonly policyVersionModel: Model<PolicyVersionDocument>,
    @InjectModel(Change.name)
    private readonly changeModel: Model<ChangeDocument>,
    private readonly policyChangeAiService: PolicyChangeAiService,
  ) {}

  /** Creates a sample-only diff from a synthetic prior copy of the live policy. */
  async simulateChange(
    slug: string,
  ): Promise<{
    companySlug: string;
    status: 'changed';
    isSample: true;
    aiStatus: 'ok' | 'fallback';
    changeId: string;
    summary: string;
    whatItMeansForYou: string;
    importance: string;
    tags: string[];
    changedSections: string[];
  }> {
    const company = await this.companyModel
      .findOne({ slug, isActive: true })
      .exec();
    if (!company) {
      throw new NotFoundException(`Company '${slug}' was not found`);
    }

    this.logger.warn(
      `${company.slug}: starting a sample-only change simulation using the live policy URL`,
    );
    let currentText: string;
    try {
      currentText = await this.fetchPolicyText(company.policyUrl);
    } catch (error) {
      this.logger.error(
        `${company.slug}: simulation could not fetch the live policy: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        `Could not fetch the live policy for '${company.slug}'`,
        { cause: error },
      );
    }
    const simulatedPreviousText =
      this.createSimulatedPreviousText(currentText);
    const previousHash = createHash('sha256')
      .update(simulatedPreviousText)
      .digest('hex');
    const currentHash = createHash('sha256').update(currentText).digest('hex');

    let analysis: PolicyChangeAnalysis | undefined;
    try {
      analysis = await this.policyChangeAiService.analyzeChange(
        simulatedPreviousText,
        currentText,
      );
    } catch (error) {
      this.logger.warn(
        `AI analysis unavailable for ${company.slug} simulation: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const detectedAt = new Date();
    const [fromVersion, toVersion] = await Promise.all([
      this.policyVersionModel.create({
        companyId: company._id,
        fetchedAt: detectedAt,
        text: simulatedPreviousText,
        contentHash: previousHash,
        isSample: true,
      }),
      this.policyVersionModel.create({
        companyId: company._id,
        fetchedAt: detectedAt,
        text: currentText,
        contentHash: currentHash,
        isSample: true,
      }),
    ]);

    const change = await this.changeModel.create({
      companyId: company._id,
      fromVersionId: fromVersion._id,
      toVersionId: toVersion._id,
      detectedAt,
      summary:
        analysis?.summary ??
        'Policy text changed. Review the previous and current versions.',
      whatItMeansForYou:
        analysis?.whatItMeansForYou ??
        'The captured policy text differs from the previous version. The impact has not been assessed.',
      importance: analysis?.importance ?? 'medium',
      tags: analysis?.tags ?? ['other'],
      changedSections: analysis?.changedSections ?? [],
      aiStatus: analysis ? 'ok' : 'fallback',
      isSample: true,
    });

    this.logger.warn(
      `${company.slug}: sample change simulation saved as ${String(change._id)}; real policy check state was not modified`,
    );
    return {
      companySlug: company.slug,
      status: 'changed',
      isSample: true,
      aiStatus: change.aiStatus,
      changeId: String(change._id),
      summary: change.summary,
      whatItMeansForYou: change.whatItMeansForYou,
      importance: change.importance,
      tags: change.tags,
      changedSections: change.changedSections,
    };
  }

  /** Adds realistic prior-policy clauses so the live policy produces a substantive demo diff. */
  private createSimulatedPreviousText(currentText: string): string {
    return this.normalizeText(
      `${currentText}\n\nAdvertising and analytics\nWe may share device identifiers and information about your activity with analytics and advertising partners to measure the effectiveness of campaigns and show you relevant ads. These partners may combine this information with information collected from other services.\n\nRetention of activity information\nWe retain activity and device information for up to 24 months, after which we delete or de-identify it unless retention is required by law.`,
    );
  }

  /** Fetches one company's policy and stores a version only when its normalized content changes. */
  async checkCompany(slug: string): Promise<PolicyCheckResult> {
    const fetchedAt = new Date();
    // Use UTC so the daily limit behaves the same regardless of where the API is hosted.
    const utcDayStart = new Date(
      Date.UTC(
        fetchedAt.getUTCFullYear(),
        fetchedAt.getUTCMonth(),
        fetchedAt.getUTCDate(),
      ),
    );
    const lockId = randomUUID();
    // Claim the company's check atomically: only one request can fetch it, and successful
    // checks are limited to once per UTC day. The lock expires if the process crashes.
    const company = await this.companyModel
      .findOneAndUpdate(
        {
          slug,
          isActive: true,
          $and: [
            {
              $or: [
                { lastCheckedAt: null },
                { lastCheckedAt: { $lt: utcDayStart } },
              ],
            },
            {
              $or: [
                { checkLockUntil: null },
                { checkLockUntil: { $lte: fetchedAt } },
              ],
            },
          ],
        },
        {
          $set: {
            checkLockId: lockId,
            checkLockUntil: new Date(
              fetchedAt.getTime() +
                FETCH_TIMEOUT_MS +
                POLICY_CHANGE_AI_TIMEOUT_MS +
                30_000,
            ),
          },
        },
        { new: true },
      )
      .exec();

    if (!company) {
      // A failed lock claim means either the slug is invalid, the company was checked today,
      // or another request currently owns its lock.
      const existingCompany = await this.companyModel
        .findOne({ slug, isActive: true })
        .exec();
      if (!existingCompany) {
        throw new NotFoundException(`Company '${slug}' was not found`);
      }

      const alreadyCheckedToday =
        existingCompany.lastCheckedAt instanceof Date &&
        existingCompany.lastCheckedAt >= utcDayStart;
      const skipReason = alreadyCheckedToday
        ? 'already-checked-today'
        : 'already-in-progress';
      this.logger.log(`${slug}: check skipped (${skipReason})`);
      return {
        companySlug: slug,
        status: 'skipped',
        fetchedAt: fetchedAt.toISOString(),
        skipReason,
      };
    }

    try {
      // Fetch and normalize the page before hashing, so irrelevant whitespace does not
      // create a new version. Only the hash is needed to decide whether content changed.
      this.logger.log(
        `Checking ${company.slug} policy at ${company.policyUrl}`,
      );
      const text = await this.fetchPolicyText(company.policyUrl);
      const contentHash = createHash('sha256').update(text).digest('hex');
      // Compare only against real fetched versions; demo/sample versions are not a baseline.
      const latestVersion = await this.policyVersionModel
        .findOne({ companyId: company._id, isSample: { $ne: true } })
        .sort({ fetchedAt: -1 })
        .exec();

      if (!latestVersion) {
        this.logger.log(
          `${company.slug}: no real version exists yet; creating baseline (hash ${contentHash.slice(0, 12)}, ${text.length} characters)`,
        );
        // With nothing real to compare against, save a baseline but do not report a change.
        await this.policyVersionModel.create({
          companyId: company._id,
          fetchedAt,
          text,
          contentHash,
          isSample: false,
        });
        await this.finishCheck(company._id, lockId, fetchedAt, false);
        this.logger.log(
          `${company.slug}: saved first policy version (${text.length} characters)`,
        );
        return {
          companySlug: company.slug,
          status: 'baseline',
          fetchedAt: fetchedAt.toISOString(),
        };
      }

      this.logger.log(
        `${company.slug}: comparing current version (${contentHash.slice(0, 12)}, ${text.length} characters) with stored version (${latestVersion.contentHash.slice(0, 12)}, ${latestVersion.text.length} characters)`,
      );
      if (latestVersion.contentHash === contentHash) {
        // An identical hash means the policy is unchanged; mark today's check complete
        // without saving another copy of the same text.
        await this.finishCheck(company._id, lockId, fetchedAt, false);
        this.logger.log(
          `${company.slug}: policy is unchanged (${text.length} characters)`,
        );
        return {
          companySlug: company.slug,
          status: 'unchanged',
          fetchedAt: fetchedAt.toISOString(),
        };
      }

      this.logger.warn(
        `${company.slug}: policy hash differs; saving a new version and requesting AI analysis`,
      );
      const nextVersion = await this.policyVersionModel.create({
        companyId: company._id,
        fetchedAt,
        text,
        contentHash,
        isSample: false,
      });

      // AI is only called for a real content change. Its failure must not discard
      // either saved version, so the change record always gets a clear fallback.
      let analysis: PolicyChangeAnalysis | undefined;
      try {
        analysis = await this.policyChangeAiService.analyzeChange(
          latestVersion.text,
          text,
        );
      } catch (error) {
        this.logger.warn(
          `AI analysis unavailable for ${company.slug}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Link both versions and store the AI explanation, or the explicit fallback if
      // analysis was unavailable.
      const change = await this.changeModel.findOneAndUpdate(
        {
          companyId: company._id,
          fromVersionId: latestVersion._id,
          toVersionId: nextVersion._id,
        },
        {
          $setOnInsert: {
            companyId: company._id,
            fromVersionId: latestVersion._id,
            toVersionId: nextVersion._id,
            detectedAt: fetchedAt,
            summary:
              analysis?.summary ??
              'Policy text changed. Review the previous and current versions.',
            whatItMeansForYou:
              analysis?.whatItMeansForYou ??
              'The captured policy text differs from the previous version. The impact has not been assessed.',
            importance: analysis?.importance ?? 'medium',
            tags: analysis?.tags ?? ['other'],
            changedSections: analysis?.changedSections ?? [],
            aiStatus: analysis ? 'ok' : 'fallback',
            isSample: false,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      // Mark the company changed and release the lock only after both records are saved.
      await this.finishCheck(company._id, lockId, fetchedAt, true);

      this.logger.log(
        `${company.slug}: policy changed; saved version and change ${String(change._id)}`,
      );
      return {
        companySlug: company.slug,
        status: 'changed',
        fetchedAt: fetchedAt.toISOString(),
        changeId: String(change._id),
      };
    } catch (error) {
      // A failed attempt must not count as today's successful check, so release its lock
      // without updating lastCheckedAt; the next run can retry it.
      await this.companyModel.updateOne(
        { _id: company._id, checkLockId: lockId },
        {
          $set: { lastFetchStatus: 'failed' },
          $unset: { checkLockId: 1, checkLockUntil: 1 },
        },
      );
      this.logger.error(
        `Policy check failed for ${company.slug}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new ServiceUnavailableException(
        `Could not check the policy for '${company.slug}'`,
        { cause: error },
      );
    }
  }

  /** Marks a completed fetch and releases its lock only if this request still owns it. */
  private async finishCheck(
    companyId: CompanyDocument['_id'],
    lockId: string,
    fetchedAt: Date,
    changed: boolean,
  ): Promise<void> {
    const update = await this.companyModel
      .updateOne(
        { _id: companyId, checkLockId: lockId },
        {
          $set: {
            lastCheckedAt: fetchedAt,
            lastFetchStatus: 'ok',
            ...(changed ? { lastChangedAt: fetchedAt } : {}),
          },
          $unset: { checkLockId: 1, checkLockUntil: 1 },
        },
      )
      .exec();

    if (update.modifiedCount !== 1) {
      throw new Error('Policy check lock was lost before completion');
    }
  }

  /** Downloads a policy page, extracts readable text, and rejects empty or unrelated responses. */
  private async fetchPolicyText(url: string): Promise<string> {
    const startedAt = Date.now();
    const response = await fetch(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
        'user-agent': 'PolicyHawk/0.1 (privacy policy change tracker)',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    this.logger.log(
      `Policy response ${response.status} ${response.statusText} from ${response.url} (${Date.now() - startedAt} ms)`,
    );

    // Treat redirects as successful only when the final response itself is successful.
    if (!response.ok) {
      throw new Error(`Policy source returned HTTP ${response.status}`);
    }

    // Refuse binary or unexpected responses rather than storing unusable policy versions.
    const contentType = response.headers.get('content-type') ?? '';
    if (
      !/(text\/html|application\/xhtml\+xml|text\/plain)/i.test(contentType)
    ) {
      throw new Error(
        `Policy source returned unsupported content type: ${contentType}`,
      );
    }

    const html = await response.text();
    const text = this.extractPolicyText(html, contentType);
    this.logger.log(
      `Extracted ${text.length} policy characters from ${Buffer.byteLength(html)} response bytes`,
    );
    // A minimum length and policy-related terms help avoid treating bot-block pages as policies.
    if (
      text.length < MIN_POLICY_TEXT_LENGTH ||
      !/(privacy|personal data|personal information|we collect|information we collect)/i.test(
        text,
      )
    ) {
      throw new Error(
        'Fetched page does not contain enough readable policy text',
      );
    }
    return text;
  }

  /** Extracts the main readable content, removing common navigation and consent noise first. */
  private extractPolicyText(html: string, contentType: string): string {
    if (contentType.toLowerCase().includes('text/plain')) {
      return this.normalizeText(html);
    }

    const $ = load(html);
    // Remove page chrome and cookie/consent containers that tend to change independently.
    $('script, style, noscript, svg, nav, footer, header, iframe').remove();
    $(
      '[aria-label*="cookie" i], [id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i]',
    ).remove();

    // Prefer the largest semantic content region; fall back to the body for nonstandard pages.
    const mainText = $('main, article, [role="main"]')
      .toArray()
      .map((element) => $(element).text())
      .sort((left, right) => right.length - left.length)[0];

    return this.normalizeText(mainText || $('body').text());
  }

  /** Collapses whitespace consistently before hashing and comparing fetched policy text. */
  private normalizeText(text: string): string {
    return text
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\s*\n\s*/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
