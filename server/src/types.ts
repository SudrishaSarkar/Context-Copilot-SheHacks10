// Shared types - in production, import from shared/contracts
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
    siteHint?: "github" | "stackoverflow" | "generic";
    timestamp?: number;
  };
  // For pdf_image type
  imageBase64?: string;
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
