import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { dirname } from "path";
import multer from "multer";
import type {
  AskRequest,
  AskResponse,
  Citation,
  PagePayload,
  TranscribeResponse,
} from "./types.js";
// Feature handlers
import { handleSummarize } from "./features/summarize/handler.js";
import { handleKeyPoints } from "./features/key-points/handler.js";
import { handleExplainLike5 } from "./features/explain-like-5/handler.js";
import { handleActionItems } from "./features/action-items/handler.js";
// Schemas
import {
  SummarizeRequestSchema,
  KeyPointsRequestSchema,
  ExplainLike5RequestSchema,
  ActionItemsRequestSchema,
} from "./utils/schemas.js";
// Database
import { connectDB } from "./db/connection.js";
import { Session } from "./db/models/Session.js";
import { ChatHistory } from "./db/models/ChatHistory.js";
import { Page } from "./db/models/Page.js";
import mongoose from "mongoose";
// History utilities
import { getOrCreateSession, saveChatHistory } from "./utils/history.js";

// Ensure .env is loaded from the correct directory (try multiple paths)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const possiblePaths = [
  path.resolve(__dirname, "../.env"), // server/.env (relative to src)
  path.resolve(process.cwd(), ".env"), // server/.env (relative to cwd)
  path.resolve(__dirname, "../../.env"), // root/.env (fallback)
];

let loadedEnvPath: string | null = null;

for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    if (process.env.GEMINI_API_KEY) {
      loadedEnvPath = p;
      break;
    }
  }
}

const app = express();
// CORS configuration - allow dashboard (ports 3002, 3003, 3004) and extension
app.use(
  cors({
    origin: [
      "http://localhost:3002",
      "http://127.0.0.1:3002",
      "http://localhost:3003",
      "http://127.0.0.1:3003",
      "http://localhost:3004",
      "http://127.0.0.1:3004",
      /^chrome-extension:\/\/.*/,
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "50mb" })); // Increase limit for base64 images

// Configure Multer for memory storage (handling audio uploads)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
});

const PORT = 8787;

// Gemini model name - can be overridden with GEMINI_MODEL env var
// Current recommended model: gemini-2.5-flash
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

const AskRequestSchema = z.object({
  question: z.string(),
  page: z.object({
    url: z.string(),
    title: z.string(),
    contentType: z.enum(["html", "pdf_text", "pdf_image"]),
    selectedText: z.string().optional(),
    mainText: z.string(),
    structure: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          startChar: z.number().optional(),
          endChar: z.number().optional(),
          page: z.number().optional(),
        })
      )
      .optional(),
    meta: z
      .object({
        siteHint: z.enum(["github", "stackoverflow", "generic"]).optional(),
        timestamp: z.number().optional(),
      })
      .optional(),
    imageBase64: z.string().optional(),
  }),
});

// Legacy schema for old endpoints that use "format" instead of "detailLevel"
// (kept for backward compatibility with /summarize-and-export and /preview)
const LegacySummarizeRequestSchema = z.object({
  page: z.object({
    url: z.string(),
    title: z.string(),
    contentType: z.enum(["html", "pdf_text", "pdf_image"]),
    selectedText: z.string().optional(),
    mainText: z.string(),
    structure: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          startChar: z.number().optional(),
          endChar: z.number().optional(),
          page: z.number().optional(),
        })
      )
      .optional(),
    meta: z
      .object({
        siteHint: z.enum(["github", "stackoverflow", "generic"]).optional(),
        timestamp: z.number().optional(),
      })
      .optional(),
    imageBase64: z.string().optional(),
  }),
  format: z.enum(["summary", "bullet", "extract"]).default("summary"),
});

function chunkText(text: string, chunkSize: number = 1800): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

function scoreChunk(chunk: string, question: string): number {
  const questionWords = question.toLowerCase().split(/\s+/);
  const chunkLower = chunk.toLowerCase();
  let score = 0;
  for (const word of questionWords) {
    if (word.length > 2) {
      const matches = (chunkLower.match(new RegExp(word, "g")) || []).length;
      score += matches;
    }
  }
  return score;
}

