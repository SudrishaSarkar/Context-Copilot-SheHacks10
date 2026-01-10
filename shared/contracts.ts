export interface StructureItem {
  id: string;
  title: string;
  startChar?: number;
  endChar?: number;
  page?: number;
}

export interface PagePayload {
  url: string;
  title: string;
  contentType: "html" | "pdf_text" | "pdf_image";
  selectedText?: string;
  mainText: string;
  structure?: StructureItem[];
  meta?: {
    siteHint?: "github" | "stackoverflow" | "generic";
    timestamp?: number;
  };
}

export interface AskRequest {
  question: string;
  page: PagePayload;
}

export interface Citation {
  quote: string;
  sectionId?: string;
  sectionHint?: string;
  page?: number;
  confidence?: number;
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
  followups?: string[];
}

export interface SummarizeResponse {
  summary: string;
  structure: StructureItem[];
}

export type ExtensionMessage =
  | { type: "GET_PAGE_PAYLOAD" }
  | { type: "HIGHLIGHT_QUOTE"; quote: string; sectionId?: string; page?: number }
  | { type: "JUMP_TO_SECTION"; sectionId: string; page?: number };
