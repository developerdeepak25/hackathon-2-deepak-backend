import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  AI_STATUSES,
  AiStatus,
  CHANGE_TAGS,
  ChangeTag,
  IMPORTANCE_LEVELS,
  Importance,
} from '../utils/constant.js';

export type ChangeDocument = HydratedDocument<Change>;

@Schema({ timestamps: true, collection: 'changes' })
export class Change {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'PolicyVersion', required: true })
  fromVersionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'PolicyVersion', required: true })
  toVersionId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  detectedAt: Date;

  @Prop({ required: true })
  summary: string;

  @Prop({ required: true })
  whatItMeansForYou: string;

  @Prop({ type: String, enum: IMPORTANCE_LEVELS, required: true })
  importance: (typeof IMPORTANCE_LEVELS)[number];

  @Prop({ type: [String], enum: CHANGE_TAGS, default: [] })
  tags: ChangeTag[];

  @Prop({ type: [String], default: [] })
  changedSections: string[];

  // 'fallback' = AI failed and we stored a "summary unavailable" record
  @Prop({ type: String, enum: AI_STATUSES, default: 'ok' })
  aiStatus: (typeof AI_STATUSES)[number];

  @Prop({ default: false })
  isSample: boolean;
}

export const ChangeSchema = SchemaFactory.createForClass(Change);

ChangeSchema.index({ companyId: 1, detectedAt: -1 });
ChangeSchema.index({ detectedAt: -1 });
// Reruns can never create a duplicate change for the same pair of versions
ChangeSchema.index({ fromVersionId: 1, toVersionId: 1 }, { unique: true });