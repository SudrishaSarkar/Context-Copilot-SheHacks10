import type { ExtensionMessage, PagePayload } from "./types";

// PDF.js imports - dynamically import to avoid bundling issues
let pdfjsLib: any = null;
async function getPdfjsLib() {
  if (!pdfjsLib) {
    try {
      // @ts-ignore - dynamic import of PDF.js
      pdfjsLib = await import("pdfjs-dist");
      // Set worker source for PDF.js
      if (typeof window !== "undefined" && pdfjsLib?.GlobalWorkerOptions) {
        // Try multiple possible paths for the worker
        const workerPaths = [
          "pdfjs/pdf.worker.min.mjs",
          "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
        ];
        
        for (const workerPath of workerPaths) {
          try {
            const url = chrome.runtime.getURL(workerPath);
            pdfjsLib.GlobalWorkerOptions.workerSrc = url;
            break;
          } catch (e) {
            // Try next path
          }
        }
        
        // Fallback to CDN if local worker not found
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = 
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.mjs";
        }
      }
    } catch (error) {
      console.error("Failed to load PDF.js:", error);
      throw error;
    }
  }
  return pdfjsLib;
}

// Detect if we're on a PDF viewer page
function isPDFViewer(): boolean {
  return (
    window.location.href.endsWith(".pdf") ||
    document.contentType === "application/pdf" ||
    document.querySelector("embed[type='application/pdf']") !== null ||
    document.querySelector("object[type='application/pdf']") !== null
  );
}

// Extract text from PDF using PDF.js
async function extractPDFText(): Promise<{
  text: string;
  structure: PagePayload["structure"];
  contentType: "pdf_text" | "pdf_image";
}> {
  try {
    const pdfjs = await getPdfjsLib();
    const loadingTask = pdfjs.getDocument(window.location.href);

    const pdf = await loadingTask.promise;
    let fullText = "";
    const structure: PagePayload["structure"] = [];
    let currentCharOffset = 0;

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText =
        textContent.items
          .map((item: any) => {
            if (item.str) return item.str;
            return "";
          })
          .join(" ") + "\n\n";

      const pageStartChar = currentCharOffset;
      fullText += `Page ${pageNum}:\n${pageText}`;
      currentCharOffset += pageText.length;

      // Try to detect headings (heuristic: uppercase, bold-ish, or numbered)
      const lines = pageText.split("\n");
      let lastHeading: { id: string; title: string; startChar: number; page: number } | null = null;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Heuristic: uppercase text, or numbered headings (like "1.", "1.1", etc.)
        const isNumberedHeading = /^\d+(\.\d+)*\s+[A-Z]/.test(trimmed);
        const isUppercaseHeading =
          trimmed.length > 3 &&
          trimmed.length < 100 &&
          trimmed === trimmed.toUpperCase() &&
          /^[A-Z]/.test(trimmed);

        if (isNumberedHeading || isUppercaseHeading) {
          const headingText = trimmed.substring(0, 100); // Limit heading length
          const headingId = `sec_${structure.length + 1}`;
          const headingStartChar = pageStartChar + fullText.indexOf(trimmed);

          if (lastHeading) {
            lastHeading.endChar = headingStartChar;
          }

          lastHeading = {
            id: headingId,
            title: headingText,
            startChar: headingStartChar,
            page: pageNum,
          };
          structure.push(lastHeading);
        }
      }

      if (lastHeading) {
        lastHeading.endChar = currentCharOffset;
      }
    }

    // If we got meaningful text, return pdf_text, otherwise pdf_image
    const hasEnoughText = fullText.trim().length > 100;
    return {
      text: fullText.trim(),
      structure: structure.length > 0 ? structure : undefined,
      contentType: hasEnoughText ? "pdf_text" : "pdf_image",
    };
  } catch (error) {
    console.error("PDF extraction error:", error);
    // If PDF extraction fails, it's likely an image/scanned PDF
    return {
      text: "",
      structure: undefined,
      contentType: "pdf_image",
    };
  }
}

