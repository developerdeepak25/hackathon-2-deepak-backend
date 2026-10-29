// Shared values keep database validation and AI response validation consistent.

export const IMPORTANCE_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type Importance = (typeof IMPORTANCE_LEVELS)[number];

export const CHANGE_TAGS = [
  'ai-training',
  'data-sharing',
  'data-selling',
  'retention',
  'deletion',
  'other',
] as const;
export type ChangeTag = (typeof CHANGE_TAGS)[number];

export const FETCH_STATUSES = ['ok', 'failed', 'never'] as const;
export type FetchStatus = (typeof FETCH_STATUSES)[number];

export const AI_STATUSES = ['ok', 'fallback'] as const;
export type AiStatus = (typeof AI_STATUSES)[number];

export const JOB_STATUSES = [
  'running',
  'success',
  'partial',
  'failed',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_TRIGGERS = ['cron', 'github-action', 'manual'] as const;
export type JobTrigger = (typeof JOB_TRIGGERS)[number];

/** Route slug for the unsaved WhatsApp simulation. It is not a company in the database. */
export const TEST_COMPANY_SLUG = 'test-company';