function selectTopChunks(
  mainText: string,
  question: string,
  topN: number = 6
): string {
  const chunks = chunkText(mainText, 1800);
  const scored = chunks.map((chunk, idx) => ({
    chunk,
    score: scoreChunk(chunk, question),
    idx,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored
    .slice(0, topN)
    .map((s) => s.chunk)
    .join("\n\n---\n\n");
}

async function callGemini(
  context: string,
  question: string
): Promise<AskResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set in environment");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const prompt = `You are a helpful assistant that answers questions based on the provided text below.

PROVIDED TEXT:
${context}

QUESTION: ${question}

INSTRUCTIONS:
1. Answer the question using information from the provided text above.
2. Structure your answer clearly and logically.
3. For meta-questions about the content itself, you MUST calculate or estimate even if not explicitly stated. Examples include:
   - Reading time, word count, length estimates
   - Number of items (emails, messages, articles, tasks, etc.)
   - Time estimates (how long to read, reply, complete tasks, etc.)
   - Structural analysis (sections, topics, organization)
   - Summary and overview questions
4. For these meta-questions, use the content to:
   - Count items (emails, messages, etc.) if visible in the text
   - Estimate time based on standard rates (e.g., 200 words/min reading, 2-5 min per email reply)
   - Calculate quantities or provide reasonable estimates
5. For factual questions that require specific information from the text, only use what's actually in the provided content.
6. If a factual question cannot be answered from the provided text, respond with: "I cannot find the answer to this question in the provided content."
7. For each key piece of information in your answer, include a citation with a verbatim quote from the provided text when relevant.
8. Quotes MUST be exact substrings from the provided text - do not paraphrase or modify them.
9. For meta-questions (reading time, counts, time estimates, structure), you can provide estimates without citations if the information is calculated.
10. Structure your answer clearly:
    - Start with a direct answer to the question
    - Provide supporting details or context if needed
    - Break down complex answers into clear points
    - Use clear, concise language
    - Organize information logically

OUTPUT FORMAT: Return your response as a JSON object matching this exact structure:
{
  "answer": "Your structured answer here. Make it clear, well-organized, and easy to understand. Break down complex information into logical sections if needed.",
  "citations": [
    {
      "quote": "exact verbatim quote from provided text (if applicable)",
      "sectionHint": "optional section hint",
      "confidence": 0.95
    }
  ]
}

      Return ONLY the JSON object, no markdown formatting, no explanation, just the raw JSON.
      
      IMPORTANT: Do NOT use asterisks, bold, italics, or any markdown formatting in your answer text. Use plain text only.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Try to extract JSON from the response
    let jsonText = text.trim();
    // Remove markdown code blocks if present
    jsonText = jsonText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = JSON.parse(jsonText) as AskResponse;

    // Validate structure
    if (!parsed.answer || !Array.isArray(parsed.citations)) {
      throw new Error("Invalid response structure");
    }

    // Ensure all quotes exist in context (fuzzy check)
    const contextLower = context.toLowerCase();
    parsed.citations = parsed.citations.map((citation) => {
      const quoteLower = citation.quote.toLowerCase();
      if (!contextLower.includes(quoteLower)) {
        // Try to find a similar substring
        const first40 = citation.quote.substring(0, 40).toLowerCase();
        const idx = contextLower.indexOf(first40);
        if (idx !== -1) {
          // Try to extract the actual quote from context
          const start = Math.max(0, idx - 20);
          const end = Math.min(
            context.length,
            idx + citation.quote.length + 20
          );
          citation.quote = context.substring(start, end).trim();
        }
      }
      return citation;
    });

    return parsed;
  } catch (error: any) {
    console.error("Gemini API error:", error);

    // Provide more helpful error messages
    if (
      error?.status === 403 ||
      error?.message?.includes("leaked") ||
      error?.message?.includes("Forbidden")
    ) {
      return {
        answer:
          "API key error: Your Gemini API key has been reported as leaked or is invalid. Please get a new API key from https://makersuite.google.com/app/apikey and update your .env file.",
        citations: [],
      };
    }

    if (
      error?.status === 401 ||
      error?.message?.includes("API key") ||
      error?.message?.includes("Unauthorized")
    ) {
      return {
        answer:
          "API key error: Please check that your GEMINI_API_KEY is set correctly in the .env file.",
        citations: [],
      };
    }

    if (
      error?.message?.includes("quota") ||
      error?.message?.includes("rate limit")
    ) {
      return {
        answer:
          "API quota exceeded: You've reached the rate limit for the Gemini API. Please try again later.",
        citations: [],
      };
    }

    return {
      answer:
        "I encountered an error processing your question. Please try again. If the issue persists, check the server logs for details.",
      citations: [],
    };
  }
}

// Gemini Vision API for image-based PDFs
async function callGeminiVision(
  imageBase64: string,
  prompt: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set in environment");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  // Convert base64 to buffer
  const imageBuffer = Buffer.from(imageBase64, "base64");

  // Determine MIME type from base64 prefix
  let mimeType = "image/png";
  if (imageBase64.startsWith("/9j/") || imageBase64.startsWith("iVBORw0KGgo")) {
    mimeType = imageBase64.startsWith("/9j/") ? "image/jpeg" : "image/png";
  }

  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: mimeType,
    },
  };

  try {
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini Vision API error:", error);
    throw error;
  }
}

