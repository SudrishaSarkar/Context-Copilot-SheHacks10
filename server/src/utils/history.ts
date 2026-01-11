import mongoose from "mongoose";
import type { PagePayload } from "../types.js";
import { Session } from "../db/models/Session.js";
import { ChatHistory } from "../db/models/ChatHistory.js";
import { Page } from "../db/models/Page.js";

/**
 * Get or create a user session
 */
export async function getOrCreateSession(
  userId: string,
  email?: string
): Promise<mongoose.Types.ObjectId> {
  let session = await Session.findOne({ userId });

  if (!session) {
    session = await Session.create({
      userId,
      email,
      createdAt: new Date(),
      lastActive: new Date(),
    });
  } else {
    session.lastActive = new Date();
    await session.save();
  }

  return session._id;
}

/**
 * Update or create page record
 */
export async function updatePageRecord(
  url: string,
  title: string
): Promise<void> {
  await Page.findOneAndUpdate(
    { url },
    {
      $set: { title, lastSeen: new Date() },
      $inc: { interactionCount: 1 },
      $setOnInsert: { firstSeen: new Date() },
    },
    { upsert: true }
  );
}

/**
 * Save chat history to database
 */
export async function saveChatHistory(params: {
  userId: string;
  sessionId: mongoose.Types.ObjectId;
  requestType: "ask" | "summarize" | "key-points" | "explain-like-5" | "action-items";
  page: PagePayload;
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
  modelUsed?: string;
  success?: boolean;
}): Promise<mongoose.Types.ObjectId> {
  const history = await ChatHistory.create({
    sessionId: params.sessionId,
    userId: params.userId,
    timestamp: new Date(),
    requestType: params.requestType,
    pageUrl: params.page.url,
    pageTitle: params.page.title,
    contentType: params.page.contentType,
    input: params.input,
    output: params.output,
    responseTime: params.responseTime,
    modelUsed: params.modelUsed || "gemini-2.5-flash",
    success: params.success ?? true,
  });

  // Update page record
  await updatePageRecord(params.page.url, params.page.title);

  return history._id;
}
