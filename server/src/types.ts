// Shared types - in production, import from shared/contracts
export interface PagePayload {
  url: string;
  title: string;
  contentType: "html" | "pdf_text";
  selectedText?: string;
  mainText: string;
  structure?: { id: string; title: string }[];
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