// Extract content from GitHub pages
function extractGitHubContent(): { text: string; structure: PagePayload["structure"] } {
  let text = "";
  const structure: PagePayload["structure"] = [];
  let currentCharOffset = 0;

  // Extract README content
  const readmeContent = document.querySelector("#readme article, .markdown-body, [data-testid='readme-container']");
  if (readmeContent) {
    const readmeText = readmeContent.textContent || "";
    text += readmeText + "\n\n";
    currentCharOffset = readmeText.length;

    // Extract headings from README
    const headings = readmeContent.querySelectorAll("h1, h2, h3, h4");
    headings.forEach((heading, idx) => {
      const headingText = heading.textContent?.trim() || "";
      if (headingText) {
        const headingPos = readmeText.indexOf(headingText);
        structure.push({
          id: `github_heading_${idx}`,
          title: headingText,
          startChar: headingPos >= 0 ? headingPos : currentCharOffset,
          endChar: headingPos >= 0 ? headingPos + headingText.length : currentCharOffset + headingText.length,
        });
      }
    });
  }

  // Extract PR/Issue description
  const prDescription = document.querySelector(".comment-body, .js-comment-body, .markdown-body");
  if (prDescription && !readmeContent?.contains(prDescription)) {
    const prText = prDescription.textContent || "";
    text += prText + "\n\n";
  }

  // If we didn't find specific containers, fall back to body
  if (!text.trim()) {
    const bodyText = document.body.textContent || "";
    text = bodyText;
  }

  return { text, structure };
}

// Extract YouTube transcript (only if transcript panel is open)
function extractYouTubeTranscript(): string {
  // YouTube transcript panel selectors (common patterns)
  // Try different selectors as YouTube may change them
  const transcriptSelectors = [
    "ytd-transcript-body-renderer",
    "ytd-transcript-search-panel-renderer",
    "[id*='transcript']",
    ".ytd-transcript-body-renderer",
  ];

  let transcriptText = "";

  // Try to find transcript container
  for (const selector of transcriptSelectors) {
    const transcriptContainer = document.querySelector(selector);
    if (transcriptContainer) {
      // Extract text from transcript segments
      const segments = transcriptContainer.querySelectorAll(
        "ytd-transcript-segment-renderer, .segment-text, [class*='segment']"
      );
      
      if (segments.length > 0) {
        segments.forEach((segment) => {
          const text = segment.textContent?.trim() || "";
          if (text) {
            transcriptText += text + " ";
          }
        });
        break;
      } else {
        // Fallback: get all text from container
        transcriptText = transcriptContainer.textContent || "";
        if (transcriptText.trim().length > 50) {
          break;
        }
      }
    }
  }

  // If no transcript found via selectors, try searching for common transcript text patterns
  if (!transcriptText.trim()) {
    // Look for any element containing transcript-like content
    const allElements = document.querySelectorAll("*");
    for (const el of allElements) {
      const text = el.textContent || "";
      // Heuristic: transcript segments usually have timestamps and text
      if (text.match(/\d{1,2}:\d{2}/) && text.length > 100 && text.length < 50000) {
        const parent = el.closest('[id*="transcript"], [class*="transcript"]');
        if (parent) {
          transcriptText = parent.textContent || "";
          break;
        }
      }
    }
  }

  return transcriptText.trim();
}

// Extract content from StackOverflow pages
function extractStackOverflowContent(): { text: string; structure: PagePayload["structure"] } {
  let text = "";
  const structure: PagePayload["structure"] = [];
  let currentCharOffset = 0;

  // Extract question title
  const questionTitle = document.querySelector("h1 a.question-hyperlink, h1[itemprop='name']");
  if (questionTitle) {
    const titleText = questionTitle.textContent?.trim() || "";
    text += `Question: ${titleText}\n\n`;
    structure.push({
      id: "so_question_title",
      title: titleText,
      startChar: 0,
      endChar: titleText.length,
    });
    currentCharOffset = text.length;
  }

  // Extract question body
  const questionBody = document.querySelector(
    ".question .s-prose, .question .post-text, [itemprop='text']"
  );
  if (questionBody) {
    const bodyText = questionBody.textContent || "";
    text += `Question Body:\n${bodyText}\n\n`;
    structure.push({
      id: "so_question_body",
      title: "Question Body",
      startChar: currentCharOffset,
      endChar: currentCharOffset + bodyText.length,
    });
    currentCharOffset = text.length;
  }

  // Extract accepted answer
  const acceptedAnswer = document.querySelector(
    ".answer.accepted-answer .s-prose, .answer.accepted-answer .post-text"
  );
  if (acceptedAnswer) {
    const answerText = acceptedAnswer.textContent || "";
    text += `Accepted Answer:\n${answerText}\n\n`;
    structure.push({
      id: "so_accepted_answer",
      title: "Accepted Answer",
      startChar: currentCharOffset,
      endChar: currentCharOffset + answerText.length,
    });
    currentCharOffset = text.length;
  }

  // Extract top answers
  const topAnswers = document.querySelectorAll(
    ".answer:not(.accepted-answer) .s-prose, .answer:not(.accepted-answer) .post-text"
  );
  topAnswers.forEach((answer, idx) => {
    if (idx < 3) {
      // Limit to top 3 additional answers
      const answerText = answer.textContent || "";
      text += `Answer ${idx + 1}:\n${answerText}\n\n`;
      structure.push({
        id: `so_answer_${idx + 1}`,
        title: `Answer ${idx + 1}`,
        startChar: currentCharOffset,
        endChar: currentCharOffset + answerText.length,
      });
      currentCharOffset = text.length;
    }
  });

  // Fallback to body if nothing found
  if (!text.trim()) {
    text = document.body.textContent || "";
  }

  return { text, structure };
}

