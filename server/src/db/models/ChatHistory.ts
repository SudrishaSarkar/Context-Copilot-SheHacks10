import mongoose, { Schema, Document } from "mongoose";

export interface IChatHistory extends Document {
  sessionId: mongoose.Types.ObjectId;
  userId: string;
  timestamp: Date;
  requestType: "ask" | "summarize" | "key-points" | "explain-like-5" | "action-items";
  pageUrl: string;
  pageTitle: string;
  contentType: "html" | "pdf_text" | "pdf_image";
  input: {
    question?: string;
    detailLevel?: "brief" | "detailed";
    selectedText?: string;
    mainTextPreview?: string;
  };
  output: {
    answer?: string;
    summary?: string;
    keyPoints?: string;
    explanation?: string;
    actionItems?: string;
    citations?: Array<{
      quote: string;
      sectionHint?: string;
      confidence?: number;
    }>;
  };
  responseTime: number;
  modelUsed: string;
  success: boolean;
}

const ChatHistorySchema = new Schema<IChatHistory>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "Session", index: true },
    userId: { type: String, required: true, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    requestType: {
      type: String,
      enum: ["ask", "summarize", "key-points", "explain-like-5", "action-items"],
      required: true,
      index: true,
    },
    pageUrl: { type: String, required: true },
    pageTitle: { type: String, required: true },
    contentType: {
      type: String,
      enum: ["html", "pdf_text", "pdf_image"],
      required: true,
    },
    input: {
      question: String,
      detailLevel: String,
      selectedText: String,
      mainTextPreview: String,
    },
    output: {
      answer: String,
      summary: String,
      keyPoints: String,
      explanation: String,
      actionItems: String,
      citations: [
        {
          quote: String,
          sectionHint: String,
          confidence: Number,
        },
      ],
    },
    responseTime: { type: Number, required: true },
    modelUsed: { type: String, default: "gemini-2.5-flash" },
    success: { type: Boolean, default: true },
  },
  { collection: "chat_history" }
);

// Indexes for faster queries - optimized for dashboard queries
ChatHistorySchema.index({ userId: 1, timestamp: -1 }); // Main query: get user's history sorted by time
ChatHistorySchema.index({ userId: 1, requestType: 1, timestamp: -1 }); // Filtered queries by type
ChatHistorySchema.index({ userId: 1, pageTitle: "text", pageUrl: "text" }); // Text search optimization
ChatHistorySchema.index({ timestamp: -1 }); // Global timestamp index for sorting

export const ChatHistory = mongoose.model<IChatHistory>(
  "ChatHistory",
  ChatHistorySchema
);