// ElevenLabs Speech-to-Text Integration
async function transcribeWithElevenLabs(
  audioBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY not set in environment");
  }

  const apiUrl = "https://api.elevenlabs.io/v1/speech-to-text";

  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType });

  // Determine extension based on mimeType
  let ext = "wav";
  if (mimeType.includes("webm")) ext = "webm";
  else if (mimeType.includes("mp4")) ext = "mp4";
  else if (mimeType.includes("mpeg") || mimeType.includes("mp3")) ext = "mp3";
  else if (mimeType.includes("m4a")) ext = "m4a";

  formData.append("file", blob, `audio.${ext}`);
  formData.append("model_id", "scribe_v1");

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `ElevenLabs STT API Error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data = (await response.json()) as { text: string };
  return data.text;
}

// System prompt for summarization/extraction
function getSummarizePrompt(
  contentType: "html" | "pdf_text" | "pdf_image",
  format: "summary" | "bullet" | "extract"
): string {
  const formatInstructions = {
    summary: `Create a concise summary with two parts:
1. Brief Summary (2-4 sentences): Provide a short paragraph covering the main topic, purpose, and most important points.
2. Key Takeaways: List 3-5 bullet points with the most critical information, important dates/numbers, action items, or essential details.`,

    bullet: `Extract the most important information as bullet points. Include:
- Main points (use • for main bullets)
- Sub-points (use - for sub-bullets)
- Key terms, dates, names, figures
- Action items or important notices
- Terms and conditions highlights (if applicable)`,

    extract: `Extract and organize the most critical information. Structure it as:
- Executive Summary (2-3 sentences)
- Key Points (numbered list)
- Important Details (organized by category)
- Action Items or Requirements (if any)
- Dates, Deadlines, or Timeframes (if any)`,
  };

  const basePrompt = `You are an expert document analysis assistant. Your task is to analyze the provided document and create a clear, concise output that makes complex information easy to understand.

DOCUMENT TYPE: ${
    contentType === "pdf_image"
      ? "Scanned/Image-based document"
      : contentType === "pdf_text"
      ? "Text-based PDF document"
      : "Web page"
  }

OUTPUT FORMAT: ${formatInstructions[format]}

INSTRUCTIONS:
1. Analyze the entire document thoroughly
2. Identify the most important information
3. Organize information logically and clearly
4. Use simple, clear language - avoid jargon unless necessary
5. Preserve critical details like dates, amounts, names, and deadlines
6. If this is a legal document (lease, contract, etc.), highlight important clauses, terms, and obligations
7. If this is a research paper, focus on the research question, methodology, findings, and conclusions
8. If this is a report, highlight key metrics, trends, and recommendations
9. Keep the output well-structured and easy to scan

OUTPUT REQUIREMENTS:
- Be accurate and faithful to the source material
- Prioritize the most actionable or important information
- Use clear headings if needed
- Make it readable and professional
- For summary format: Keep it VERY brief - the summary paragraph should be 2-4 sentences maximum, and Key Takeaways should be 3-5 bullet points
- For other formats: Keep output concise and focused on the most critical information`;

  return basePrompt;
}

async function summarizeWithGemini(
  page: PagePayload,
  format: "summary" | "bullet" | "extract"
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set in environment");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const systemPrompt = getSummarizePrompt(page.contentType, format);

  try {
    if (page.contentType === "pdf_image" && page.imageBase64) {
      // Use Vision API for image-based PDFs
      const prompt = `${systemPrompt}

Please analyze this document image and provide the requested output format.`;
      return await callGeminiVision(page.imageBase64, prompt);
    } else {
      // Use text API for text-based content
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

      // If selectedText exists, use it; otherwise use mainText (chunked if too long)
      let content = page.selectedText || page.mainText;

      // If content is too long, summarize in chunks
      if (content.length > 50000) {
        // Split into chunks and summarize each, then combine
        const chunks = chunkText(content, 40000);
        const chunkSummaries: string[] = [];

        for (const chunk of chunks) {
          const chunkPrompt = `${systemPrompt}

DOCUMENT CONTENT:
${chunk}

Provide the output in the requested format.`;
          const result = await model.generateContent(chunkPrompt);
          const response = await result.response;
          chunkSummaries.push(response.text());
        }

        // Final synthesis
        const finalPrompt = `You have been given summaries of different sections of a document. Combine them into a single, cohesive ${format} that maintains consistency and covers all important information.

SECTION SUMMARIES:
${chunkSummaries.join("\n\n---SECTION BREAK---\n\n")}

Create a unified, well-organized ${format} that integrates all the information above.`;
        const finalResult = await model.generateContent(finalPrompt);
        return finalResult.response.text();
      } else {
        const prompt = `${systemPrompt}

DOCUMENT CONTENT:
${content}

PROVIDED TEXT (if applicable):
${
  page.structure
    ? `\nDocument Structure:\n${page.structure
        .map((s) => `- ${s.title}${s.page ? ` (Page ${s.page})` : ""}`)
        .join("\n")}`
    : ""
}

