import mongoose, { Schema, Document } from "mongoose";

export interface IManagerProfile extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  id: string;
}

const managerProfileSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
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

export const ManagerProfile = mongoose.model<IManagerProfile>("ManagerProfile", managerProfileSchema);