// Extract structure from generic HTML pages with character offsets
function extractStructureWithOffsets(mainText: string): PagePayload["structure"] {
  const structure: PagePayload["structure"] = [];
  const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");

  headings.forEach((heading, idx) => {
    const text = heading.textContent?.trim();
    if (!text) return;

    // Find the position of this heading text in mainText
    const headingPos = mainText.toLowerCase().indexOf(text.toLowerCase());
    if (headingPos !== -1) {
      // Find the next heading position (or end of text)
      let endChar = mainText.length;
      if (idx < headings.length - 1) {
        const nextHeading = headings[idx + 1];
        const nextText = nextHeading.textContent?.trim();
        if (nextText) {
          const nextPos = mainText.toLowerCase().indexOf(nextText.toLowerCase(), headingPos + text.length);
          if (nextPos !== -1) {
            endChar = nextPos;
          }
        }
      }

      structure.push({
        id: `heading_${idx}`,
        title: text,
        startChar: headingPos,
        endChar,
      });
    }
  });

  return structure.length > 0 ? structure : undefined;
}

function cleanText(text: string, maxLength: number = 80000): string {
  // Collapse whitespace but preserve paragraph breaks
  let cleaned = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  // Limit length
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength);
  }

  return cleaned;
}

// Detect site type
function detectSiteHint(url: string): "github" | "stackoverflow" | "youtube" | "generic" {
  if (url.includes("github.com")) return "github";
  if (url.includes("stackoverflow.com") || url.includes("stackexchange.com")) return "stackoverflow";
  if (url.includes("youtube.com/watch") || url.includes("youtu.be/")) return "youtube";
  return "generic";
}

// Check if URL is a YouTube watch page
function isYouTubeWatchPage(url: string): boolean {
  return url.includes("youtube.com/watch") || url.includes("youtu.be/");
}

async function getPagePayload(): Promise<PagePayload> {
  const selectedText = window.getSelection()?.toString().trim() || "";
  const title = document.title || "";
  const url = location.href || "";
  const siteHint = detectSiteHint(url);

  // Check if it's a PDF
  if (isPDFViewer()) {
    const pdfResult = await extractPDFText();
    return {
      url,
      title,
      contentType: pdfResult.contentType,
      selectedText: selectedText || undefined,
      mainText: pdfResult.text || selectedText || "",
      structure: pdfResult.structure,
      meta: {
        siteHint: "generic",
        timestamp: Date.now(),
      },
    };
  }

  // Extract HTML content based on site type
  let mainText = "";
  let structure: PagePayload["structure"] = undefined;

  if (selectedText) {
    // If user has selected text, prioritize that with minimal context
    mainText = selectedText;
  } else if (siteHint === "github") {
    const githubContent = extractGitHubContent();
    mainText = githubContent.text;
    structure = githubContent.structure;
  } else if (siteHint === "stackoverflow") {
    const soContent = extractStackOverflowContent();
    mainText = soContent.text;
    structure = soContent.structure;
  } else if (siteHint === "youtube") {
    // For YouTube, try to extract transcript if available
    const transcript = extractYouTubeTranscript();
    if (transcript) {
      mainText = transcript;
    } else {
      // Fallback to page title and description
      const title = document.querySelector("h1.ytd-watch-metadata yt-formatted-string, h1.title yt-formatted-string")?.textContent || "";
      const description = document.querySelector("#description-text, ytd-video-secondary-info-renderer")?.textContent || "";
      mainText = (title ? `Title: ${title}\n\n` : "") + (description ? `Description: ${description}` : "");
    }
  } else {
    // Generic HTML extraction
    mainText = document.body.textContent || "";
    structure = extractStructureWithOffsets(mainText);
  }

  // Clean and limit text
  mainText = cleanText(mainText, 80000);

  // If we have structure but no offsets, try to compute them
  if (structure && structure.some((s) => s.startChar === undefined)) {
    structure = extractStructureWithOffsets(mainText);
  }

  return {
    url,
    title,
    contentType: "html",
    selectedText: selectedText || undefined,
    mainText,
    structure,
    meta: {
      siteHint,
      timestamp: Date.now(),
    },
  };
}