Please analyze this content and provide the output in the requested format.`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      }
    }
  } catch (error) {
    console.error("Summarization error:", error);
    throw error;
  }
}

function generatePDF(
  summary: string,
  title: string,
  format: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header
      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .text(title || "Document Summary", { align: "center" })
        .moveDown(0.5);

      // Metadata
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("gray")
        .text(`Generated: ${new Date().toLocaleString()}`, { align: "center" })
        .text(`Format: ${format}`, { align: "center" })
        .moveDown(1)
        .fillColor("black");

      // Content
      doc.fontSize(12).font("Helvetica");

      // Split summary into paragraphs and handle bullet points
      const lines = summary.split("\n");
      let inList = false;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          doc.moveDown(0.5);
          inList = false;
          continue;
        }

        // Detect bullets and numbered lists
        if (/^[•\-\*]\s/.test(trimmed) || /^\d+[\.\)]\s/.test(trimmed)) {
          if (!inList) {
            doc.moveDown(0.3);
            inList = true;
          }
          doc.text(trimmed, { indent: 20, continued: false });
          doc.moveDown(0.2);
        } else {
          inList = false;
          // Check if it's a heading (short line, maybe all caps or has specific patterns)
          if (
            trimmed.length < 80 &&
            (trimmed === trimmed.toUpperCase() ||
              /^[A-Z][a-z]+([\s][A-Z][a-z]+)+$/.test(trimmed) ||
              trimmed.startsWith("##") ||
              trimmed.startsWith("#"))
          ) {
            doc
              .moveDown(0.5)
              .fontSize(14)
              .font("Helvetica-Bold")
              .text(trimmed, {
                continued: false,
              });
            doc.fontSize(12).font("Helvetica").moveDown(0.3);
          } else {
            doc.text(trimmed, { continued: false });
            doc.moveDown(0.4);
          }
        }

        // Check if we need a new page
        if (doc.y > doc.page.height - 100) {
          doc.addPage();
        }
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function savePDFToDownloads(pdfBuffer: Buffer, filename: string): string {
  const downloadsPath = path.join(os.homedir(), "Downloads");
  const filepath = path.join(downloadsPath, filename);

  // Ensure filename is unique if file exists
  let finalPath = filepath;
  let counter = 1;
  while (fs.existsSync(finalPath)) {
    const ext = path.extname(filename);
    const name = path.basename(filename, ext);
    finalPath = path.join(downloadsPath, `${name}_${counter}${ext}`);
    counter++;
  }

  fs.writeFileSync(finalPath, pdfBuffer);
  return finalPath;
}

// Existing /ask endpoint
app.post("/ask", async (req, res) => {
  const startTime = Date.now();
  let userId: string | undefined;
  let sessionId: mongoose.Types.ObjectId | undefined;
  let validated: any;

  try {
    validated = AskRequestSchema.parse(req.body);
    const {
      question,
      page,
      userId: requestUserId,
    } = validated as AskRequest & {
      userId?: string;
    };
    userId = requestUserId;

    // Get or create session if userId provided
    if (userId) {
      sessionId = await getOrCreateSession(userId);
    }

    let context: string;

    // Handle image-based PDFs with Vision API
    if (page.contentType === "pdf_image" && page.imageBase64) {
      const visionPrompt = `Based on this document image, answer the following question: ${question}

