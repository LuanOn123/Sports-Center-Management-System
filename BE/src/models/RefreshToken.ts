import mongoose, { Schema, Document } from "mongoose";

export interface IRefreshToken extends Document {
  _id: mongoose.Types.ObjectId;
  token: string;
  userId: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  createdAt: Date;
  id: string;
}

const refreshTokenSchema = new Schema(
  {
    token: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      virtuals: true,
      transform(_doc: any, ret: any) {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

export const RefreshToken = mongoose.model<IRefreshToken>("RefreshToken", refreshTokenSchema);
