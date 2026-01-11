import type { PagePayload } from "../../types.js";
import { getExplainLike5Prompt } from "./prompt.js";
import { callGeminiVision, processContentWithGemini } from "../../utils/gemini.js";

/**
 * Handle "Explain Like I'm 5" request
 * @param page - Page payload with content
 */
export async function handleExplainLike5(page: PagePayload): Promise<string> {
  const systemPrompt = getExplainLike5Prompt(page.contentType);

  try {
    if (page.contentType === "pdf_image" && page.imageBase64) {
      // Use Vision API for image-based PDFs
      const prompt = `${systemPrompt}

Please analyze this document image and explain it in simple, child-friendly language with analogies.`;
      return await callGeminiVision(page.imageBase64, prompt);
    } else {
      // Use text API for text-based content
      return await processContentWithGemini(page, systemPrompt, "explanation");
    }
  } catch (error) {
    console.error("Explain Like I'm 5 error:", error);
    throw error;
  }
}
