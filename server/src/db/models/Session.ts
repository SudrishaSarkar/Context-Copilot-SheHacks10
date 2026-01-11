import mongoose, { Schema, Document } from "mongoose";

export interface ISession extends Document {
  userId: string;
  email?: string;
  createdAt: Date;
  lastActive: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    email: { type: String, sparse: true },
    createdAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now },
  },
  { collection: "sessions" }
);

export const Session = mongoose.model<ISession>("Session", SessionSchema);
