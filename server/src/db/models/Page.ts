import mongoose, { Schema, Document } from "mongoose";

export interface IPage extends Document {
  url: string;
  title: string;
  firstSeen: Date;
  lastSeen: Date;
  interactionCount: number;
}

const PageSchema = new Schema<IPage>(
  {
    url: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    firstSeen: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
    interactionCount: { type: Number, default: 0 },
  },
  { collection: "pages" }
);

export const Page = mongoose.model<IPage>("Page", PageSchema);
