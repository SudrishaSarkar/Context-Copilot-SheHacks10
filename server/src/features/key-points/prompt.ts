import type { PagePayload } from "../../types.js";

/**
 * Generate system prompt for key points feature
 */
export function getKeyPointsPrompt(
  contentType: PagePayload["contentType"]
): string {
  const documentType =
    contentType === "pdf_image"
      ? "Scanned/Image-based document"
      : contentType === "pdf_text"
      ? "Text-based PDF document"
      : "Web page";

  return `You are an expert document analysis assistant. Your task is to extract the key takeaways from the provided document.

DOCUMENT TYPE: ${documentType}

OUTPUT FORMAT: Provide a list of key takeaways as bullet points (use • for each bullet). Include:
- Most important points and main insights
- Critical information that should be remembered
- Key dates, numbers, or figures
- Important conclusions or findings
- Essential details that stand out

INSTRUCTIONS:
1. Analyze the entire document thoroughly
2. Identify the most important takeaways
3. Extract 5-8 key points (prioritize quality over quantity)
4. Use simple, clear language
5. Preserve critical details like dates, amounts, names, and deadlines
6. Focus on actionable or memorable information

OUTPUT REQUIREMENTS:
- Format as bullet points using • (bullet character)
- NO sub-bullets or nested points (only top-level bullets)
- Each bullet should be concise but informative (1-2 sentences max)
- Be accurate and faithful to the source material
- Prioritize the most important information
- Make it scannable and easy to read`;
}
