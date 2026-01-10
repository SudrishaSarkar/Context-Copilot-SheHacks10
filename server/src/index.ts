import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
// Note: In a real setup, you'd copy shared/contracts.ts or use a workspace
// For hackathon simplicity, we'll define types inline or use a build step
import type { AskRequest, AskResponse, Citation, SummarizeRequest, SummarizeResponse, PagePayload, StructureItem } from "./types.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 8787;

const StructureItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  startChar: z.number().optional(),
  endChar: z.number().optional(),
  page: z.number().optional(),
});

const PagePayloadSchema = z.object({
  url: z.string(),
  title: z.string(),
  contentType: z.enum(["html", "pdf_text", "pdf_image"]),
  selectedText: z.string().optional(),
  mainText: z.string(),
  structure: z.array(StructureItemSchema).optional(),
  meta: z.object({
    siteHint: z.enum(["github", "stackoverflow", "generic"]).optional(),
    timestamp: z.number().optional(),
  }).optional(),
});

const AskRequestSchema = z.object({
  question: z.string(),
  page: PagePayloadSchema,
});

const SummarizeRequestSchema = z.object({
  page: PagePayloadSchema,
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

async function callGemini(
  context: string, 
  question: string, 
  structure?: StructureItem[]
): Promise<AskResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set in environment");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  // Build structure hint for prompt
  let structureHint = "";
  if (structure && structure.length > 0) {
    structureHint = `\n\nDOCUMENT STRUCTURE (for citation sectionId):
${structure.map(s => `- ${s.id}: "${s.title}"${s.page ? ` (Page ${s.page})` : ""}`).join("\n")}
`;
  }

  const prompt = `You are a helpful assistant that answers questions based ONLY on the provided text below.

PROVIDED TEXT:
${context}${structureHint}

QUESTION: ${question}

INSTRUCTIONS:
1. Answer the question using ONLY information from the provided text above.
2. If the answer cannot be found in the provided text, respond with: "I cannot find the answer to this question in the provided content."
3. For each key piece of information in your answer, include a citation with a verbatim quote from the provided text.
4. Quotes MUST be exact substrings from the provided text - do not paraphrase or modify them.
5. For each citation, try to identify which section (sectionId) it belongs to based on the document structure above.
6. If the text mentions page numbers (e.g., "Page 7:"), include the page number in the citation.
7. Return your response as a JSON object matching this exact structure:
{
  "answer": "Your answer here",
  "citations": [
    {
      "quote": "exact verbatim quote from provided text",
      "sectionId": "sec_1 or null if not found",
      "sectionHint": "human-readable section name",
      "page": 7 or null,
      "confidence": 0.95
    }
  ],
  "followups": ["optional follow-up question 1", "optional follow-up question 2"]
}

Return ONLY the JSON object, no markdown formatting, no explanation, just the raw JSON.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Try to extract JSON from the response
    let jsonText = text.trim();
    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    const parsed = JSON.parse(jsonText) as AskResponse;
    
    // Validate structure
    if (!parsed.answer || !Array.isArray(parsed.citations)) {
      throw new Error("Invalid response structure");
    }

    // Ensure all quotes exist in context (fuzzy check) and enhance with structure info
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

      // Enhance with structure info if sectionId matches
      if (citation.sectionId && structure) {
        const matchedSection = structure.find(s => s.id === citation.sectionId);
        if (matchedSection) {
          if (!citation.sectionHint) {
            citation.sectionHint = matchedSection.title;
          }
          if (matchedSection.page && !citation.page) {
            citation.page = matchedSection.page;
          }
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

async function summarizePage(page: PagePayload): Promise<SummarizeResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set in environment");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  // Use first 40000 chars for summary to avoid token limits
  const summaryContext = page.mainText.substring(0, 40000);

  const prompt = `You are a helpful assistant that summarizes documents.

DOCUMENT TITLE: ${page.title}
DOCUMENT URL: ${page.url}

DOCUMENT CONTENT:
${summaryContext}

INSTRUCTIONS:
1. Provide a concise summary of the main content (2-4 paragraphs).
2. Highlight key points, sections, and important information.
3. If this appears to be a specific document type (rental agreement, research paper, etc.), note that in the summary.
4. Return your response as a JSON object:
{
  "summary": "Your summary here",
  "structure": [
    {"id": "sec_1", "title": "Main Section 1"},
    {"id": "sec_2", "title": "Main Section 2"}
  ]
}

Return ONLY the JSON object, no markdown formatting, just the raw JSON.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    let jsonText = text.trim();
    jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    const parsed = JSON.parse(jsonText) as SummarizeResponse;
    
    if (!parsed.summary) {
      throw new Error("Invalid response structure");
    }

    // Merge with existing structure if available
    if (page.structure && page.structure.length > 0 && (!parsed.structure || parsed.structure.length === 0)) {
      parsed.structure = page.structure;
    }

    return parsed;
  } catch (error) {
    console.error("Gemini API error for summarize:", error);
    // Fallback: return a simple summary
    return {
      summary: `Summary of "${page.title}": This document contains approximately ${Math.ceil(page.mainText.length / 1000)} thousand characters. Key sections may be available in the document structure.`,
      structure: page.structure || [],
    };
  }
}

app.post("/ask", async (req, res) => {
  try {
    const validated = AskRequestSchema.parse(req.body);
    const { question, page } = validated as AskRequest;

    let context: string;

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

    const response = await callGemini(context, question, page.structure);
    res.json(response);
  } catch (error) {
    console.error("Error in /ask:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: error.errors });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

app.post("/summarize", async (req, res) => {
  try {
    const validated = SummarizeRequestSchema.parse(req.body);
    const { page } = validated as SummarizeRequest;

    const response = await summarizePage(page);
    res.json(response);
  } catch (error) {
    console.error("Error in /summarize:", error);
    if (error instanceof z.ZodError) {
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
      "POST /summarize": "Summarize page content",
    },
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`ContextCopilot server running on http://localhost:${PORT}`);
});
