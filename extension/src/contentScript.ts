import type { ExtensionMessage, PagePayload, StructureItem } from "./types";

function detectSiteHint(url: string): "github" | "stackoverflow" | "generic" {
  if (url.includes("github.com")) return "github";
  if (url.includes("stackoverflow.com") || url.includes("stackexchange.com")) return "stackoverflow";
  return "generic";
}

function extractStructureWithOffsets(mainText: string): StructureItem[] {
  const structure: StructureItem[] = [];
  // querySelectorAll returns elements in document order, so no sorting needed
  const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4"));
  
  const mainTextLower = mainText.toLowerCase();

  // Find character offsets for each heading in mainText
  headings.forEach((heading, idx) => {
    const headingText = heading.textContent?.trim();
    if (!headingText) return;

    // Find the heading text in mainText
    const headingLower = headingText.toLowerCase();
    let startChar = mainTextLower.indexOf(headingLower);
    
    // If exact match not found, try to find a partial match or approximate position
    if (startChar === -1) {
      // Try first 30 characters
      const prefix = headingLower.substring(0, 30);
      startChar = mainTextLower.indexOf(prefix);
    }

    // Find end char (start of next heading or end of text)
    let endChar: number | undefined = undefined;
    if (idx < headings.length - 1) {
      const nextHeadingText = headings[idx + 1].textContent?.trim().toLowerCase();
      if (nextHeadingText) {
        const nextPos = mainTextLower.indexOf(nextHeadingText);
        if (nextPos !== -1) {
          endChar = nextPos;
        }
      }
    }

    structure.push({
      id: `sec_${idx}`,
      title: headingText,
      startChar: startChar !== -1 ? startChar : undefined,
      endChar,
    });
  });

  return structure;
}

// Enhanced extraction for GitHub
function extractGitHubContent(): { mainText: string; structure: StructureItem[] } {
  let mainText = "";
  const structure: StructureItem[] = [];

  // Try to find README content
  const readmeContent = document.querySelector("article.markdown-body, .markdown-body, [data-testid='readme-content']");
  if (readmeContent) {
    mainText = readmeContent.innerText || "";
  } else {
    // Fallback to body
    mainText = document.body.innerText || "";
  }

  // Extract headings from README or main content
  const headings = (readmeContent || document.body).querySelectorAll("h1, h2, h3, h4");
  let charOffset = 0;
  headings.forEach((heading, idx) => {
    const title = heading.textContent?.trim();
    if (!title) return;

    const headingText = heading.innerText || "";
    const startChar = mainText.indexOf(headingText, charOffset);
    
    structure.push({
      id: `sec_${idx}`,
      title,
      startChar: startChar !== -1 ? startChar : undefined,
    });
    
    if (startChar !== -1) {
      charOffset = startChar + headingText.length;
    }
  });

  return { mainText, structure };
}

// Enhanced extraction for StackOverflow
function extractStackOverflowContent(): { mainText: string; structure: StructureItem[] } {
  const parts: string[] = [];
  const structure: StructureItem[] = [];

  // Question title
  const questionTitle = document.querySelector("h1[data-aid='question_title'], .question-hyperlink");
  if (questionTitle) {
    const title = questionTitle.textContent?.trim() || "";
    parts.push(`QUESTION: ${title}`);
    structure.push({ id: "sec_question", title, startChar: 0 });
  }

  // Question body
  const questionBody = document.querySelector(".question .s-prose, .question .post-text");
  if (questionBody) {
    const bodyText = questionBody.innerText || "";
    parts.push(bodyText);
  }

  // Accepted answer
  const acceptedAnswer = document.querySelector(".accepted-answer .s-prose, .accepted-answer .post-text");
  if (acceptedAnswer) {
    const answerText = acceptedAnswer.innerText || "";
    parts.push(`\n\nACCEPTED ANSWER:\n${answerText}`);
    const startChar = parts.slice(0, -1).join("\n\n").length;
    structure.push({
      id: "sec_accepted_answer",
      title: "Accepted Answer",
      startChar,
    });
  }

  // Top answers
  const answers = document.querySelectorAll(".answer:not(.accepted-answer) .s-prose, .answer:not(.accepted-answer) .post-text");
  answers.forEach((answer, idx) => {
    if (idx >= 3) return; // Limit to top 3 additional answers
    const answerText = answer.innerText || "";
    parts.push(`\n\nANSWER ${idx + 1}:\n${answerText}`);
  });

  return { mainText: parts.join("\n\n"), structure };
}

function cleanText(text: string, maxLength: number = 80000): string {
  // Collapse whitespace but preserve some structure
  let cleaned = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  
  // Limit length
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength);
  }
  
  return cleaned;
}

function getPagePayload(): PagePayload {
  const selectedText = window.getSelection()?.toString().trim() || "";
  const title = document.title || "";
  const url = location.href || "";
  const siteHint = detectSiteHint(url);

  let mainText = "";
  let structure: StructureItem[] = [];

  // Site-specific extraction
  if (siteHint === "github") {
    const extracted = extractGitHubContent();
    mainText = cleanText(extracted.mainText, 80000);
    structure = extracted.structure;
  } else if (siteHint === "stackoverflow") {
    const extracted = extractStackOverflowContent();
    mainText = cleanText(extracted.mainText, 80000);
    structure = extracted.structure;
  } else {
    // Generic extraction
    mainText = cleanText(document.body.innerText || "", 80000);
    structure = extractStructureWithOffsets(mainText);
  }

  return {
    url,
    title,
    contentType: "html",
    selectedText: selectedText || undefined,
    mainText,
    structure: structure.length > 0 ? structure : undefined,
    meta: {
      siteHint,
      timestamp: Date.now(),
    },
  };
}

