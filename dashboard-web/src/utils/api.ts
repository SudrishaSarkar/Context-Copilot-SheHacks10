/**
 * API utility for dashboard
 * Handles all backend API calls
 */

const API_BASE_URL = "http://localhost:8787";

export interface HistoryItem {
  _id: string;
  userId: string;
  timestamp: string;
  requestType: "ask" | "summarize" | "key-points" | "explain-like-5" | "action-items";
  pageUrl: string;
  pageTitle: string;
  contentType: string;
  input: {
    question?: string;
    detailLevel?: string;
    selectedText?: string;
    mainTextPreview?: string;
  };
  output: {
    answer?: string;
    summary?: string;
    keyPoints?: string;
    explanation?: string;
    actionItems?: string;
    citations?: Array<{
      quote: string;
      sectionHint?: string;
      confidence?: number;
    }>;
  };
  responseTime: number;
  modelUsed: string;
  success: boolean;
}

export interface HistoryResponse {
  history: HistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface SessionResponse {
  userId: string;
  email?: string;
  createdAt: string;
  lastActive: string;
  stats: {
    totalInteractions: number;
    requestTypeBreakdown: Record<string, number>;
    pagesInteracted: number;
  };
}

/**
 * Get chat history for a user
 */
export async function getHistory(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    requestType?: string;
    search?: string;
  }
): Promise<HistoryResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.offset) params.append("offset", options.offset.toString());
  if (options?.requestType) params.append("requestType", options.requestType);
  if (options?.search) params.append("search", options.search);

  const response = await fetch(
    `${API_BASE_URL}/api/history/${userId}?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch history: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get a single history entry
 */
export async function getHistoryEntry(
  userId: string,
  historyId: string
): Promise<HistoryItem> {
  const response = await fetch(
    `${API_BASE_URL}/api/history/${userId}/${historyId}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch history entry: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Delete a history entry
 */
export async function deleteHistoryEntry(
  userId: string,
  historyId: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/history/${userId}/${historyId}`,
    { method: "DELETE" }
  );

  if (!response.ok) {
    throw new Error(`Failed to delete history entry: ${response.statusText}`);
  }
}

/**
 * Get user session and statistics
 */
export async function getSession(userId: string): Promise<SessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${userId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch session: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Create or get user session
 */
export async function createSession(
  userId: string,
  email?: string
): Promise<SessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, email }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.statusText}`);
  }

  return response.json();
}
