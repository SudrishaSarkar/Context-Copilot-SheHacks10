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
import type { AskRequest, AskResponse, Citation, PagePayload } from "./types.js";

// Ensure .env is loaded from the correct directory (try multiple paths)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const possiblePaths = [
  path.resolve(__dirname, "../.env"),           // server/.env (relative to src)
  path.resolve(process.cwd(), ".env"),          // server/.env (relative to cwd)
  path.resolve(__dirname, "../../.env"),        // root/.env (fallback)
];

let loadedEnvPath = null;

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
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Increase limit for base64 images

const PORT = 8787;

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

const SummarizeRequestSchema = z.object({
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

  const prompt = `You are a helpful assistant that answers questions based ONLY on the provided text below.

PROVIDED TEXT:
${context}

QUESTION: ${question}

INSTRUCTIONS:
1. Answer the question using ONLY information from the provided text above.
2. If the answer cannot be found in the provided text, respond with: "I cannot find the answer to this question in the provided content."
3. For each key piece of information in your answer, include a citation with a verbatim quote from the provided text.
4. Quotes MUST be exact substrings from the provided text - do not paraphrase or modify them.
5. Return your response as a JSON object matching this exact structure:
{
  "answer": "Your answer here",
  "citations": [
    {
      "quote": "exact verbatim quote from provided text",
      "sectionHint": "optional section hint",
      "confidence": 0.95
    }
  ]
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
  const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

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

// System prompt for summarization/extraction
function getSummarizePrompt(
  contentType: "html" | "pdf_text" | "pdf_image",
  format: "summary" | "bullet" | "extract"
): string {
  const formatInstructions = {
    summary: `Create a comprehensive summary of the document. Focus on:
- Main topics and themes
- Key findings or conclusions
- Important dates, numbers, or figures
- Critical details that should be remembered
- Overall purpose or context`,
    
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

DOCUMENT TYPE: ${contentType === "pdf_image" ? "Scanned/Image-based document" : contentType === "pdf_text" ? "Text-based PDF document" : "Web page"}

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
- Length should be comprehensive but concise (aim for 20-30% of original document length for summary, less for bullets/extract)`;

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
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

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
${page.structure ? `\nDocument Structure:\n${page.structure.map((s) => `- ${s.title}${s.page ? ` (Page ${s.page})` : ""}`).join("\n")}` : ""}

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

function generatePDF(summary: string, title: string, format: string): Promise<Buffer> {
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
            doc.moveDown(0.5).fontSize(14).font("Helvetica-Bold").text(trimmed, {
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
  try {
    const validated = AskRequestSchema.parse(req.body);
    const { question, page } = validated as AskRequest;

    let context: string;

    // Handle image-based PDFs with Vision API
    if (page.contentType === "pdf_image" && page.imageBase64) {
      const visionPrompt = `Based on this document image, answer the following question: ${question}

Provide a clear, accurate answer and include relevant quotes or references if possible.`;
      const answer = await callGeminiVision(page.imageBase64, visionPrompt);
      return res.json({
        answer,
        citations: [],
      });
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

// New /summarize endpoint
app.post("/summarize", async (req, res) => {
  try {
    const validated = SummarizeRequestSchema.parse(req.body);
    const { page, format } = validated;

    console.log(`Summarizing ${page.contentType} document: "${page.title}" (format: ${format})`);

    const summary = await summarizeWithGemini(page, format);

    res.json({
      summary,
      format,
      title: page.title,
      url: page.url,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in /summarize:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: error.errors });
    } else {
      res.status(500).json({ error: "Internal server error", message: (error as Error).message });
    }
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
    const validated = SummarizeRequestSchema.extend({
      saveToDownloads: z.boolean().default(false),
    }).parse(req.body);
    const { page, format, saveToDownloads } = validated;

    console.log(`Summarizing and exporting ${page.contentType} document: "${page.title}"`);

    // Step 1: Summarize
    const summary = await summarizeWithGemini(page, format);

    // Step 2: Generate PDF
    const pdfBuffer = await generatePDF(summary, page.title, format);

    // Step 3: Save if requested
    let savedPath: string | null = null;
    if (saveToDownloads) {
      const filename = `${page.title.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.pdf`;
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
      res.status(500).json({ error: "Internal server error", message: (error as Error).message });
    }
  }
});

// Test/Preview endpoint - allows testing without UI
app.post("/preview", async (req, res) => {
  try {
    const { action, ...rest } = req.body;
    
    if (action === "summarize") {
      const validated = SummarizeRequestSchema.parse(rest);
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
        preview: summary.substring(0, 500) + (summary.length > 500 ? "..." : ""),
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
      res.status(500).json({ error: "Internal server error", message: (error as Error).message });
    }
  }
});

app.get("/", (req, res) => {
  res.json({
    message: "ContextCopilot API Server",
    endpoints: {
      "GET /health": "Health check endpoint",
      "POST /ask": "Ask questions about page content",
      "POST /summarize": "Summarize/extract/bullet point page content",
      "POST /export-pdf": "Generate PDF from summary text",
      "POST /summarize-and-export": "Summarize and export to PDF in one call",
      "POST /preview": "Test endpoint for backend preview (use action: 'summarize' or 'ask')",
    },
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`ContextCopilot server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  
  if (!process.env.GEMINI_API_KEY) {
    console.error("\n❌ ERROR: GEMINI_API_KEY is missing!");
    console.error("   I looked for the .env file in these locations:");
    possiblePaths.forEach(p => {
        const exists = fs.existsSync(p);
        console.error(`   - ${p} [${exists ? "FOUND" : "NOT FOUND"}]`);
    });
    console.error("\n   TROUBLESHOOTING:");
    console.error("   1. If it says [FOUND], check if GEMINI_API_KEY is spelled correctly inside.");
    console.error("   2. If all say [NOT FOUND], ensure the file is named exactly '.env' (not .env.txt).");
  } else {
    console.log(`✓ GEMINI_API_KEY is set (loaded from ${loadedEnvPath || "process environment"})`);
    console.log("\n🚀 Server is ready and waiting for requests...");
  }
});