// Improved fuzzy text matching for quotes
function findTextInDOM(text: string): { node: Text; startOffset: number; endOffset: number } | null {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip script and style tags
        const parent = node.parentElement;
        if (
          parent &&
          (parent.tagName === "SCRIPT" ||
            parent.tagName === "STYLE" ||
            parent.closest("script") ||
            parent.closest("style"))
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const searchText = text.trim().toLowerCase();
  const normalizedSearch = searchText.replace(/\s+/g, " ");

  // Try exact match first
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    if (!node.textContent) continue;
    const nodeText = node.textContent.toLowerCase().replace(/\s+/g, " ");

    const exactIndex = nodeText.indexOf(normalizedSearch);
    if (exactIndex !== -1) {
      // Map back to original offset accounting for whitespace normalization
      let originalOffset = 0;
      let normalizedOffset = 0;
      const originalText = node.textContent;

      while (normalizedOffset < exactIndex && originalOffset < originalText.length) {
        const char = originalText[originalOffset];
        if (/\s/.test(char)) {
          // Skip whitespace in original
          originalOffset++;
        } else {
          originalOffset++;
          normalizedOffset++;
        }
      }

      return {
        node,
        startOffset: originalOffset,
        endOffset: originalOffset + text.length,
      };
    }
  }

  // Try fuzzy match - look for first 50 chars
  walker.currentNode = document.body;
  const fuzzySearch = normalizedSearch.substring(0, Math.min(50, normalizedSearch.length));

  while ((node = walker.nextNode() as Text | null)) {
    if (!node.textContent) continue;
    const nodeText = node.textContent.toLowerCase().replace(/\s+/g, " ");

    const fuzzyIndex = nodeText.indexOf(fuzzySearch);
    if (fuzzyIndex !== -1) {
      // Try to match a reasonable length
      const matchLength = Math.min(text.length + 50, nodeText.length - fuzzyIndex);
      const startOffset = fuzzyIndex;
      const endOffset = startOffset + matchLength;

      return {
        node,
        startOffset: Math.min(startOffset, node.textContent.length),
        endOffset: Math.min(endOffset, node.textContent.length),
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
    // Try to find a partial match as fallback
    const words = quote.trim().split(/\s+/).slice(0, 5).join(" ");
    const partialMatch = findTextInDOM(words);
    if (partialMatch) {
      const { node, startOffset, endOffset } = partialMatch;
      const range = document.createRange();
      range.setStart(node, Math.max(0, startOffset));
      range.setEnd(node, Math.min(node.textContent?.length || 0, endOffset));

      try {
        const mark = document.createElement("mark");
        mark.setAttribute("data-contextcopilot", "true");
        mark.style.backgroundColor = "#fef08a";
        mark.style.padding = "2px 0";
        mark.style.borderRadius = "2px";
        mark.style.boxShadow = "0 0 0 2px #fde047";
        range.surroundContents(mark);
        mark.scrollIntoView({ behavior: "smooth", block: "center" });

        setTimeout(() => {
          if (mark.parentNode) {
            const parent = mark.parentNode;
            parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
            parent.normalize();
          }
        }, 5000);
      } catch (err) {
        console.error("Error highlighting partial quote:", err);
      }
    }
    return;
  }

  const { node, startOffset, endOffset } = match;
  const range = document.createRange();

  // Ensure offsets are valid
  const maxOffset = node.textContent?.length || 0;
  const safeStart = Math.max(0, Math.min(startOffset, maxOffset));
  const safeEnd = Math.max(safeStart, Math.min(endOffset, maxOffset));

  range.setStart(node, safeStart);
  range.setEnd(node, safeEnd);

  const mark = document.createElement("mark");
  mark.setAttribute("data-contextcopilot", "true");
  mark.style.backgroundColor = "#fef08a";
  mark.style.padding = "2px 0";
  mark.style.borderRadius = "2px";
  mark.style.boxShadow = "0 0 0 2px #fde047";

  try {
    range.surroundContents(mark);
    mark.scrollIntoView({ behavior: "smooth", block: "center" });

    // Remove highlight after 10 seconds (increased from 5)
    setTimeout(() => {
      if (mark.parentNode) {
        const parent = mark.parentNode;
        parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
        parent.normalize();
      }
    }, 10000);
  } catch (err) {
    console.error("Error highlighting quote:", err);
  }
}

// Message listener
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    if (message.type === "GET_PAGE_PAYLOAD") {
      // Async response needed for PDF extraction
      getPagePayload()
        .then((payload) => sendResponse(payload))
        .catch((error) => {
          console.error("Error getting page payload:", error);
          sendResponse({
            url: location.href,
            title: document.title,
            contentType: "html" as const,
            mainText: document.body.textContent || "",
            meta: { timestamp: Date.now() },
          });
        });
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
