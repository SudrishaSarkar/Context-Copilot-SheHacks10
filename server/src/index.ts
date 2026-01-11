import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
// Note: In a real setup, you'd copy shared/contracts.ts or use a workspace
// For hackathon simplicity, we'll define types inline or use a build step
import type { AskRequest, AskResponse, Citation } from "./types.js";
import { buildSystemPrompt } from "./prompt.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 8787;

const AskRequestSchema = z.object({
  question: z.string(),
  page: z.object({
    url: z.string(),
    title: z.string(),
    contentType: z.enum(["html", "pdf_text"]),
    selectedText: z.string().optional(),
    mainText: z.string(),
    structure: z.array(z.object({ id: z.string(), title: z.string() })).optional(),
  }),
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

function selectTopChunks(mainText: string, question: string, topN: number = 6): string {
  const chunks = chunkText(mainText, 1800);
  const scored = chunks.map((chunk, idx) => ({
    chunk,
    score: scoreChunk(chunk, question),
    idx,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN).map((s) => s.chunk).join("\n\n---\n\n");
}

async function callGemini(context: string, question: string): Promise<AskResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set in environment");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  // Build the system prompt using the extracted function
  const prompt = buildSystemPrompt(context, question);

  console.log(`[Gemini] Calling API with context length: ${context.length}, question: "${question.substring(0, 50)}..."`);

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log(`[Gemini] Received response, length: ${text.length}`);

    // Try to extract JSON from the response
    let jsonText = text.trim();
    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
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
          const end = Math.min(context.length, idx + citation.quote.length + 20);
          citation.quote = context.substring(start, end).trim();
        }
      }
      return citation;
    });

    return parsed;
  } catch (error) {
    console.error("Gemini API error:", error);
    return {
      answer: "I encountered an error processing your question. Please try again.",
      citations: [],
    };
  }
}

app.post("/ask", async (req, res) => {
  try {
    console.log("[API] Received /ask request");
    
    const validated = AskRequestSchema.parse(req.body);
    const { question, page } = validated as AskRequest;

    console.log(`[API] Processing question: "${question}" for page: ${page.url}`);
    console.log(`[API] Page has selectedText: ${!!page.selectedText}, mainText length: ${page.mainText.length}`);

    let context: string;

    // If selectedText exists and is non-empty, prioritize it
    if (page.selectedText && page.selectedText.trim().length > 0) {
      context = page.selectedText;
      console.log(`[API] Using selected text, length: ${context.length}`);
    } else {
      // Chunk and select top chunks
      context = selectTopChunks(page.mainText, question, 6);
      console.log(`[API] Using chunked main text, length: ${context.length}`);
    }

    // Limit context size to avoid token limits
    if (context.length > 80000) {
      context = context.substring(0, 80000);
      console.log(`[API] Truncated context to 80000 characters`);
    }

    const response = await callGemini(context, question);
    
    console.log(`[API] Returning answer with ${response.citations.length} citations`);
    res.json(response);
  } catch (error) {
    console.error("[API] Error in /ask:", error);
    if (error instanceof z.ZodError) {
      console.error("[API] Validation error:", error.errors);
      res.status(400).json({ error: "Invalid request", details: error.errors });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

app.get("/", (req, res) => {
  res.json({
    message: "ContextCopilot API Server",
    endpoints: {
      "GET /health": "Health check endpoint",
      "POST /ask": "Ask questions about page content",
    },
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`ContextCopilot server running on http://localhost:${PORT}`);
});
