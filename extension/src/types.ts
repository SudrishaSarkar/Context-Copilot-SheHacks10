export type ExtensionMessage =
  | { type: "GET_PAGE_PAYLOAD" }
  | { type: "HIGHLIGHT_QUOTE"; quote: string };

export interface PagePayload {
  url: string;
  title: string;
  text: string;
}

export interface Citation {
  quote: string;
  source?: string; // optional if your backend includes it
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
}

