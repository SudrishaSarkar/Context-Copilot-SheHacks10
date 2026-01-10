import React, { useState } from "react";
import type { PagePayload, AskResponse, ExtensionMessage, Citation } from "./types";

const API_URL = process.env.VITE_API_URL || "http://localhost:8787";

export default function Popup() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSummarize, setLoadingSummarize] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const getPagePayload = async (): Promise<PagePayload> => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      throw new Error("No active tab found");
    }

    const pagePayload = await chrome.tabs.sendMessage<ExtensionMessage, PagePayload>(
      tab.id,
      { type: "GET_PAGE_PAYLOAD" }
    );

    if (!pagePayload) {
      throw new Error("Failed to get page content");
    }

    return pagePayload;
  };

  const handleAsk = async () => {
    if (!question.trim()) {
      setError("Please enter a question");
      return;
    }

    setLoading(true);
    setError(null);
    setAnswer(null);
    setCitations([]);
    setSummary(null);

    try {
      const pagePayload = await getPagePayload();

      // Send request to backend
      const response = await fetch(`${API_URL}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question.trim(),
          page: pagePayload,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.statusText}`);
      }

      const data: AskResponse = await response.json();
      setAnswer(data.answer);
      setCitations(data.citations || []);
    } catch (err) {
      console.error("Error:", err);
      setError(err instanceof Error ? err.message : "Failed to get answer");
    } finally {
      setLoading(false);
    }
  };

  const handleSummarize = async () => {
    setLoadingSummarize(true);
    setError(null);
    setSummary(null);
    setAnswer(null);
    setCitations([]);

    try {
      const pagePayload = await getPagePayload();

      // Use summarize endpoint if available, otherwise use ask with summarize prompt
      const response = await fetch(`${API_URL}/summarize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page: pagePayload,
        }),
      });

      if (response.status === 404) {
        // Fallback: use ask endpoint with summarize question if summarize endpoint doesn't exist
        const fallbackResponse = await fetch(`${API_URL}/ask`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: "Please provide a concise summary of the main content on this page, highlighting key points and sections.",
            page: pagePayload,
          }),
        });

        if (!fallbackResponse.ok) {
          throw new Error(`Server error: ${fallbackResponse.statusText}`);
        }

        const fallbackData: AskResponse = await fallbackResponse.json();
        setSummary(fallbackData.answer);
        setCitations(fallbackData.citations || []);
      } else if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      } else {
        const data = await response.json();
        // Handle both SummarizeResponse and AskResponse formats
        if (data.summary) {
          setSummary(data.summary);
        } else if (data.answer) {
          setSummary(data.answer);
          setCitations(data.citations || []);
        } else {
          throw new Error("Invalid response format");
        }
      }
    } catch (err) {
      console.error("Error:", err);
      setError(err instanceof Error ? err.message : "Failed to summarize page");
    } finally {
      setLoadingSummarize(false);
    }
  };

  const handleCitationClick = async (citation: Citation) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) return;

      // If we have a section ID, try jumping to section first
      if (citation.sectionId) {
        await chrome.tabs.sendMessage<ExtensionMessage, void>(tab.id, {
          type: "JUMP_TO_SECTION",
          sectionId: citation.sectionId,
          page: citation.page,
        });
      }

      // Always try to highlight the quote
      await chrome.tabs.sendMessage<ExtensionMessage, void>(tab.id, {
        type: "HIGHLIGHT_QUOTE",
        quote: citation.quote,
        sectionId: citation.sectionId,
        page: citation.page,
      });
    } catch (err) {
      console.error("Error highlighting citation:", err);
      setError("Could not highlight citation on the page. Make sure the page is fully loaded.");
    }
  };

  return (
    <div className="popup-container">
      <div className="popup-header">
        <h1>ContextCopilot</h1>
      </div>

      <div className="popup-content">
        <div className="question-section">
          <textarea
            className="question-input"
            placeholder="Ask a question about this page..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && question.trim()) {
                handleAsk();
              }
            }}
            rows={3}
            disabled={loading || loadingSummarize}
          />
          <div className="button-group">
            <button
              className="ask-button"
              onClick={handleAsk}
              disabled={loading || loadingSummarize || !question.trim()}
            >
              {loading ? "Asking..." : "Ask"}
            </button>
            <button
              className="summarize-button"
              onClick={handleSummarize}
              disabled={loading || loadingSummarize}
            >
              {loadingSummarize ? "Summarizing..." : "Summarize Page"}
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {(loading || loadingSummarize) && (
          <div className="loading">
            <div className="spinner"></div>
            <p>{loadingSummarize ? "Summarizing page content..." : "Analyzing page content..."}</p>
          </div>
        )}

        {(answer || summary) && (
          <div className="answer-section">
            <h2>{summary ? "Summary" : "Answer"}</h2>
            <div className="answer-text">{answer || summary}</div>

            {citations.length > 0 && (
              <div className="citations-section">
                <h3>Citations</h3>
                <ul className="citations-list">
                  {citations.map((citation, idx) => (
                    <li
                      key={idx}
                      className="citation-item"
                      onClick={() => handleCitationClick(citation)}
                      title="Click to highlight on page"
                    >
                      <div className="citation-quote">"{citation.quote}"</div>
                      <div className="citation-metadata">
                        {citation.page && (
                          <span className="citation-page">Page {citation.page}</span>
                        )}
                        {citation.sectionHint && (
                          <span className="citation-hint">{citation.sectionHint}</span>
                        )}
                        {citation.sectionId && !citation.sectionHint && (
                          <span className="citation-hint">Section: {citation.sectionId}</span>
                        )}
                        {citation.confidence !== undefined && (
                          <span className="citation-confidence">
                            {(citation.confidence * 100).toFixed(0)}% confidence
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
