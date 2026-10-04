import mongoose, { Schema, Document } from "mongoose";

export interface ICoachProfile extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  specialization?: string | null;
  experienceYears?: number | null;
  bio?: string | null;
  createdAt: Date;
  updatedAt: Date;
  id: string;
}

const coachProfileSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    specialization: { type: String, default: null },
    experienceYears: { type: Number, default: null },
    bio: { type: String, default: null },
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

export const CoachProfile = mongoose.model<ICoachProfile>("CoachProfile", coachProfileSchema);
