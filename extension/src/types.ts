// Shared types matching shared/contracts.ts
// In a production setup, this would import from the shared directory
export interface PagePayload {
  url: string;
  title: string;
  contentType: "html" | "pdf_text" | "pdf_image";
  selectedText?: string;
  mainText: string;
  structure?: { 
    id: string; 
    title: string;
    startChar?: number;
    endChar?: number;
    page?: number;
  }[];
  meta?: {
    siteHint?: "github" | "stackoverflow" | "youtube" | "generic";
    timestamp?: number;
  };
}

export interface AskRequest {
  question: string;
  page: PagePayload;
}

export interface Citation {
  quote: string;
  sectionHint?: string;
  confidence?: number;
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
}

export type ExtensionMessage =
  | { type: "GET_PAGE_PAYLOAD" }
  | { type: "HIGHLIGHT_QUOTE"; quote: string };

export interface HistoryItem {
  id: string;
  timestamp: number;
  url: string;
  title: string;
  mode: "page-qa" | "quick-actions" | "youtube" | "email-tone";
  question?: string;
  answer: string;
  citations?: Citation[];
}

export interface HistoryResponse {
  items: HistoryItem[];
}
