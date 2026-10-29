import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  password: string;
  fullName: string;
  phone?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  dateOfBirth?: Date | null;
  avatarUrl?: string | null;
  role: "ADMIN" | "MANAGER" | "COACH" | "RECEPTIONIST" | "MEMBER";
  isActive: boolean;
  tokenVersion: number;
  provisioningLeaseToken?: string | null;
  provisioningLeaseUntil?: Date | null;
  provisioningStatus: "READY" | "PENDING" | "FAILED";
  resetPasswordOtp?: string | null;
  resetPasswordOtpExpiresAt?: Date | null;
  /** AUD-09: access token phát hành trước mốc này bị từ chối (đổi/đặt lại mật khẩu). */
  passwordChangedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  id: string;
}

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    fullName: { type: String, required: true, trim: true },
    // Sparse unique indexes still index explicit null. Omit an absent phone so
    // multiple accounts without a phone number can register successfully.
    phone: { type: String, default: undefined, unique: true, sparse: true, set: (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined },
    gender: { type: String, enum: ["MALE", "FEMALE", "OTHER"], default: null },
    dateOfBirth: { type: Date, default: null },
    avatarUrl: { type: String, default: null },
    role: { type: String, enum: ["ADMIN", "MANAGER", "COACH", "RECEPTIONIST", "MEMBER"], default: "MEMBER" },
    isActive: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    provisioningLeaseToken: { type: String, default: null, select: false },
    provisioningLeaseUntil: { type: Date, default: null },
    provisioningStatus: { type: String, enum: ["READY", "PENDING", "FAILED"], default: "READY" },
    resetPasswordOtp: { type: String, default: null },
    resetPasswordOtpExpiresAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc: any, ret: any) {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.provisioningLeaseToken;
        delete ret.provisioningLeaseUntil;
        delete ret.password;
      },
    },
    toObject: {
      virtuals: true,
      transform(_doc: any, ret: any) {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.provisioningLeaseToken;
        delete ret.provisioningLeaseUntil;
      },
    },
  }
);

export const User = mongoose.model<IUser>("User", userSchema);
