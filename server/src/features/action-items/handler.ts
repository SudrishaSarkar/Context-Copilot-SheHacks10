import type { PagePayload } from "../../types.js";
import { getActionItemsPrompt } from "./prompt.js";
import { callGeminiVision, processContentWithGemini } from "../../utils/gemini.js";

/**
 * Handle action items request
 * @param page - Page payload with content
 */
export async function handleActionItems(page: PagePayload): Promise<string> {
  const systemPrompt = getActionItemsPrompt(page.contentType);

  try {
    if (page.contentType === "pdf_image" && page.imageBase64) {
      // Use Vision API for image-based PDFs
      const prompt = `${systemPrompt}

Please analyze this document image and extract all actionable items, tasks, and to-dos.`;
      return await callGeminiVision(page.imageBase64, prompt);
    } else {
      // Use text API for text-based content
      return await processContentWithGemini(page, systemPrompt, "action items");
    }
  } catch (error) {
    console.error("Action items error:", error);
    throw error;
  }
}