function findTextInDOM(text: string): { node: Text; startOffset: number; endOffset: number } | null {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  const searchText = text.toLowerCase().trim();
  // Use first 60 chars for better matching
  const searchPrefix = searchText.substring(0, 60);

  let node: Text | null;
  let bestMatch: { node: Text; startOffset: number; endOffset: number; score: number } | null = null;

  while ((node = walker.nextNode() as Text | null)) {
    if (!node.textContent) continue;

    const nodeText = node.textContent.toLowerCase();
    
    // Try exact match first
    const exactIndex = nodeText.indexOf(searchText);
    if (exactIndex !== -1) {
      return {
        node,
        startOffset: exactIndex,
        endOffset: exactIndex + text.length,
      };
    }

    // Try prefix match
    const prefixIndex = nodeText.indexOf(searchPrefix);
    if (prefixIndex !== -1) {
      // Calculate a score based on how much of the quote we matched
      const matchedLength = Math.min(searchPrefix.length, nodeText.length - prefixIndex);
      const score = matchedLength;
      
      if (!bestMatch || score > bestMatch.score) {
        const startOffset = prefixIndex;
        const endOffset = Math.min(
          nodeText.length,
          prefixIndex + Math.min(text.length + 50, nodeText.length - prefixIndex)
        );
        bestMatch = { node, startOffset, endOffset, score };
      }
    }
  }

  return bestMatch;
}

function jumpToSection(sectionId: string): void {
  // Try to find element by ID first
  const elementById = document.getElementById(sectionId);
  if (elementById) {
    elementById.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  // Try to find heading with matching text (for structure items)
  const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
  for (const heading of headings) {
    const headingId = heading.id || heading.getAttribute("data-id");
    if (headingId === sectionId) {
      heading.scrollIntoView({ behavior: "smooth", block: "center" });
      // Highlight briefly
      const originalBg = heading.style.backgroundColor;
      heading.style.backgroundColor = "#fef08a";
      setTimeout(() => {
        heading.style.backgroundColor = originalBg;
      }, 2000);
      return;
    }
  }

  console.warn("Could not find section:", sectionId);
}

function highlightQuote(quote: string, sectionId?: string, page?: number): void {
  // Remove existing highlights
  const existingMarks = document.querySelectorAll("mark[data-contextcopilot]");
  existingMarks.forEach((mark) => {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
      parent.normalize();
    }
  });

  // If sectionId is provided, try to jump to section first
  if (sectionId) {
    jumpToSection(sectionId);
  }

  // If page is provided for PDF, we'd handle it differently (would need PDF.js integration)
  if (page) {
    console.log("Page jump requested:", page);
    // PDF page jumping would be handled by PDF handler (separate implementation)
    // For now, we'll just try to find the quote in the current view
  }

  const match = findTextInDOM(quote);
  if (!match) {
    console.warn("Could not find quote in DOM:", quote.substring(0, 50));
    // If we have a section, at least we jumped there
    return;
  }

  const { node, startOffset, endOffset } = match;
  const range = document.createRange();
  range.setStart(node, startOffset);
  range.setEnd(node, Math.min(node.textContent!.length, endOffset));

  const mark = document.createElement("mark");
  mark.setAttribute("data-contextcopilot", "true");
  mark.style.backgroundColor = "#fef08a";
  mark.style.padding = "2px 4px";
  mark.style.borderRadius = "3px";
  mark.style.boxShadow = "0 0 0 2px #fde047";
  mark.style.transition = "all 0.2s";

  try {
    range.surroundContents(mark);
    mark.scrollIntoView({ behavior: "smooth", block: "center" });
    
    // Add a pulse animation
    mark.animate([
      { transform: "scale(1)", boxShadow: "0 0 0 2px #fde047" },
      { transform: "scale(1.02)", boxShadow: "0 0 0 4px #fde047" },
      { transform: "scale(1)", boxShadow: "0 0 0 2px #fde047" }
    ], {
      duration: 500,
      iterations: 2
    });
    
    // Remove highlight after 8 seconds
    setTimeout(() => {
      if (mark.parentNode) {
        const parent = mark.parentNode;
        const textNode = document.createTextNode(mark.textContent || "");
        parent.replaceChild(textNode, mark);
        parent.normalize();
      }
    }, 8000);
  } catch (err) {
    console.error("Error highlighting quote:", err);
    // Fallback: try to find and scroll to a nearby element containing the text
    if (node.parentElement) {
      node.parentElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    if (message.type === "GET_PAGE_PAYLOAD") {
      try {
        const payload = getPagePayload();
        sendResponse(payload);
      } catch (error) {
        console.error("Error getting page payload:", error);
        sendResponse({ error: "Failed to extract page content" });
      }
      return true; // Keep channel open for async response
    }

    if (message.type === "HIGHLIGHT_QUOTE") {
      try {
        highlightQuote(message.quote, message.sectionId, message.page);
        sendResponse({ success: true });
      } catch (error) {
        console.error("Error highlighting quote:", error);
        sendResponse({ success: false, error: String(error) });
      }
      return true;
    }

    if (message.type === "JUMP_TO_SECTION") {
      try {
        jumpToSection(message.sectionId);
        if (message.page) {
          console.log("Page jump requested:", message.page);
        }
        sendResponse({ success: true });
      } catch (error) {
        console.error("Error jumping to section:", error);
        sendResponse({ success: false, error: String(error) });
      }
      return true;
    }

    return false;
  }
);
