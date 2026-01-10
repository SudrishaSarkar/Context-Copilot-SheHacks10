import React, { useState } from "react";
import type { PagePayload, AskResponse, ExtensionMessage } from "./types";

const API_URL = "http://localhost:8787/ask";

export default function Popup() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<AskResponse["citations"]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async () => {
    if (!question.trim()) {
      setError("Please enter a question");
      return;
    }

    setLoading(true);
    setError(null);
    setAnswer(null);
    setCitations([]);

    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        throw new Error("No active tab found");
      }

      // Send message to content script to get page payload
      const pagePayload = await chrome.tabs.sendMessage<ExtensionMessage, PagePayload>(
        tab.id,
        { type: "GET_PAGE_PAYLOAD" }
      );

      if (!pagePayload) {
        throw new Error("Failed to get page content");
      }

      // Send request to backend
      const response = await fetch(API_URL, {
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
        throw new Error(`Server error: ${response.statusText}`);
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

  const handleCitationClick = async (quote: string) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) return;

      await chrome.tabs.sendMessage<ExtensionMessage, void>(tab.id, {
        type: "HIGHLIGHT_QUOTE",
        quote,
      });
    } catch (err) {
      console.error("Error highlighting citation:", err);
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
            rows={3}
            disabled={loading}
          />
          <button
            className="ask-button"
            onClick={handleAsk}
            disabled={loading || !question.trim()}
          >
            {loading ? "Asking..." : "Ask"}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>Analyzing page content...</p>
          </div>
        )}

        {answer && (
          <div className="answer-section">
            <h2>Answer</h2>
            <div className="answer-text">{answer}</div>

            {citations.length > 0 && (
              <div className="citations-section">
                <h3>Citations</h3>
                <ul className="citations-list">
                  {citations.map((citation, idx) => (
                    <li
                      key={idx}
                      className="citation-item"
                      onClick={() => handleCitationClick(citation.quote)}
                    >
                      <div className="citation-quote">"{citation.quote}"</div>
                      {citation.sectionHint && (
                        <div className="citation-hint">{citation.sectionHint}</div>
                      )}
                      {citation.confidence !== undefined && (
                        <div className="citation-confidence">
                          Confidence: {(citation.confidence * 100).toFixed(0)}%
                        </div>
                      )}
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
