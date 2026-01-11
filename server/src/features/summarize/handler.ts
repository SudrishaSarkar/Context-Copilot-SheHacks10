import type { PagePayload } from "../../types.js";
import { getSummarizePrompt } from "./prompt.js";
import { callGeminiVision, processContentWithGemini } from "../../utils/gemini.js";

/**
 * Handle summarize request
 * @param page - Page payload with content
 * @param detailLevel - "brief" or "detailed"
 */
export async function handleSummarize(
  page: PagePayload,
  detailLevel: "brief" | "detailed"
): Promise<string> {
  const systemPrompt = getSummarizePrompt(page.contentType, detailLevel);

  try {
    if (page.contentType === "pdf_image" && page.imageBase64) {
      // Use Vision API for image-based PDFs
      const prompt = `${systemPrompt}

Please analyze this document image and provide the requested summary format.`;
      return await callGeminiVision(page.imageBase64, prompt);
    } else {
      // Use text API for text-based content
      return await processContentWithGemini(page, systemPrompt, "summary");
    }
  } catch (error) {
    console.error("Summarize error:", error);
    throw error;
  }
}
