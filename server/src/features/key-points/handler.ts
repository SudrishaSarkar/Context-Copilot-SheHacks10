import type { PagePayload } from "../../types.js";
import { getKeyPointsPrompt } from "./prompt.js";
import { callGeminiVision, processContentWithGemini } from "../../utils/gemini.js";

/**
 * Handle key points request
 * @param page - Page payload with content
 */
export async function handleKeyPoints(page: PagePayload): Promise<string> {
  const systemPrompt = getKeyPointsPrompt(page.contentType);

  try {
    if (page.contentType === "pdf_image" && page.imageBase64) {
      // Use Vision API for image-based PDFs
      const prompt = `${systemPrompt}

Please analyze this document image and extract the key takeaways.`;
      return await callGeminiVision(page.imageBase64, prompt);
    } else {
      // Use text API for text-based content
      return await processContentWithGemini(page, systemPrompt, "key points");
    }
  } catch (error) {
    console.error("Key points error:", error);
    throw error;
  }
}
