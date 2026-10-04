import mongoose, { Schema, Document } from "mongoose";

export interface IMemberProfile extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  fitnessGoal?: string | null;
  trainingLevel?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
  trainingPreference?: string | null;
  createdAt: Date;
  updatedAt: Date;
  id: string;
}

const memberProfileSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    fitnessGoal: { type: String, default: null },
    trainingLevel: { type: String, enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED"], default: null },
    trainingPreference: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc: any, ret: any) {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;
      },
    },
    toObject: {
      virtuals: true,
      transform(_doc: any, ret: any) {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

export const MemberProfile = mongoose.model<IMemberProfile>("MemberProfile", memberProfileSchema);