Provide a clear, accurate answer and include relevant quotes or references if possible.`;
      const answer = await callGeminiVision(page.imageBase64, visionPrompt);

      const response = { answer, citations: [] };

      // Save history if userId provided
      if (userId && sessionId) {
        const responseTime = Date.now() - startTime;
        saveChatHistory({
          userId,
          sessionId,
          requestType: "ask",
          page,
          input: {
            question,
            mainTextPreview: page.mainText.substring(0, 500),
          },
          output: { answer },
          responseTime,
        }).catch((err) => console.error("Failed to save history:", err));
      }

      return res.json(response);
    }

    // If selectedText exists and is non-empty, prioritize it
    if (page.selectedText && page.selectedText.trim().length > 0) {
      context = page.selectedText;
    } else {
      // Chunk and select top chunks
      context = selectTopChunks(page.mainText, question, 6);
    }

    // Limit context size to avoid token limits
    if (context.length > 80000) {
      context = context.substring(0, 80000);
    }

    const response = await callGemini(context, question);

    // Save history if userId provided
    if (userId && sessionId) {
      const responseTime = Date.now() - startTime;
      saveChatHistory({
        userId,
        sessionId,
        requestType: "ask",
        page,
        input: {
          question,
          selectedText: page.selectedText,
          mainTextPreview: page.mainText.substring(0, 500),
        },
        output: {
          answer: response.answer,
          citations: response.citations,
        },
        responseTime,
      }).catch((err) => console.error("Failed to save history:", err));
    }

    res.json(response);
  } catch (error) {
    console.error("Error in /ask:", error);

    // Save failed attempt if userId provided
    if (userId && sessionId && validated) {
      const responseTime = Date.now() - startTime;
      const page = (validated as any).page || req.body?.page;
      const question = (validated as any).question || req.body?.question;

      if (page) {
        saveChatHistory({
          userId,
          sessionId,
          requestType: "ask",
          page,
          input: {
            question,
            mainTextPreview: page.mainText?.substring(0, 500),
          },
          output: {},
          responseTime,
          success: false,
        }).catch((err) => console.error("Failed to save failed history:", err));
      }
    }

    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: error.errors });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Transcribe Endpoint (Voice Ask)
app.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    console.log("🎙️ Processing /transcribe request...");

    // Cast req to any to access file property added by multer
    const file = (req as any).file;

    if (!file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    console.log(
      `   - Received audio: ${file.size} bytes, type: ${file.mimetype}`
    );
    console.log("   - Calling ElevenLabs Speech-to-Text...");

    const transcript = await transcribeWithElevenLabs(
      file.buffer,
      file.mimetype
    );

    console.log("✅ Transcription successful");
    res.json({ transcript } as TranscribeResponse);
  } catch (error) {
    console.error("Error in /transcribe:", error);
    res.status(500).json({
      error: "Transcription failed",
      details: (error as Error).message,
    });
  }
});

// Summarize endpoint (modular)
app.post("/summarize", async (req, res) => {
  const startTime = Date.now();
  let userId: string | undefined;
  let sessionId: mongoose.Types.ObjectId | undefined;

  try {
    const validated = SummarizeRequestSchema.parse(req.body);
    const { page, detailLevel, userId: requestUserId } = validated;
    userId = requestUserId;

    console.log(
      `Summarizing ${page.contentType} document: "${page.title}" (detailLevel: ${detailLevel})`
    );

    // Get or create session if userId provided
    if (userId) {
      sessionId = await getOrCreateSession(userId);
    }

    // Validate that we have content to process
    if (!page.mainText || page.mainText.trim().length === 0) {
      return res.status(400).json({
        error: "No content available",
        message:
          "The page has no text content to summarize. Please ensure the content script is loaded and the page has readable content.",
      });
    }

    const summary = await handleSummarize(page, detailLevel);

    const response = {
      summary,
      detailLevel,
      title: page.title,
      url: page.url,
      timestamp: new Date().toISOString(),
    };

    // Save history if userId provided
    if (userId && sessionId) {
      const responseTime = Date.now() - startTime;
      saveChatHistory({
        userId,
        sessionId,
        requestType: "summarize",
        page,
        input: {
          detailLevel,
          mainTextPreview: page.mainText.substring(0, 500),
        },
        output: { summary },
        responseTime,
      }).catch((err) => console.error("Failed to save history:", err));
    }

    res.json(response);
  } catch (error) {
    console.error("Error in /summarize:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: error.errors });
    } else {
      res.status(500).json({
        error: "Internal server error",
        message: (error as Error).message,
      });
    }
  }
});

// Key Points endpoint
app.post("/key-points", async (req, res) => {
  const startTime = Date.now();
  let userId: string | undefined;
  let sessionId: mongoose.Types.ObjectId | undefined;

  try {
    const validated = KeyPointsRequestSchema.parse(req.body);
    const { page, userId: requestUserId } = validated;
    userId = requestUserId;

    console.log(
      `Extracting key points from ${page.contentType} document: "${page.title}"`
    );

    // Get or create session if userId provided
    if (userId) {
      sessionId = await getOrCreateSession(userId);
    }

    // Validate that we have content to process
    if (!page.mainText || page.mainText.trim().length === 0) {
      return res.status(400).json({
        error: "No content available",
        message:
          "The page has no text content to extract key points from. Please ensure the content script is loaded and the page has readable content.",
      });
    }

    const keyPoints = await handleKeyPoints(page);

    const response = {
      keyPoints,
      title: page.title,
      url: page.url,
      timestamp: new Date().toISOString(),
    };

    // Save history if userId provided
    if (userId && sessionId) {
      const responseTime = Date.now() - startTime;
      saveChatHistory({
        userId,
        sessionId,
        requestType: "key-points",
        page,
        input: {
          mainTextPreview: page.mainText.substring(0, 500),
        },
        output: { keyPoints },
        responseTime,
      }).catch((err) => console.error("Failed to save history:", err));
    }

    res.json(response);
  } catch (error) {
    console.error("Error in /key-points:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: error.errors });
    } else {
      res.status(500).json({
        error: "Internal server error",
        message: (error as Error).message,
      });
    }
  }
});

// Explain Like I'm 5 endpoint
app.post("/explain-like-5", async (req, res) => {
  const startTime = Date.now();
  let userId: string | undefined;
  let sessionId: mongoose.Types.ObjectId | undefined;

  try {
    const validated = ExplainLike5RequestSchema.parse(req.body);
    const { page, userId: requestUserId } = validated;
    userId = requestUserId;

    console.log(
      `Explaining ${page.contentType} document: "${page.title}" (like I'm 5)`
    );

    // Get or create session if userId provided
    if (userId) {
      sessionId = await getOrCreateSession(userId);
    }

    const explanation = await handleExplainLike5(page);

    const response = {
      explanation,
      title: page.title,
      url: page.url,
      timestamp: new Date().toISOString(),
    };

    // Save history if userId provided
    if (userId && sessionId) {
      const responseTime = Date.now() - startTime;
      saveChatHistory({
        userId,
        sessionId,
        requestType: "explain-like-5",
        page,
        input: {
          mainTextPreview: page.mainText.substring(0, 500),
        },
        output: { explanation },
        responseTime,
      }).catch((err) => console.error("Failed to save history:", err));
    }

    res.json(response);
  } catch (error) {
    console.error("Error in /explain-like-5:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: error.errors });
    } else {
      res.status(500).json({
        error: "Internal server error",
        message: (error as Error).message,
      });
    }
  }
});

