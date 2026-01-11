import { GoogleGenerativeAI } from "@google/generative-ai";
import type { PagePayload } from "../types.js";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

/**
 * Chunk text into smaller pieces for processing
 */
export function chunkText(text: string, chunkSize: number = 1800): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Call Gemini Vision API for image-based PDFs
 */
export async function callGeminiVision(
  imageBase64: string,
  prompt: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set in environment");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

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

/**
 * Get Gemini model instance for text generation
 */
export function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set in environment");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: GEMINI_MODEL });
}

/**
 * Process content with Gemini API, handling long content by chunking
 */
export async function processContentWithGemini(
  page: PagePayload,
  systemPrompt: string,
  formatName: string
): Promise<string> {
  const model = getGeminiModel();

  // If selectedText exists, use it; otherwise use mainText
  let content = page.selectedText || page.mainText;

  // If content is too long, process in chunks
  if (content.length > 50000) {
    const chunks = chunkText(content, 40000);
    const chunkResults: string[] = [];

    for (const chunk of chunks) {
      const chunkPrompt = `${systemPrompt}

DOCUMENT CONTENT:
${chunk}

Provide the output in the requested format.`;
      const result = await model.generateContent(chunkPrompt);
      const response = await result.response;
      chunkResults.push(response.text());
    }

    // Final synthesis
    const finalPrompt = `You have been given results from different sections of a document. Combine them into a single, cohesive ${formatName} that maintains consistency and covers all important information.

SECTION RESULTS:
${chunkResults.join("\n\n---SECTION BREAK---\n\n")}

Create a unified, well-organized ${formatName} that integrates all the information above.`;
    const finalResult = await model.generateContent(finalPrompt);
    return finalResult.response.text();
  } else {
    const prompt = `${systemPrompt}

DOCUMENT CONTENT:
${content}

${
  page.structure
    ? `Document Structure:\n${page.structure
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
