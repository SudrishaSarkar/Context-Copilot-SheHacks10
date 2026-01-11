import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AskRequest, AskResponse, Citation } from "../../shared/contracts.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Reasonable limit for text content

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8787;

// Text processing utilities for chunking and relevance selection

/**
 * Normalize whitespace in text - collapse multiple spaces/tabs/newlines into single spaces
 */
function normalizeWhitespace(text: string): string {
  return text
    .replace(/\s+/g, " ") // Replace any whitespace sequence with single space
    .trim(); // Remove leading/trailing whitespace
}

/**
 * Split text into chunks of approximately targetSize characters, trying to cut on sentence boundaries
 */
function chunkText(text: string, targetSize: number = 1800): string[] {
  if (text.length <= targetSize) {
    return [text];
  }

  const chunks: string[] = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    // If remaining text is shorter than targetSize, take it all
    if (text.length - currentIndex <= targetSize) {
      chunks.push(text.substring(currentIndex));
      break;
    }

    // Try to find a sentence boundary near the target size
    const chunkEnd = currentIndex + targetSize;
    
    // Look for sentence endings (. ! ?) within a window of the target size
    // Look backwards from target size, then forwards if not found
    const lookbackWindow = Math.min(200, targetSize * 0.2); // Look back 20% or 200 chars
    const lookaheadWindow = Math.min(300, targetSize * 0.3); // Look ahead 30% or 300 chars
    
    let bestBoundary = chunkEnd;
    let foundBoundary = false;

    // First, try to find a sentence boundary by looking backwards
    for (let i = chunkEnd; i >= chunkEnd - lookbackWindow && i > currentIndex; i--) {
      const char = text[i];
      if (char === "." || char === "!" || char === "?") {
        // Check if it's followed by space and possibly capital letter or end of text
        const nextChar = text[i + 1];
        const afterNext = text[i + 2];
        if (
          (nextChar === " " || nextChar === "\n" || i + 1 >= text.length) &&
          (i + 1 >= text.length || afterNext === undefined || afterNext === " " || afterNext === "\n" || /[A-Z]/.test(afterNext))
        ) {
          bestBoundary = i + 1;
          foundBoundary = true;
          break;
        }
      }
    }

    // If no boundary found looking back, try looking forward
    if (!foundBoundary) {
      for (let i = chunkEnd; i <= chunkEnd + lookaheadWindow && i < text.length; i++) {
        const char = text[i];
        if (char === "." || char === "!" || char === "?") {
          const nextChar = text[i + 1];
          const afterNext = text[i + 2];
          if (
            (nextChar === " " || nextChar === "\n" || i + 1 >= text.length) &&
            (i + 1 >= text.length || afterNext === undefined || afterNext === " " || afterNext === "\n" || /[A-Z]/.test(afterNext))
          ) {
            bestBoundary = i + 1;
            foundBoundary = true;
            break;
          }
        }
      }
    }

    // If still no sentence boundary found, just cut at the target size
    if (!foundBoundary) {
      // Try to find at least a word boundary (space)
      for (let i = chunkEnd; i >= chunkEnd - 50 && i > currentIndex; i--) {
        if (text[i] === " " || text[i] === "\n") {
          bestBoundary = i + 1;
          foundBoundary = true;
          break;
        }
      }
      if (!foundBoundary) {
        bestBoundary = chunkEnd;
      }
    }

    // Extract chunk and move to next position
    const chunk = text.substring(currentIndex, bestBoundary).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    currentIndex = bestBoundary;
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

/**
 * Tokenize text into a set of lowercase words (excluding very short words)
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2) // Filter out very short words
      .map((word) => word.replace(/[^\w]/g, "")) // Remove punctuation
      .filter((word) => word.length > 0)
  );
}

/**
 * Score a chunk by keyword overlap with the question using simple token set match
 */
function scoreChunk(chunk: string, question: string): number {
  const chunkTokens = tokenize(chunk);
  const questionTokens = tokenize(question);

  if (questionTokens.size === 0) {
    return 0;
  }

  // Count overlapping tokens
  let overlapCount = 0;
  for (const token of questionTokens) {
    if (chunkTokens.has(token)) {
      overlapCount++;
    }
  }

  // Return score as ratio of overlapping tokens to total question tokens
  // Also add bonus for multiple occurrences of keywords
  let bonus = 0;
  const chunkLower = chunk.toLowerCase();
  for (const token of questionTokens) {
    if (chunkTokens.has(token)) {
      // Count occurrences of this token in the chunk
      const regex = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      const matches = chunkLower.match(regex);
      if (matches && matches.length > 1) {
        bonus += matches.length - 1; // Bonus for multiple occurrences
      }
    }
  }

  return overlapCount / questionTokens.size + bonus * 0.1;
}

/**
 * Select top N chunks based on relevance score
 */
function selectTopChunks(chunks: string[], question: string, topN: number = 6): string[] {
  if (chunks.length === 0) {
    return [];
  }

  // Score all chunks
  const scored = chunks.map((chunk, index) => ({
    chunk,
    score: scoreChunk(chunk, question),
    index,
  }));

  // Sort by score (descending)
  scored.sort((a, b) => b.score - a.score);

  // Return top N chunks (or all if fewer than N)
  return scored.slice(0, topN).map((item) => item.chunk);
}

/**
 * Prepare context for processing: normalize, chunk, score, and select relevant chunks
 * If selectedText exists, it's included as highest priority, followed by top chunks from mainText
 * Returns both the context string and metadata about the chunks
 */
function prepareContext(
  mainText: string,
  question: string,
  selectedText?: string
): { context: string; chunksSelected: number } {
  // Normalize whitespace in mainText
  const normalizedMainText = normalizeWhitespace(mainText);

  // Split into chunks
  const chunks = chunkText(normalizedMainText, 1800);

  // Select top 6 chunks
  const topChunks = selectTopChunks(chunks, question, 6);

  // Build context: selectedText first (if exists), then top chunks
  const contextParts: string[] = [];

  // If selectedText exists, include it separately as highest priority context
  if (selectedText && selectedText.trim().length > 0) {
    const normalizedSelected = normalizeWhitespace(selectedText);
    contextParts.push("=== SELECTED TEXT ===\n" + normalizedSelected);
  }

  // Include top chunks from mainText
  if (topChunks.length > 0) {
    contextParts.push("=== RELEVANT SECTIONS ===\n" + topChunks.join("\n\n---\n\n"));
  } else if (chunks.length > 0) {
    // Fallback: if no chunks scored well, use first chunk
    contextParts.push(chunks[0]);
  }

  return {
    context: contextParts.join("\n\n"),
    chunksSelected: topChunks.length,
  };
}

/**
 * Validate that a quote is an EXACT substring of the combined context
 * Returns the exact quote from context if found, null otherwise
 * Only accepts exact substring matches (case-sensitive first, then case-insensitive)
 */
function validateVerbatimQuote(quote: string, combinedContext: string): string | null {
  const quoteTrimmed = quote.trim();
  if (!quoteTrimmed || quoteTrimmed.length === 0) {
    return null;
  }

  // First try exact match (case-sensitive) - this is the strictest
  const exactIndex = combinedContext.indexOf(quoteTrimmed);
  if (exactIndex !== -1) {
    // Found exact substring - return it as-is
    return quoteTrimmed;
  }

  // If exact match fails, try case-insensitive match and extract exact casing from context
  const contextLower = combinedContext.toLowerCase();
  const quoteLower = quoteTrimmed.toLowerCase();
  const index = contextLower.indexOf(quoteLower);
  
  if (index !== -1) {
    // Found case-insensitive match - extract exact substring from context with original casing
    const extractedQuote = combinedContext.substring(index, index + quoteTrimmed.length);
    return extractedQuote;
  }

  // No match found - quote is not a valid substring
  return null;
}

/**
 * Post-process citations to filter invalid ones and limit to max count
 * Filters citations whose quote is NOT an exact substring of the combined context
 */
function postProcessCitations(
  citations: Array<{
    quote?: string;
    sectionHint?: string | null;
    confidence?: number;
  }>,
  combinedContext: string,
  maxCitations: number = 6
): Citation[] {
  const validCitations: Citation[] = [];

  for (const citation of citations) {
    if (!citation.quote || typeof citation.quote !== "string") {
      continue; // Skip citations without quotes
    }

    // Validate quote is an exact substring of combined context
    const validatedQuote = validateVerbatimQuote(citation.quote, combinedContext);
    
    if (validatedQuote) {
      validCitations.push({
        quote: validatedQuote,
        sectionHint:
          citation.sectionHint !== null && citation.sectionHint !== undefined
            ? citation.sectionHint
            : undefined,
        confidence: citation.confidence || 0.95,
      });

      // Stop if we've reached the max number of citations
      if (validCitations.length >= maxCitations) {
        break;
      }
    } else {
      // Quote not found as exact substring - log and skip
      console.warn(
        `Filtered invalid citation (not an exact substring): "${citation.quote.substring(0, 50)}..."`
      );
    }
  }

  return validCitations;
}

/**
 * Build combined context from selectedText and chunks for validation purposes
 */
function buildCombinedContext(
  selectedText: string | undefined,
  mainText: string
): string {
  const parts: string[] = [];
  
  if (selectedText && selectedText.trim().length > 0) {
    parts.push(normalizeWhitespace(selectedText));
  }
  
  // Add mainText (already normalized and chunked in prepareContext, but we need the original for validation)
  parts.push(normalizeWhitespace(mainText));
  
  return parts.join("\n\n");
}

/**
 * Call Gemini API with strict prompt and parse JSON response
 * Includes post-processing to filter invalid citations
 */
async function callGemini(
  context: string,
  question: string,
  combinedContext: string
): Promise<AskResponse> {
  // Check API key - return fallback if missing (for stable demo)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not set in environment variables");
    return {
      answer: "Server configuration error: AI service is not available. Please contact support.",
      citations: [],
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Try gemini-pro (most stable), fallback to gemini-1.5-pro if needed
    const model = genAI.getGenerativeModel({
      model: "gemini-pro",
      generationConfig: {
        temperature: 0.2,
      },
    });

    const prompt = `You are a precise assistant that answers questions based ONLY on the provided context below.

PROVIDED CONTEXT:
${context}

QUESTION: ${question}

CRITICAL INSTRUCTIONS:
1. Answer the question using ONLY information from the PROVIDED CONTEXT above.
2. If the answer cannot be found in the PROVIDED CONTEXT, respond with: "I cannot find the answer to this question in the provided content."
3. Each quote in citations MUST be copied VERBATIM from the PROVIDED CONTEXT - character-for-character exact substring match.
4. Do NOT paraphrase, modify, or rephrase quotes. Copy them exactly as they appear in the PROVIDED CONTEXT.
5. Provide 2-5 citations when possible, each with a verbatim quote from the PROVIDED CONTEXT.
6. Do NOT add quotation marks around quotes - they should be the raw text from the context.
7. Do NOT output markdown code blocks, backticks, or any formatting.
8. Return ONLY valid JSON matching this exact structure:

{
  "answer": "Your answer here based solely on the provided context",
  "citations": [
    {
      "quote": "exact verbatim quote copied from PROVIDED CONTEXT",
      "sectionHint": "section name or null",
      "confidence": 0.95
    }
  ]
}

Return ONLY the JSON object, no other text, no markdown, no explanations.`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response - handle markdown code blocks or extra text
    let jsonText = text.trim();

    // Remove markdown code blocks if present
    jsonText = jsonText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/```\s*$/, "")
      .trim();

    // Try to extract the first {...} JSON block
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    // Parse JSON
    const parsed = JSON.parse(jsonText) as {
      answer?: string;
      citations?: Array<{
        quote?: string;
        sectionHint?: string | null;
        confidence?: number;
      }>;
    };
    
    // Validate structure
    if (!parsed.answer || typeof parsed.answer !== "string") {
      throw new Error("Invalid response: missing or invalid 'answer' field");
    }

    if (!parsed.citations || !Array.isArray(parsed.citations)) {
      throw new Error("Invalid response: missing or invalid 'citations' array");
    }

    // Post-process citations: filter invalid ones and limit to 6
    // Use combinedContext (selectedText + mainText) for validation
    const validatedCitations = postProcessCitations(
      parsed.citations,
      combinedContext,
      6 // Max 6 citations
    );

    return {
      answer: parsed.answer.trim(),
      citations: validatedCitations,
    };
  } catch (error) {
    console.error("Gemini API error:", error);
    
    // If any error occurs (parsing fails, API error, network error, etc.),
    // return a fallback AskResponse with helpful message
    // This makes the demo stable even if Gemini misbehaves
    const fallbackResponse: AskResponse = {
      answer:
        error instanceof SyntaxError
          ? "I encountered an error parsing the AI response. Please try again with a different question."
          : error instanceof Error && error.message.includes("API")
          ? "I encountered an error communicating with the AI service. Please try again."
          : "I encountered an error processing your question. Please try again.",
      citations: [],
    };

    return fallbackResponse;
  }
}

// Zod schema matching AskRequest from shared/contracts.ts
const AskRequestSchema = z.object({
  question: z.string().min(1, "Question cannot be empty"),
  page: z.object({
    url: z.string().url("Invalid URL format").min(1, "URL cannot be empty"),
    title: z.string().min(1, "Title cannot be empty"),
    contentType: z.enum(["html", "pdf_text"], {
      message: "contentType must be 'html' or 'pdf_text'",
    }),
    selectedText: z.string().optional(),
    mainText: z.string().min(1, "mainText cannot be empty"),
    structure: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
        })
      )
      .optional(),
  }),
});

// GET /health endpoint
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// POST /ask endpoint with Zod validation
app.post("/ask", async (req, res) => {
  try {
    // Validate request body using Zod schema
    const validationResult = AskRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      // Return HTTP 400 with error JSON on validation failure
      return res.status(400).json({
        error: "Invalid request",
        details: validationResult.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    // Request is valid, typed as AskRequest
    const validatedRequest: AskRequest = validationResult.data;
    const { question, page } = validatedRequest;

    // Prepare context using chunking and relevance selection
    const { context, chunksSelected } = prepareContext(
      page.mainText,
      question,
      page.selectedText
    );

    // Build combined context (selectedText + mainText) for citation validation
    // This is used to verify quotes are exact substrings of the original content
    const combinedContext = buildCombinedContext(page.selectedText, page.mainText);

    // Call Gemini API with prepared context
    // Pass combinedContext for post-processing citation validation
    const response = await callGemini(context, question, combinedContext);

    // Minimal logging: question length, chunks selected, citation count (no full page text)
    console.log(
      `[POST /ask] question_length=${question.length} chars, ` +
      `chunks_selected=${chunksSelected}, ` +
      `citations_returned=${response.citations.length}`
    );

    res.json(response);
  } catch (error) {
    // Handle unexpected errors
    console.error("Unexpected error in /ask:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
