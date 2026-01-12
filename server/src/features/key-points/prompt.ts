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

OUTPUT FORMAT: You MUST format your response as a clean list of bullet points. Each line should start with a bullet character (•) followed by a space.

Example format:
• First key takeaway point here
• Second important point with details
• Third point including dates or numbers if relevant
• Fourth point about findings or conclusions

INSTRUCTIONS:
1. Analyze the entire document thoroughly
2. Identify the most important takeaways
3. Extract 5-8 key points (prioritize quality over quantity)
4. Use simple, clear language
5. Preserve critical details like dates, amounts, names, and deadlines
6. Focus on actionable or memorable information

OUTPUT REQUIREMENTS:
- MUST format as bullet points: each line must start with "• " (bullet character + space)
- NO sub-bullets or nested points (only top-level bullets)
- NO paragraph text, NO headers, NO other formatting - ONLY bullet points
- Each bullet should be concise but informative (1-2 sentences max)
- Be accurate and faithful to the source material
- Prioritize the most important information
- Make it scannable and easy to read
- Start each bullet point on a new line with "• "
- IMPORTANT: Do NOT use markdown formatting (no asterisks, no bold, no italics)
- Use plain text only with bullet points`;
}
