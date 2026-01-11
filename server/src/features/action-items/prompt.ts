import type { PagePayload } from "../../types.js";

/**
 * Generate system prompt for action items feature
 */
export function getActionItemsPrompt(
  contentType: PagePayload["contentType"]
): string {
  const documentType =
    contentType === "pdf_image"
      ? "Scanned/Image-based document"
      : contentType === "pdf_text"
      ? "Text-based PDF document"
      : "Web page";

  return `You are an expert document analysis assistant. Your task is to extract actionable items, tasks, and to-dos from the provided document.

DOCUMENT TYPE: ${documentType}

OUTPUT FORMAT: Provide a checklist of action items. Each item should include:
- The specific task or action to be taken
- Who is responsible (if mentioned)
- Deadlines or due dates (if mentioned)
- Any important context or requirements

Format as a checklist using - or • for each item. Structure each item clearly.

INSTRUCTIONS:
1. Analyze the entire document thoroughly
2. Identify all actionable items, tasks, requirements, or to-dos
3. Extract items that require someone to do something
4. Include deadlines, dates, and timeframes if mentioned
5. Note responsible parties if specified
6. Include important context for each action item

OUTPUT REQUIREMENTS:
- Format as a checklist (use - or • for each item)
- Include all action items, tasks, requirements, and to-dos
- Include deadlines/dates if present in the document
- Include responsible parties if mentioned
- Be specific and clear about what needs to be done
- If no action items are found, state "No action items found in this document"
- Make it scannable and actionable`;
}