// Action Items endpoint
app.post("/action-items", async (req, res) => {
  const startTime = Date.now();
  let userId: string | undefined;
  let sessionId: mongoose.Types.ObjectId | undefined;

  try {
    const validated = ActionItemsRequestSchema.parse(req.body);
    const { page, userId: requestUserId } = validated;
    userId = requestUserId;

    console.log(
      `Extracting action items from ${page.contentType} document: "${page.title}"`
    );

    // Get or create session if userId provided
    if (userId) {
      sessionId = await getOrCreateSession(userId);
    }

    // Validate that we have content to process
    if (!page.mainText || page.mainText.trim().length === 0) {
      return res.status(400).json({
        error: "No content available",
        message:
          "The page has no text content to extract action items from. Please ensure the content script is loaded and the page has readable content.",
      });
    }

    const actionItems = await handleActionItems(page);

    const response = {
      actionItems,
      title: page.title,
      url: page.url,
      timestamp: new Date().toISOString(),
    };

    // Save history if userId provided
    if (userId && sessionId) {
      const responseTime = Date.now() - startTime;
      saveChatHistory({
        userId,
        sessionId,
        requestType: "action-items",
        page,
        input: {
          mainTextPreview: page.mainText.substring(0, 500),
        },
        output: { actionItems },
        responseTime,
      }).catch((err) => console.error("Failed to save history:", err));
    }

    res.json(response);
  } catch (error) {
    console.error("Error in /action-items:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: error.errors });
    } else {
      res.status(500).json({
        error: "Internal server error",
        message: (error as Error).message,
      });
    }
  }
});

// ==================== HISTORY API ENDPOINTS ====================

// Get all history for a user
app.get("/api/history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0, requestType, search } = req.query;

    const query: any = { userId };

    if (requestType) {
      query.requestType = requestType;
    }

    if (search) {
      query.$or = [
        { pageTitle: { $regex: search, $options: "i" } },
        { pageUrl: { $regex: search, $options: "i" } },
        { "input.question": { $regex: search, $options: "i" } },
        { "output.answer": { $regex: search, $options: "i" } },
        { "output.summary": { $regex: search, $options: "i" } },
      ];
    }

    const history = await ChatHistory.find(query)
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .skip(Number(offset))
      .lean();

    const total = await ChatHistory.countDocuments(query);

    res.json({
      history,
      total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    console.error("Error fetching history:", error);
    res.status(500).json({
      error: "Internal server error",
      message: (error as Error).message,
    });
  }
});

// Get single history entry
app.get("/api/history/:userId/:historyId", async (req, res) => {
  try {
    const { userId, historyId } = req.params;

    const entry = await ChatHistory.findOne({
      _id: historyId,
      userId,
    }).lean();

    if (!entry) {
      return res.status(404).json({ error: "History entry not found" });
    }

    res.json(entry);
  } catch (error) {
    console.error("Error fetching history entry:", error);
    res.status(500).json({
      error: "Internal server error",
      message: (error as Error).message,
    });
  }
});

// Delete history entry
app.delete("/api/history/:userId/:historyId", async (req, res) => {
  try {
    const { userId, historyId } = req.params;

    const result = await ChatHistory.deleteOne({
      _id: historyId,
      userId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "History entry not found" });
    }

    res.json({ success: true, message: "History entry deleted" });
  } catch (error) {
    console.error("Error deleting history:", error);
    res.status(500).json({
      error: "Internal server error",
      message: (error as Error).message,
    });
  }
});

