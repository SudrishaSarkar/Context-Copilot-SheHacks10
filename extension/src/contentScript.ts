import type { ExtensionMessage, PagePayload } from "./types";

function extractStructure(): { id: string; title: string }[] {
  const structure: { id: string; title: string }[] = [];
  const headings = document.querySelectorAll("h1, h2, h3");

  headings.forEach((heading, idx) => {
    const text = heading.textContent?.trim();
    if (text) {
      structure.push({
        id: `heading-${idx}`,
        title: text,
      });
    }
  });

  return structure;
}

function cleanText(text: string, maxLength: number = 80000): string {
  // Collapse whitespace
  let cleaned = text.replace(/\s+/g, " ").trim();
  
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
  const mainText = cleanText(document.body.innerText || "", 80000);
  const structure = extractStructure();

  return {
    url,
    title,
    contentType: "html",
    selectedText: selectedText || undefined,
    mainText,
    structure: structure.length > 0 ? structure : undefined,
  };
}

function findTextInDOM(text: string): { node: Text; startOffset: number; endOffset: number } | null {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  const searchText = text.toLowerCase().trim();
  const searchFirst40 = searchText.substring(0, 40);

  let node: Text | null;
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

    // Try fuzzy match with first 40 chars
    const fuzzyIndex = nodeText.indexOf(searchFirst40);
    if (fuzzyIndex !== -1) {
      // Try to match a longer substring
      const startOffset = fuzzyIndex;
      const endOffset = Math.min(
        nodeText.length,
        fuzzyIndex + Math.min(text.length + 20, nodeText.length - fuzzyIndex)
      );
      return {
        node,
        startOffset,
        endOffset,
      };
    }
  }

  return null;
}

function highlightQuote(quote: string): void {
  // Remove existing highlights
  const existingMarks = document.querySelectorAll("mark[data-contextcopilot]");
  existingMarks.forEach((mark) => {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
      parent.normalize();
    }
  });

  const match = findTextInDOM(quote);
  if (!match) {
    console.warn("Could not find quote in DOM:", quote.substring(0, 50));
    return;
  }

  const { node, startOffset, endOffset } = match;
  const range = document.createRange();
  range.setStart(node, startOffset);
  range.setEnd(node, endOffset);

  const mark = document.createElement("mark");
  mark.setAttribute("data-contextcopilot", "true");
  mark.style.backgroundColor = "#fef08a";
  mark.style.padding = "2px 0";
  mark.style.borderRadius = "2px";
  mark.style.boxShadow = "0 0 0 2px #fde047";

  try {
    range.surroundContents(mark);
    mark.scrollIntoView({ behavior: "smooth", block: "center" });
    
    // Remove highlight after 5 seconds
    setTimeout(() => {
      if (mark.parentNode) {
        const parent = mark.parentNode;
        parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
        parent.normalize();
      }
    }, 5000);
  } catch (err) {
    console.error("Error highlighting quote:", err);
  }
}

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    if (message.type === "GET_PAGE_PAYLOAD") {
      const payload = getPagePayload();
      sendResponse(payload);
      return true; // Keep channel open for async response
    }

    if (message.type === "HIGHLIGHT_QUOTE") {
      highlightQuote(message.quote);
      sendResponse({ success: true });
      return true;
    }

    return false;
  }
);
