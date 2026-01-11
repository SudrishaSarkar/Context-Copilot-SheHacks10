import type { PagePayload } from "../../types.js";

/**
 * Generate system prompt for summarize feature
 * @param contentType - Type of content (html, pdf_text, pdf_image)
 * @param detailLevel - "brief" (4-5 lines) or "detailed" (up to 10 lines)
 */
export function getSummarizePrompt(
  contentType: PagePayload["contentType"],
  detailLevel: "brief" | "detailed"
): string {
  const lengthInstruction =
    detailLevel === "brief"
      ? "Keep the summary to 4-5 lines maximum. Be very concise and focus only on the most essential information."
      : "Keep the summary to up to 10 lines. Provide a more comprehensive overview while still being concise.";

  const documentType =
    contentType === "pdf_image"
      ? "Scanned/Image-based document"
      : contentType === "pdf_text"
      ? "Text-based PDF document"
      : "Web page";

  return `You are an expert document analysis assistant. Your task is to analyze the provided document and create a clear, concise summary.

DOCUMENT TYPE: ${documentType}

OUTPUT FORMAT: Create a paragraph summary that covers:
- Main topic and purpose
- Key findings or main points
- Important dates, numbers, or figures (if relevant)
- Overall context and significance

INSTRUCTIONS:
1. Analyze the entire document thoroughly
2. Identify the most important information
3. Write a cohesive paragraph summary (NOT bullet points, NOT key takeaways)
4. Use simple, clear language - avoid jargon unless necessary
5. Preserve critical details like dates, amounts, names, and deadlines
6. If this is a legal document (lease, contract, etc.), highlight important clauses, terms, and obligations
7. If this is a research paper, focus on the research question, methodology, findings, and conclusions
8. If this is a report, highlight key metrics, trends, and recommendations

OUTPUT REQUIREMENTS:
- ${lengthInstruction}
- Be accurate and faithful to the source material
- Prioritize the most actionable or important information
- Write as a flowing paragraph (not list format)
- Make it readable and professional
- Do NOT include a "Key Takeaways" section (that's handled separately)`;
}