// Get user stats (auto-creates session if it doesn't exist)
app.get("/api/sessions/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Auto-create session if it doesn't exist (for first-time users)
    await getOrCreateSession(userId);
    const session = await Session.findOne({ userId });
    if (!session) {
      // This should never happen after getOrCreateSession, but handle it just in case
      return res.status(500).json({ error: "Failed to create session" });
    }

    const totalInteractions = await ChatHistory.countDocuments({ userId });
    const requestTypeStats = await ChatHistory.aggregate([
      { $match: { userId } },
      { $group: { _id: "$requestType", count: { $sum: 1 } } },
    ]);

    const stats = {
      requestTypeBreakdown: requestTypeStats.reduce(
        (acc: Record<string, number>, item: { _id: string; count: number }) => {
          acc[item._id] = item.count;
          return acc;
        },
        {} as Record<string, number>
      ),
    };

    res.json({
      session: {
        userId: session.userId,
        email: session.email,
        createdAt: session.createdAt,
        lastActive: session.lastActive,
      },
      stats: {
        totalInteractions,
        ...stats,
      },
    });
  } catch (error) {
    console.error("Error fetching session:", error);
    res.status(500).json({
      error: "Internal server error",
      message: (error as Error).message,
    });
  }
});

// Create or get session
app.post("/api/sessions", async (req, res) => {
  try {
    const { userId, email } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const sessionId = await getOrCreateSession(userId, email);
    const session = await Session.findOne({ userId });

    res.json({
      sessionId: sessionId.toString(),
      userId: session!.userId,
      email: session!.email,
      createdAt: session!.createdAt,
      lastActive: session!.lastActive,
    });
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({
      error: "Internal server error",
      message: (error as Error).message,
    });
  }
});

// ==================== HISTORY API ENDPOINTS ====================

// Get all history for a user
app.get("/api/history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0, requestType, search } = req.query;

    const query: any = { userId };

    if (requestType) {
      query.requestType = requestType;
    }

    if (search) {
      query.$or = [
        { pageTitle: { $regex: search, $options: "i" } },
        { pageUrl: { $regex: search, $options: "i" } },
        { "input.question": { $regex: search, $options: "i" } },
        { "output.answer": { $regex: search, $options: "i" } },
        { "output.summary": { $regex: search, $options: "i" } },
      ];
    }

    const history = await ChatHistory.find(query)
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .skip(Number(offset))
      .lean();

    const total = await ChatHistory.countDocuments(query);

    res.json({
      history,
      total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    console.error("Error fetching history:", error);
    res.status(500).json({
      error: "Internal server error",
      message: (error as Error).message,
    });
  }
});

// Get single history entry
app.get("/api/history/:userId/:historyId", async (req, res) => {
  try {
    const { userId, historyId } = req.params;

    const entry = await ChatHistory.findOne({
      _id: historyId,
      userId,
    }).lean();

    if (!entry) {
      return res.status(404).json({ error: "History entry not found" });
    }

    res.json(entry);
  } catch (error) {
    console.error("Error fetching history entry:", error);
    res.status(500).json({
      error: "Internal server error",
      message: (error as Error).message,
    });
  }
});

// Delete history entry
app.delete("/api/history/:userId/:historyId", async (req, res) => {
  try {
    const { userId, historyId } = req.params;

    const result = await ChatHistory.deleteOne({
      _id: historyId,
      userId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "History entry not found" });
    }

    res.json({ success: true, message: "History entry deleted" });
  } catch (error) {
    console.error("Error deleting history:", error);
    res.status(500).json({
      error: "Internal server error",
      message: (error as Error).message,
    });
  }
});

// Get user stats (DUPLICATE REMOVED - see first definition above)
// This duplicate endpoint has been removed to prevent conflicts

// Create or get session
app.post("/api/sessions", async (req, res) => {
  try {
    const { userId, email } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const sessionId = await getOrCreateSession(userId, email);
    const session = await Session.findOne({ userId });

    res.json({
      sessionId: sessionId.toString(),
      userId: session!.userId,
      email: session!.email,
      createdAt: session!.createdAt,
      lastActive: session!.lastActive,
    });
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({
      error: "Internal server error",
      message: (error as Error).message,
    });
  }
});

