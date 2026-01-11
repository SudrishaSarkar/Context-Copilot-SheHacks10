import React, { useMemo, useState } from "react";
import type { ExtensionMessage, PagePayload, Citation, AskResponse } from "./types";
import "./popup.css";

const API_URL = "http://localhost:8787/ask";
const SUMMARIZE_API_URL = "http://localhost:8787/summarize";

type Tab = "quick" | "ask";

function safeString(x: unknown, fallback = ""): string {
  return typeof x === "string" ? x : fallback;
}

function normalizeCitations(x: unknown): Citation[] {
  if (!Array.isArray(x)) return [];
  return x
    .map((c) => ({
      quote: typeof c?.quote === "string" ? c.quote : "",
      source: typeof c?.source === "string" ? c.source : undefined,
    }))
    .filter((c) => c.quote.trim().length > 0);
}

async function getActiveTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

async function getPagePayload(): Promise<PagePayload | null> {
  const tabId = await getActiveTabId();
  if (!tabId) return null;

  try {
    const payload = await chrome.tabs.sendMessage<ExtensionMessage, PagePayload>(tabId, {
      type: "GET_PAGE_PAYLOAD",
    });
    // Basic shape check
    if (!payload || typeof payload !== "object") return null;
    return payload;
  } catch (e) {
    console.error("GET_PAGE_PAYLOAD failed:", e);
    return null;
  }
}

export default function Popup() {
  const [tab, setTab] = useState<Tab>("quick");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const canAsk = useMemo(() => question.trim().length > 0 && !loading, [question, loading]);

  const highlightCitation = async (quote: string) => {
    const tabId = await getActiveTabId();
    if (!tabId) return;

    try {
      await chrome.tabs.sendMessage<ExtensionMessage, void>(tabId, {
        type: "HIGHLIGHT_QUOTE",
        quote,
      });
    } catch (e) {
      console.error("HIGHLIGHT_QUOTE failed:", e);
    }
  };

  const runAsk = async (prompt: string) => {
    setLoading(true);
    setError("");
    setAnswer("");
    setCitations([]);

    try {
      const pagePayload = await getPagePayload();
      if (!pagePayload) throw new Error("Couldn’t read the page content. Try refreshing the page.");

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: prompt.trim(),
          page: pagePayload,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Backend error (${res.status}): ${text || "No details"}`);
      }

      const data: unknown = await res.json();
      const parsed: AskResponse = {
        answer: safeString((data as any)?.answer),
        citations: normalizeCitations((data as any)?.citations),
      };

      setAnswer(parsed.answer || "(No answer returned)");
      setCitations(parsed.citations || []);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const runSummarize = async () => {
    setLoading(true);
    setError("");
    setAnswer("");
    setCitations([]);

    try {
      const pagePayload = await getPagePayload();
      if (!pagePayload) throw new Error("Couldn’t read the page content. Try refreshing the page.");

      const res = await fetch(SUMMARIZE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: pagePayload }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Backend error (${res.status}): ${text || "No details"}`);
      }

      const data: unknown = await res.json();
      const parsed: AskResponse = {
        answer: safeString((data as any)?.summary ?? (data as any)?.answer),
        citations: normalizeCitations((data as any)?.citations),
      };

      setAnswer(parsed.answer || "(No summary returned)");
      setCitations(parsed.citations || []);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      title: "Summarize Page",
      subtitle: "Get a concise summary",
      icon: "🧾",
      onClick: () => runSummarize(),
      accent: "green",
    },
    {
      title: "Key Points",
      subtitle: "Extract main takeaways",
      icon: "💡",
      onClick: () =>
        runAsk(
          "Extract the key points and main takeaways from this page. Use short bullets. If the page is an argument, include pros/cons."
        ),
      accent: "orange",
    },
    {
      title: "Explain Like I’m 5",
      subtitle: "Simplify the content",
      icon: "🙂",
      onClick: () =>
        runAsk(
          "Explain the content of this page like I'm 5 years old. Keep it simple, concrete, and use an everyday analogy."
        ),
      accent: "pink",
    },
    {
      title: "Action Items",
      subtitle: "Identify next steps",
      icon: "✅",
      onClick: () =>
        runAsk(
          "List actionable next steps and TODOs implied by this page. Make them specific and checkable, with owners if obvious."
        ),
      accent: "blue",
    },
  ] as const;

  return (
    <div className="cc-root">
      {/* Top gradient header */}
      <div className="cc-topbar">
        <div className="cc-brand">
          <div className="cc-logo" aria-hidden>
            ✨
          </div>
          <div className="cc-brandText">
            <div className="cc-title">ContextCopilot</div>
            <div className="cc-subtitle">AI-Powered Page Assistant</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="cc-tabs">
        <button
          className={`cc-tab ${tab === "quick" ? "is-active" : ""}`}
          onClick={() => setTab("quick")}
          type="button"
        >
          Quick Actions
        </button>
        <button
          className={`cc-tab ${tab === "ask" ? "is-active" : ""}`}
          onClick={() => setTab("ask")}
          type="button"
        >
          Ask Question
        </button>
      </div>

      {/* Main */}
      <div className="cc-body">
        {tab === "quick" ? (
          <div className="cc-cardGrid">
            {quickActions.map((a) => (
              <button
                key={a.title}
                className={`cc-actionCard accent-${a.accent}`}
                onClick={a.onClick}
                type="button"
                disabled={loading}
                title={a.title}
              >
                <div className="cc-actionIcon" aria-hidden>
                  {a.icon}
                </div>
                <div className="cc-actionText">
                  <div className="cc-actionTitle">{a.title}</div>
                  <div className="cc-actionSubtitle">{a.subtitle}</div>
                </div>
                <div className="cc-actionChevron" aria-hidden>
                  ›
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="cc-askPanel">
            <label className="cc-label" htmlFor="cc-question">
              Your question
            </label>

            <textarea
              id="cc-question"
              className="cc-textarea"
              placeholder="Ask something about the page you’re reading…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={6}
            />

            <div className="cc-row">
              <button
                className="cc-btn cc-btnPrimary"
                onClick={() => runAsk(question)}
                type="button"
                disabled={!canAsk}
              >
                {loading ? "Working…" : "Ask"}
              </button>

              <button className="cc-btn cc-btnGhost" onClick={runSummarize} type="button" disabled={loading}>
                {loading ? "Working…" : "Summarize"}
              </button>
            </div>
          </div>
        )}

        {/* Output */}
        {(error || answer) && (
          <div className="cc-output">
            {error && <div className="cc-error">{error}</div>}

            {answer && (
              <>
                <div className="cc-outputTitle">Answer</div>
                <div className="cc-outputText">{answer}</div>

                {citations.length > 0 && (
                  <>
                    <div className="cc-outputTitle">Citations</div>
                    <div className="cc-citations">
                      {citations.map((c, i) => (
                        <button
                          key={`${c.quote}-${i}`}
                          className="cc-citation"
                          type="button"
                          onClick={() => highlightCitation(c.quote)}
                          title="Click to highlight on the page"
                        >
                          “{c.quote}”
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer (ONLY ONCE now) */}
      <div className="cc-footer">Grounded answers • Click citations to highlight</div>
    </div>
  );
}
