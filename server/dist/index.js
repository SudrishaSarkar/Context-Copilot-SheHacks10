import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { dirname } from "path";
import multer from "multer";
// Ensure .env is loaded from the correct directory (try multiple paths)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const possiblePaths = [
    path.resolve(__dirname, "../.env"), // server/.env (relative to src)
    path.resolve(process.cwd(), ".env"), // server/.env (relative to cwd)
    path.resolve(__dirname, "../../.env"), // root/.env (fallback)
];
let loadedEnvPath = null;
for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        config({ path: p });
        if (process.env.GEMINI_API_KEY) {
            loadedEnvPath = p;
            break;
        }
    }
}
const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Increase limit for base64 images
// Configure Multer for memory storage (handling audio uploads)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
});
// DEBUG: Log every incoming request
app.use((req, res, next) => {
    console.log(`\n📨 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});
const PORT = 8787;
let currentModelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const AskRequestSchema = z.object({
    question: z.string(),
    page: z.object({
        url: z.string(),
        title: z.string(),
        contentType: z.enum(["html", "pdf_text", "pdf_image"]),
        selectedText: z.string().optional(),
        mainText: z.string(),
        structure: z
            .array(z.object({
            id: z.string(),
            title: z.string(),
            startChar: z.number().optional(),
            endChar: z.number().optional(),
            page: z.number().optional(),
        }))
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
            .array(z.object({
            id: z.string(),
            title: z.string(),
            startChar: z.number().optional(),
            endChar: z.number().optional(),
            page: z.number().optional(),
        }))
            .optional(),
        meta: z
            .object({
            siteHint: z.enum(["github", "stackoverflow", "generic"]).optional(),
            timestamp: z.number().optional(),
        })
            .optional(),
        imageBase64: z.string().optional(),
    }),
    format: z.enum(["summary", "bullet", "extract", "eli5"]).default("summary"),
});
function chunkText(text, chunkSize = 1800) {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
}
function scoreChunk(chunk, question) {
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
function selectTopChunks(mainText, question, topN = 6) {
    const chunks = chunkText(mainText, 1800);
    const scored = chunks.map((chunk, idx) => ({
        chunk,
        score: scoreChunk(chunk, question),
        idx,
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topN).map((s) => s.chunk).join("\n\n---\n\n");
}
async function callGemini(context, question) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY not set in environment");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    console.log(`   - Using Gemini Model: ${currentModelName}`);
    const model = genAI.getGenerativeModel({ model: currentModelName });
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
        const parsed = JSON.parse(jsonText);
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
    }
    catch (error) {
        console.error("Gemini API error:", error);
        return {
            answer: "I encountered an error processing your question. Please try again.",
            citations: [],
        };
    }
}
// Gemini Vision API for image-based PDFs
async function callGeminiVision(imageBase64, prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY not set in environment");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    // Force use of 1.5 Flash for vision as it is multimodal and fast
    const visionModelName = "gemini-1.5-flash";
    const model = genAI.getGenerativeModel({ model: visionModelName });
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
    }
    catch (error) {
        console.error("Gemini Vision API error:", error);
        throw error;
    }
}
// ElevenLabs Speech-to-Text Integration
async function transcribeWithElevenLabs(audioBuffer, mimeType) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
        throw new Error("ELEVENLABS_API_KEY not set in environment");
    }
    const apiUrl = "https://api.elevenlabs.io/v1/speech-to-text";
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    // Determine extension based on mimeType
    let ext = "wav";
    if (mimeType.includes("webm"))
        ext = "webm";
    else if (mimeType.includes("mp4"))
        ext = "mp4";
    else if (mimeType.includes("mpeg") || mimeType.includes("mp3"))
        ext = "mp3";
    else if (mimeType.includes("m4a"))
        ext = "m4a";
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
        throw new Error(`ElevenLabs STT API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    const data = await response.json();
    return data.text;
}
// System prompt for summarization/extraction
function getSummarizePrompt(contentType, format) {
    const formatInstructions = {
        summary: `Provide a crisp, structured summary of the content.
- **Executive Summary**: A 2-3 sentence overview of the main purpose.
- **Key Takeaways**: The most important points.
- **Details**: Specifics on dates, figures, requirements, or findings.
- **Conclusion**: The final outcome or action items.
Do not use generic filler phrases. Be direct.`,
        bullet: `List the key information in a clean bulleted format.
- Use main bullets for major topics.
- Use sub-bullets for supporting details.
- Bold **key terms**, **dates**, and **figures**.
- Ignore navigation menus, footers, and irrelevant web clutter.`,
        extract: `Extract specific entities and data points.
- **Dates & Deadlines**: List all relevant dates.
- **Financials**: Costs, prices, fees (if any).
- **Names/Entities**: People, companies, organizations mentioned.
- **Action Items**: Things the reader needs to do.`,
        eli5: `Explain this like I'm 5 years old.
- Use simple words.
- Use an analogy if helpful.
- Keep it short and fun.
- "Here is the gist: ..."`,
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
async function summarizeWithGemini(page, format) {
    console.log(`[summarizeWithGemini] Starting. Format: ${format}, ContentType: ${page.contentType}`);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("[summarizeWithGemini] Error: GEMINI_API_KEY not set");
        throw new Error("GEMINI_API_KEY not set in environment");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const systemPrompt = getSummarizePrompt(page.contentType, format);
    try {
        if (page.contentType === "pdf_image" && page.imageBase64) {
            // Use Vision API for image-based PDFs
            console.log("[summarizeWithGemini] Processing as Image PDF (Vision)");
            const prompt = `${systemPrompt}

Please analyze this document image and provide the requested output format.`;
            return await callGeminiVision(page.imageBase64, prompt);
        }
        else {
            // Use text API for text-based content
            console.log(`[summarizeWithGemini] Using model: ${currentModelName}`);
            const model = genAI.getGenerativeModel({ model: currentModelName });
            // If selectedText exists, use it; otherwise use mainText (chunked if too long)
            let content = page.selectedText || page.mainText;
            if (!content || content.trim().length === 0) {
                console.warn("[summarizeWithGemini] Warning: Content is empty.");
                return "The document appears to be empty or content could not be extracted. Please try selecting specific text.";
            }
            console.log(`[summarizeWithGemini] Content length: ${content.length} chars`);
            // Determine chunking threshold based on model capabilities
            // Gemini 1.5 has ~1M token window (~4M chars). We use a safe limit of 800k chars.
            const isGemini15 = currentModelName.includes("1.5");
            const chunkThreshold = isGemini15 ? 800000 : 30000;
            // If content is too long, summarize in chunks
            if (content.length > chunkThreshold) {
                console.log("[summarizeWithGemini] Content too long, using chunking strategy.");
                // Split into chunks and summarize each, then combine
                const chunks = chunkText(content, isGemini15 ? 500000 : 40000);
                const chunkSummaries = [];
                for (const chunk of chunks) {
                    console.log(`[summarizeWithGemini] Processing chunk ${chunkSummaries.length + 1}/${chunks.length}`);
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
            }
            else {
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
    }
    catch (error) {
        console.error("[summarizeWithGemini] API Error:", error);
        throw error;
    }
}
function generatePDF(summary, title, format) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                margins: { top: 50, bottom: 50, left: 50, right: 50 },
            });
            const chunks = [];
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
                }
                else {
                    inList = false;
                    // Check if it's a heading (short line, maybe all caps or has specific patterns)
                    if (trimmed.length < 80 &&
                        (trimmed === trimmed.toUpperCase() ||
                            /^[A-Z][a-z]+([\s][A-Z][a-z]+)+$/.test(trimmed) ||
                            trimmed.startsWith("##") ||
                            trimmed.startsWith("#"))) {
                        doc.moveDown(0.5).fontSize(14).font("Helvetica-Bold").text(trimmed, {
                            continued: false,
                        });
                        doc.fontSize(12).font("Helvetica").moveDown(0.3);
                    }
                    else {
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
        }
        catch (error) {
            reject(error);
        }
    });
}
function savePDFToDownloads(pdfBuffer, filename) {
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
        console.log("🔍 Processing /ask request...");
        const validated = AskRequestSchema.parse(req.body);
        const { question, page } = validated;
        let context;
        // Handle image-based PDFs with Vision API
        if (page.contentType === "pdf_image" && page.imageBase64) {
            console.log("   - Processing as Image PDF (Vision API)");
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
            console.log("   - Using user selected text");
            context = page.selectedText;
        }
        else {
            // Chunk and select top chunks
            console.log("   - Using full page content (chunking)");
            context = selectTopChunks(page.mainText, question, 6);
        }
        // Limit context size to avoid token limits
        if (context.length > 80000) {
            context = context.substring(0, 80000);
        }
        console.log("   - Calling Gemini API...");
        const response = await callGemini(context, question);
        console.log("✅ Gemini responded successfully");
        res.json(response);
    }
    catch (error) {
        console.error("Error in /ask:", error);
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: "Invalid request", details: error.errors });
        }
        else {
            res.status(500).json({ error: "Internal server error" });
        }
    }
});
// Transcribe Endpoint (Voice Ask)
app.post("/transcribe", upload.single("audio"), async (req, res) => {
    try {
        console.log("🎙️ Processing /transcribe request...");
        // Cast req to any to access file property added by multer
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: "No audio file provided" });
        }
        console.log(`   - Received audio: ${file.size} bytes, type: ${file.mimetype}`);
        console.log("   - Calling ElevenLabs Speech-to-Text...");
        const transcript = await transcribeWithElevenLabs(file.buffer, file.mimetype);
        console.log("✅ Transcription successful");
        res.json({ transcript });
    }
    catch (error) {
        console.error("Error in /transcribe:", error);
        res.status(500).json({ error: "Transcription failed", details: error.message });
    }
});
// New /summarize endpoint
app.post("/summarize", async (req, res) => {
    try {
        console.log("\n📨 POST /summarize received");
        const validated = SummarizeRequestSchema.parse(req.body);
        const { page, format } = validated;
        console.log(`[Endpoint] Summarizing ${page.contentType} document: "${page.title}" (format: ${format})`);
        const summary = await summarizeWithGemini(page, format);
        console.log("[Endpoint] Summary generated successfully. Length:", summary.length);
        res.json({
            summary,
            format,
            title: page.title,
            url: page.url,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error("[Endpoint] Error in /summarize:", error);
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: "Invalid request", details: error.errors });
        }
        else {
            res.status(500).json({ error: "Internal server error", message: error.message });
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
        let savedPath = null;
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
    }
    catch (error) {
        console.error("Error in /export-pdf:", error);
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: "Invalid request", details: error.errors });
        }
        else {
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
        let savedPath = null;
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
    }
    catch (error) {
        console.error("Error in /summarize-and-export:", error);
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: "Invalid request", details: error.errors });
        }
        else {
            res.status(500).json({ error: "Internal server error", message: error.message });
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
            let context;
            if (page.selectedText && page.selectedText.trim().length > 0) {
                context = page.selectedText;
            }
            else {
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
    }
    catch (error) {
        console.error("Error in /preview:", error);
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: "Invalid request", details: error.errors });
        }
        else {
            res.status(500).json({ error: "Internal server error", message: error.message });
        }
    }
});
app.get("/", (req, res) => {
    res.json({
        message: "ContextCopilot API Server",
        endpoints: {
            "GET /health": "Health check endpoint",
            "POST /ask": "Ask questions about page content",
            "GET /list-models": "List available Gemini models",
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
// Helper route to list available models
app.get("/list-models", async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey)
            return res.status(500).json({ error: "GEMINI_API_KEY not set" });
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to list models", details: String(error) });
    }
});
async function checkModelAvailability() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
        return;
    try {
        console.log("🔍 Checking model availability...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
            console.warn(`⚠️ Failed to fetch models list: ${response.statusText}`);
            return;
        }
        const data = await response.json();
        const models = data.models?.map((m) => m.name.replace("models/", "")) || [];
        if (models.length > 0) {
            if (!models.includes(currentModelName)) {
                console.warn(`⚠️ Configured model "${currentModelName}" not found in available models.`);
                // Try to find a good fallback
                const fallbacks = ["gemini-1.5-flash", "gemini-1.5-flash-001", "gemini-1.5-pro", "gemini-2.0-flash-exp"];
                const fallback = fallbacks.find(f => models.includes(f));
                if (fallback) {
                    console.log(`   -> Switching to available model: ${fallback}`);
                    currentModelName = fallback;
                }
                else {
                    // Filter out embedding models which cannot generate text
                    const generativeModels = models.filter((m) => !m.includes("embedding") && !m.includes("aqa"));
                    const bestGuess = generativeModels.length > 0 ? generativeModels[0] : "gemini-1.5-flash";
                    console.log(`   -> No preferred fallback found. Using: ${bestGuess}`);
                    currentModelName = bestGuess;
                }
            }
            else {
                console.log(`✓ Model "${currentModelName}" is available.`);
            }
        }
    }
    catch (e) {
        console.error("⚠️ Failed to check model availability:", e);
    }
}
app.listen(PORT, "0.0.0.0", async () => {
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
    }
    else {
        console.log(`✓ GEMINI_API_KEY is set (loaded from ${loadedEnvPath || "process environment"})`);
        if (process.env.ELEVENLABS_API_KEY) {
            console.log(`✓ ELEVENLABS_API_KEY is set`);
        }
        else {
            console.warn(`⚠️ ELEVENLABS_API_KEY is missing! Voice transcription will fail.`);
        }
        await checkModelAvailability();
        console.log(`✓ GEMINI_MODEL is set to: ${currentModelName}`);
        console.log("\n🚀 Server is ready and waiting for requests...");
    }
});
//# sourceMappingURL=index.js.map