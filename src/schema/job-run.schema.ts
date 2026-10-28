import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  JOB_STATUSES,
  JOB_TRIGGERS,
  JobStatus,
  JobTrigger,
} from '../utils/constant.js';

export type JobRunDocument = HydratedDocument<JobRun>;

@Schema({ timestamps: true, collection: 'job_runs' })
export class JobRun {
  @Prop({ type: Date, required: true })
  startedAt: Date;

  @Prop({ type: Date, default: null })
  finishedAt: Date | null;

  @Prop({ type: String, enum: JOB_TRIGGERS, required: true })
  trigger: (typeof JOB_TRIGGERS)[number];

  @Prop({ type: String, enum: JOB_STATUSES, default: 'running' })
  status: (typeof JOB_STATUSES)[number];

  @Prop({ default: 0 })
  companiesChecked: number;

  @Prop({ default: 0 })
  companiesSkipped: number;

  @Prop({ default: 0 })
  newVersions: number;

  @Prop({ default: 0 })
  changesFound: number;

  @Prop({
    type: [{ _id: false, companySlug: String, message: String }],
    default: [],
  })
  companyErrors: { companySlug: string; message: string }[];
}

export const JobRunSchema = SchemaFactory.createForClass(JobRun);

JobRunSchema.index({ startedAt: -1 });
