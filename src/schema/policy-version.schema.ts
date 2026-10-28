import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PolicyVersionDocument = HydratedDocument<PolicyVersion>;

@Schema({ timestamps: true, collection: 'policy_versions' })
export class PolicyVersion {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  companyId: Types.ObjectId;

  // Sample data uses backdated values here
  @Prop({ type: Date, required: true })
  fetchedAt: Date;

  // Normalized policy text. Exclude from list endpoints (can be 50-150 KB).
  @Prop({ required: true })
  text: string;

  // SHA-256 of `text`
  @Prop({ required: true })
  contentHash: string;

  @Prop({ default: false })
  isSample: boolean;
}

export const PolicyVersionSchema = SchemaFactory.createForClass(PolicyVersion);

PolicyVersionSchema.index({ companyId: 1, fetchedAt: -1 });
PolicyVersionSchema.index({ companyId: 1, contentHash: 1 });