import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { FETCH_STATUSES, FetchStatus } from '../utils/constant.js';

export type CompanyDocument = HydratedDocument<Company>;

@Schema({ timestamps: true })
export class Company {
  @Prop({ required: true, trim: true })
  name: string;

  // unique: true creates the unique index on slug
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ required: true, trim: true })
  category: string;

  @Prop({ required: true, trim: true })
  policyUrl: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  lastCheckedAt: Date | null;

  @Prop({ type: String, default: null })
  checkLockId: string | null;

  @Prop({ type: Date, default: null })
  checkLockUntil: Date | null;

  @Prop({ type: Date, default: null })
  lastChangedAt: Date | null;

  @Prop({ type: String, enum: FETCH_STATUSES, default: 'never' })
  lastFetchStatus: (typeof FETCH_STATUSES)[number];
}

export const CompanySchema = SchemaFactory.createForClass(Company);