// Export PDF endpoint
app.post("/export-pdf", async (req, res) => {
  try {
    const { summary, title, format, saveToDownloads } = z
      .object({
        summary: z.string(),
        title: z.string(),
        format: z.string(),
        saveToDownloads: z.boolean().default(false),
      })
      .parse(req.body);

    console.log(`Generating PDF for: "${title}"`);

    const pdfBuffer = await generatePDF(summary, title, format);

    let savedPath: string | null = null;
    if (saveToDownloads) {
      const filename = `${title.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.pdf`;
      savedPath = savePDFToDownloads(pdfBuffer, filename);
      console.log(`PDF saved to: ${savedPath}`);
    }

    res.json({
      pdfBase64: pdfBuffer.toString("base64"),
      savedPath,
      filename: savedPath ? path.basename(savedPath) : null,
    });
  } catch (error) {
    console.error("Error in /export-pdf:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: error.errors });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Combined summarize + export endpoint (for convenience)
app.post("/summarize-and-export", async (req, res) => {
  try {
    const validated = LegacySummarizeRequestSchema.extend({
      saveToDownloads: z.boolean().default(false),
    }).parse(req.body);
    const { page, format, saveToDownloads } = validated;

    console.log(
      `Summarizing and exporting ${page.contentType} document: "${page.title}"`
    );

    // Step 1: Summarize
    const summary = await summarizeWithGemini(page, format);

    // Step 2: Generate PDF
    const pdfBuffer = await generatePDF(summary, page.title, format);

    // Step 3: Save if requested
    let savedPath: string | null = null;
    if (saveToDownloads) {
      const filename = `${page.title.replace(
        /[^a-z0-9]/gi,
        "_"
      )}_${Date.now()}.pdf`;
      savedPath = savePDFToDownloads(pdfBuffer, filename);
      console.log(`PDF saved to: ${savedPath}`);
    }

    res.json({
      summary,
      format,
      title: page.title,
      url: page.url,
      pdfBase64: pdfBuffer.toString("base64"),
      savedPath,
      filename: savedPath ? path.basename(savedPath) : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in /summarize-and-export:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: error.errors });
    } else {
      res.status(500).json({
        error: "Internal server error",
        message: (error as Error).message,
      });
    }
  }
});

// Test/Preview endpoint - allows testing without UI
app.post("/preview", async (req, res) => {
  try {
    const { action, ...rest } = req.body;

    if (action === "summarize") {
      const validated = LegacySummarizeRequestSchema.parse(rest);
      const { page, format } = validated;

      const summary = await summarizeWithGemini(page, format);
      const pdfBuffer = await generatePDF(summary, page.title, format);

      return res.json({
        success: true,
        action: "summarize",
        summary,
        format,
        title: page.title,
        summaryLength: summary.length,
        pdfSize: pdfBuffer.length,
        preview:
          summary.substring(0, 500) + (summary.length > 500 ? "..." : ""),
      });
    }

    if (action === "ask") {
      const validated = AskRequestSchema.parse(rest);
      const { question, page } = validated;

      let context: string;
      if (page.selectedText && page.selectedText.trim().length > 0) {
        context = page.selectedText;
      } else {
        context = selectTopChunks(page.mainText, question, 6);
      }

      if (context.length > 80000) {
        context = context.substring(0, 80000);
      }

      const response = await callGemini(context, question);

      return res.json({
        success: true,
        action: "ask",
        question,
        answer: response.answer,
        citationsCount: response.citations.length,
        citations: response.citations,
      });
    }

    res.status(400).json({ error: "Invalid action. Use 'summarize' or 'ask'" });
  } catch (error) {
    console.error("Error in /preview:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: error.errors });
    } else {
      res.status(500).json({
        error: "Internal server error",
        message: (error as Error).message,
      });
    }
  }
});

app.get("/", (req, res) => {
  res.json({
    message: "ContextCopilot API Server",
    endpoints: {
      "GET /health": "Health check endpoint",
      "POST /ask": "Ask questions about page content (add userId in body)",
      "POST /transcribe":
        "Transcribe audio to text using ElevenLabs (multipart/form-data with 'audio' file)",
      "POST /summarize": "Summarize page content (add userId in body)",
      "POST /key-points": "Extract key takeaways (add userId in body)",
      "POST /explain-like-5":
        "Explain content in simple terms (add userId in body)",
      "POST /action-items": "Extract actionable items (add userId in body)",
      "POST /export-pdf": "Generate PDF from summary text",
      "POST /summarize-and-export": "Summarize and export to PDF in one call",
      "POST /preview": "Test endpoint for backend preview",
      "GET /api/history/:userId":
        "Get chat history for a user (query: limit, offset, requestType, search)",
      "GET /api/history/:userId/:historyId": "Get single history entry",
      "DELETE /api/history/:userId/:historyId": "Delete history entry",
      "GET /api/sessions/:userId": "Get user session and stats",
      "POST /api/sessions":
        "Create or get user session (body: { userId, email? })",
    },
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Connect to MongoDB and start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`ContextCopilot server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

      if (!process.env.GEMINI_API_KEY) {
        console.error("\n❌ ERROR: GEMINI_API_KEY is missing!");
        console.error("   I looked for the .env file in these locations:");
        possiblePaths.forEach((p) => {
          const exists = fs.existsSync(p);
          console.error(`   - ${p} [${exists ? "FOUND" : "NOT FOUND"}]`);
        });
        console.error("\n   TROUBLESHOOTING:");
        console.error(
          "   1. If it says [FOUND], check if GEMINI_API_KEY is spelled correctly inside."
        );
        console.error(
          "   2. If all say [NOT FOUND], ensure the file is named exactly '.env' (not .env.txt)."
        );
      } else {
        console.log(
          `✓ GEMINI_API_KEY is set (loaded from ${
            loadedEnvPath || "process environment"
          })`
        );
        if (process.env.ELEVENLABS_API_KEY) {
          console.log(`✓ ELEVENLABS_API_KEY is set`);
        } else {
          console.warn(
            `⚠️ ELEVENLABS_API_KEY is missing! Voice transcription will fail.`
          );
        }
        console.log("\n🚀 Server is ready and waiting for requests...");
      }
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
