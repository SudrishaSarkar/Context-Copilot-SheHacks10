import React, { useState, useEffect } from "react";
import type { PagePayload, AskResponse, ExtensionMessage, HistoryItem, HistoryResponse } from "./types";
import { jsPDF } from "jspdf";

const API_URL = "http://localhost:8787/ask";
const SUMMARIZE_API_URL = "http://localhost:8787/summarize";
const EMAIL_ANALYZE_URL = "http://localhost:8787/email/analyze";
const HISTORY_URL = "http://localhost:8787/history";
// Dashboard URL - update this to your dashboard website URL
const DASHBOARD_URL = "http://localhost:3002";

type TabType = "quick-actions" | "ask-question";
type HistoryFilter = "all" | "page-qa" | "quick-actions" | "youtube" | "email-tone";

// Inline SVG icons
const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="5" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M4 3.5C4 2.67157 4.67157 2 5.5 2H9.5C10.3284 2 11 2.67157 11 3.5V5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 2V10M8 10L5.5 7.5M8 10L10.5 7.5M3 10V13.5C3 14.3284 3.67157 15 4.5 15H11.5C12.3284 15 13 14.3284 13 13.5V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AppIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M8 5V8L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14.5 9.5C14.3589 10.4858 13.9639 11.4111 13.3591 12.1727C12.7544 12.9344 11.9658 13.5002 11.0833 13.8047C10.2008 14.1092 9.26159 14.1415 8.36143 13.8978C7.46126 13.6542 6.63866 13.1439 5.99543 12.4207C5.35221 11.6976 4.91556 10.7908 4.73705 9.81063C4.55854 8.83041 4.64559 7.81518 4.98747 6.87886C5.32935 5.94254 5.91296 5.12304 6.66665 4.50978C7.42034 3.89652 8.31316 3.51452 9.25 3.40278C8.88896 4.25954 8.80911 5.20075 9.02153 6.10607C9.23394 7.01139 9.72921 7.83829 10.4375 8.47278C11.1458 9.10728 12.0331 9.52026 12.9792 9.65928C13.9252 9.7983 14.887 9.65747 15.75 9.25278L14.5 9.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

const MicIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 1C6.89543 1 6 1.89543 6 3V8C6 9.10457 6.89543 10 8 10C9.10457 10 10 9.10457 10 8V3C10 1.89543 9.10457 1 8 1Z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M4 7V8C4 10.2091 5.79086 12 8 12C10.2091 12 12 10.2091 12 8V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M8 12V14M8 14H6M8 14H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// Quick Action Icons
const SummarizeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 6H20M4 12H16M4 18H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <rect x="18" y="16" width="4" height="4" rx="1" fill="currentColor"/>
  </svg>
);

const KeyPointsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none"/>
    <circle cx="12" cy="12" r="4" fill="currentColor"/>
    <path d="M12 5V3M12 21V19M5 12H3M21 12H19M7.05 7.05L5.64 5.64M18.36 18.36L16.95 16.95M7.05 16.95L5.64 18.36M18.36 5.64L16.95 7.05" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const ELI5Icon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
    <circle cx="9" cy="10" r="1.5" fill="currentColor"/>
    <circle cx="15" cy="10" r="1.5" fill="currentColor"/>
    <path d="M9 15C9 15 10.5 17 12 17C13.5 17 15 15 15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const ActionItemsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="currentColor"/>
  </svg>
);

const EmailIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M3 7L12 13L21 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Clean and format summary text - remove markdown symbols and format nicely
function formatSummary(text: string): string {
  if (!text) return "";
  
  let cleaned = text;
  
  // Remove markdown headers (###, ##, #)
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "");
  
  // Remove markdown bold/italic markers but keep the text
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1");
  cleaned = cleaned.replace(/\*([^*]+)\*/g, "$1");
  cleaned = cleaned.replace(/__([^_]+)__/g, "$1");
  cleaned = cleaned.replace(/_([^_]+)_/g, "$1");
  
  // Remove markdown code blocks
  cleaned = cleaned.replace(/```[\s\S]*?```/g, "");
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1");
  
  // Remove markdown links but keep text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
  
  // Convert markdown bullets to clean bullets (preserve indentation)
  cleaned = cleaned.replace(/^[\*\-\+]\s+/gm, "• ");
  
  // Convert numbered lists to clean format
  cleaned = cleaned.replace(/^\d+[\.\)]\s+/gm, "");
  
  // Remove extra symbols and formatting
  cleaned = cleaned.replace(/[●○▪▫]/g, "•"); // Normalize bullet types
  cleaned = cleaned.replace(/[—–]/g, "-"); // Normalize dashes
  
  // Clean up multiple spaces
  cleaned = cleaned.replace(/  +/g, " ");
  
  // Clean up multiple newlines (max 2 consecutive)
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  
  // Remove leading/trailing symbols from lines
  cleaned = cleaned
    .split("\n")
    .map((line) => {
      let trimmed = line.trim();
      // Remove leading symbols that aren't bullets
      trimmed = trimmed.replace(/^[^\w•\-]+/, "");
      return trimmed;
    })
    .filter((line) => line.length > 0) // Remove empty lines
    .join("\n");
  
  // Final cleanup - remove any remaining markdown artifacts
  cleaned = cleaned.replace(/\[|\]/g, ""); // Remove square brackets
  cleaned = cleaned.replace(/\(\)/g, ""); // Remove empty parentheses
  
  return cleaned.trim();
}

export default function Popup() {
  const [activeTab, setActiveTab] = useState<TabType>("ask-question");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [citations, setCitations] = useState<AskResponse["citations"]>([]);
  const [askError, setAskError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speechRecognition, setSpeechRecognition] = useState<any>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [youtubeMessage, setYoutubeMessage] = useState<string | null>(null);
  const [emailTone, setEmailTone] = useState<string | null>(null);
  const [emailReplies, setEmailReplies] = useState<string[]>([]);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>("all");
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null);

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("contextcopilot-theme");
    const theme = savedTheme === "dark" ? "dark" : "light";
    setIsDarkMode(theme === "dark");
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setQuestion((prev) => (prev ? prev + " " + transcript : transcript));
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        setAskError("Microphone permission denied. Please allow microphone access in Chrome settings (chrome://settings/content/microphone) or click the lock icon in the address bar.");
      } else if (event.error === "no-speech") {
        // User stopped speaking, this is normal - don't show error
        setIsRecording(false);
        return;
      } else if (event.error === "aborted") {
        // Recognition was stopped - this is normal
        setIsRecording(false);
        return;
      } else {
        setAskError("Speech recognition error: " + event.error);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    setSpeechRecognition(recognition);

    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, []);

  // Fetch history when dashboard opens
  useEffect(() => {
    if (showDashboard && historyItems.length === 0 && !historyLoading) {
      fetchHistory();
    }
  }, [showDashboard]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(HISTORY_URL);
      if (response.ok) {
        const data: HistoryResponse = await response.json();
        setHistoryItems(data.items || []);
      } else {
        setHistoryItems([]);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = isDarkMode ? "light" : "dark";
    setIsDarkMode(!isDarkMode);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("contextcopilot-theme", newTheme);
  };

  // Toggle speech recognition
  const toggleSpeechRecognition = async () => {
    if (!speechRecognition || !isSpeechSupported) return;

    if (isRecording) {
      speechRecognition.stop();
      setIsRecording(false);
    } else {
      try {
        // Request microphone permission first if available
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
          } catch (mediaErr: any) {
            if (mediaErr.name === "NotAllowedError" || mediaErr.name === "PermissionDeniedError") {
              setAskError("Microphone permission denied. Please allow microphone access in Chrome settings.");
              return;
            }
          }
        }
        
        speechRecognition.start();
        setIsRecording(true);
        setAskError(null); // Clear any previous errors
      } catch (err: any) {
        console.error("Failed to start speech recognition:", err);
        if (err.message && err.message.includes("not allowed")) {
          setAskError("Microphone permission denied. Please allow microphone access in Chrome settings.");
        } else {
          setAskError("Failed to start recording. Make sure your microphone is connected and permissions are granted.");
        }
        setIsRecording(false);
      }
    }
  };

  const handleAsk = async (promptOverride?: string) => {
    const promptText = promptOverride || question.trim();
    
    if (!promptText) {
      setAskError("Please enter a question");
      return;
    }

    // Update question state if using override (so it shows in textarea if user switches tabs)
    if (promptOverride) {
      setQuestion(promptOverride);
    }

    setLoading(true);
    setAskError(null);
    setAnswer(null);
    setSummary(null);
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
          question: promptText,
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
      setAskError(err instanceof Error ? err.message : "Failed to get answer");
    } finally {
      setLoading(false);
    }
  };

  // Check if URL is a YouTube watch page
  const isYouTubeWatchPage = (url: string): boolean => {
    return url.includes("youtube.com/watch") || url.includes("youtu.be/");
  };

  // Handle YouTube summarize
  const handleYouTubeSummarize = async () => {
    setYoutubeMessage(null);
    setLoading(true);
    setAskError(null);
    setAnswer(null);
    setSummary(null);
    setCitations([]);

    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id || !tab.url) {
        throw new Error("No active tab found");
      }

      // Check if URL is YouTube watch page
      if (!isYouTubeWatchPage(tab.url)) {
        setYoutubeMessage("Open a YouTube video to use this feature.");
        setLoading(false);
        return;
      }

      // Send message to content script to get page payload
      const pagePayload = await chrome.tabs.sendMessage<ExtensionMessage, PagePayload>(
        tab.id,
        { type: "GET_PAGE_PAYLOAD" }
      );

      if (!pagePayload) {
        throw new Error("Failed to get page content");
      }

      // Check if we have transcript text
      const hasTranscript = pagePayload.mainText && 
        pagePayload.mainText.length > 100 &&
        (pagePayload.mainText.includes(":") || // Likely has timestamps
         pagePayload.mainText.split(/\s+/).length > 20); // Has substantial text

      if (!hasTranscript) {
        setYoutubeMessage("Transcript not available. Turn on captions / open transcript panel, then try again.");
        setLoading(false);
        return;
      }

      // Use the existing ask function with YouTube-specific prompt
      const promptText = "Summarize this YouTube video transcript. Provide key points and a short TL;DR.";
      setQuestion(promptText);

      // Send request to backend
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: promptText,
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
      setYoutubeMessage(err instanceof Error ? err.message : "Failed to summarize YouTube video");
    } finally {
      setLoading(false);
    }
  };

  // Handle Email Tone & Replies
  const handleEmailToneAndReplies = async () => {
    setEmailMessage(null);
    setEmailTone(null);
    setEmailReplies([]);
    setLoading(true);
    setAnswer(null);
    setSummary(null);
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

      // Check if payload looks like an email (has subject/body or selected text)
      const emailText = pagePayload.selectedText || pagePayload.mainText || "";
      const hasEmailContent = emailText.length > 20 && (
        emailText.toLowerCase().includes("subject") ||
        emailText.toLowerCase().includes("from:") ||
        emailText.toLowerCase().includes("to:") ||
        emailText.toLowerCase().includes("dear") ||
        emailText.toLowerCase().includes("regards") ||
        pagePayload.selectedText // If user selected text, treat as email
      );

      if (!hasEmailContent) {
        setEmailMessage("Select the email text you want analyzed, then try again.");
        setLoading(false);
        return;
      }

      // Send request to email analyze endpoint
      const response = await fetch(EMAIL_ANALYZE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page: pagePayload,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const data = await response.json();
      setEmailTone(data.tone || "Unknown");
      setEmailReplies(data.replies || []);
    } catch (err) {
      console.error("Error:", err);
      setEmailMessage(err instanceof Error ? err.message : "Failed to analyze email");
    } finally {
      setLoading(false);
    }
  };

  const handleSummarize = async () => {
    setSummaryLoading(true);
    setAskError(null);
    setSummary(null);
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
      const response = await fetch(SUMMARIZE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page: pagePayload,
          format: "summary",
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const data = await response.json();
      // Clean and format the summary
      const formattedSummary = formatSummary(data.summary);
      setSummary(formattedSummary);
    } catch (err) {
      console.error("Error:", err);
      // Note: Summary errors are from Quick Actions, so we don't set askError
      // Quick Actions tab doesn't show errors
    } finally {
      setSummaryLoading(false);
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

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDownload = async () => {
    try {
      // Get current tab info
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabUrl = tab.url || "";
      const tabTitle = tab.title || "";

      // Create PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      let yPos = margin;

      // Title
      doc.setFontSize(20);
      doc.setFont(undefined, "bold");
      doc.text("ContextCopilot Summary", margin, yPos);
      yPos += 15;

      // URL and Page Title
      if (tabUrl || tabTitle) {
        doc.setFontSize(12);
        doc.setFont(undefined, "normal");
        if (tabTitle) {
          doc.text(`Page: ${tabTitle}`, margin, yPos);
          yPos += 7;
        }
        if (tabUrl) {
          const urlLines = doc.splitTextToSize(`URL: ${tabUrl}`, maxWidth);
          doc.text(urlLines, margin, yPos);
          yPos += urlLines.length * 7;
        }
        yPos += 5;
      }

      // Question
      if (question.trim()) {
        doc.setFontSize(14);
        doc.setFont(undefined, "bold");
        doc.text("Question:", margin, yPos);
        yPos += 8;
        doc.setFontSize(11);
        doc.setFont(undefined, "normal");
        const questionLines = doc.splitTextToSize(question.trim(), maxWidth);
        doc.text(questionLines, margin, yPos);
        yPos += questionLines.length * 5 + 5;
      }

      // Answer text
      const responseText = answer || summary || "";
      if (responseText) {
        // Check if we need a new page
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFontSize(14);
        doc.setFont(undefined, "bold");
        doc.text("Answer:", margin, yPos);
        yPos += 8;
        doc.setFontSize(11);
        doc.setFont(undefined, "normal");
        const answerLines = doc.splitTextToSize(responseText, maxWidth);
        let answerYPos = yPos;
        for (let i = 0; i < answerLines.length; i++) {
          if (answerYPos > pageHeight - 20) {
            doc.addPage();
            answerYPos = margin;
          }
          doc.text(answerLines[i], margin, answerYPos);
          answerYPos += 5;
        }
        yPos = answerYPos + 5;
      }

      // Citations
      if (answer && citations.length > 0) {
        // Check if we need a new page
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFontSize(14);
        doc.setFont(undefined, "bold");
        doc.text("Citations:", margin, yPos);
        yPos += 8;
        doc.setFontSize(11);
        doc.setFont(undefined, "normal");

        citations.forEach((citation, idx) => {
          if (yPos > pageHeight - 30) {
            doc.addPage();
            yPos = margin;
          }

          const citationText = `• "${citation.quote}"`;
          const citationLines = doc.splitTextToSize(citationText, maxWidth);
          doc.text(citationLines, margin, yPos);
          yPos += citationLines.length * 5 + 3;
        });
      }

      // Generate filename
      const today = new Date();
      const dateStr = today.toISOString().split("T")[0];
      const filename = `contextcopilot-summary-${dateStr}.pdf`;

      // Download PDF
      doc.save(filename);
    } catch (err) {
      console.error("Failed to download PDF:", err);
      setAskError("Failed to generate PDF");
    }
  };

  const currentResponse = answer || summary;
  const responseText = answer || summary || "";

  // Filter history items by active filter
  const filteredHistoryItems = activeFilter === "all" 
    ? historyItems 
    : historyItems.filter(item => item.mode === activeFilter);

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Get mode label
  const getModeLabel = (mode: HistoryItem["mode"]) => {
    switch (mode) {
      case "page-qa": return "Page Q&A";
      case "quick-actions": return "Quick Actions";
      case "youtube": return "YouTube";
      case "email-tone": return "Email Tone";
      default: return mode;
    }
  };

  // Back arrow icon
  const ArrowLeftIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  // If dashboard is shown, render dashboard view
  if (showDashboard) {
    return (
      <div className="popup-container">
        <div className="popup-header">
          <div className="header-left">
            <button 
              className="header-icon-button"
              onClick={() => {
                setShowDashboard(false);
                setSelectedHistoryItem(null);
              }}
              title="Back"
              style={{ marginRight: "8px", background: "rgba(255, 255, 255, 0.15)" }}
            >
              <ArrowLeftIcon />
            </button>
            <div className="header-text">
              <h1>History</h1>
            </div>
          </div>
        </div>

        <div className="popup-content">
          {selectedHistoryItem ? (
            // Detail view
            <div className="history-detail-view">
              <div className="history-detail-header">
                <div className="history-detail-meta">
                  <span className="history-mode-badge">{getModeLabel(selectedHistoryItem.mode)}</span>
                  <span className="history-timestamp">{formatTimestamp(selectedHistoryItem.timestamp)}</span>
                </div>
                <div className="history-detail-title">{selectedHistoryItem.title}</div>
                <div className="history-detail-url">{selectedHistoryItem.url}</div>
                {selectedHistoryItem.question && (
                  <div className="history-detail-question">
                    <strong>Question:</strong> {selectedHistoryItem.question}
                  </div>
                )}
              </div>
              <div className="response-card">
                <div className="response-text">{selectedHistoryItem.answer}</div>
                {selectedHistoryItem.citations && selectedHistoryItem.citations.length > 0 && (
                  <div className="citations-section">
                    <h3>Citations</h3>
                    <ul className="citations-list">
                      {selectedHistoryItem.citations.map((citation, idx) => (
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
            </div>
          ) : (
            // List view
            <>
              <div className="history-filters">
                {(["all", "page-qa", "quick-actions", "youtube", "email-tone"] as HistoryFilter[]).map((filter) => (
                  <button
                    key={filter}
                    className={`history-filter-button ${activeFilter === filter ? "active" : ""}`}
                    onClick={() => setActiveFilter(filter)}
                  >
                    {filter === "all" ? "All" : getModeLabel(filter)}
                  </button>
                ))}
              </div>

              {historyLoading ? (
                <div className="history-loading">
                  <div className="skeleton-line"></div>
                  <div className="skeleton-line"></div>
                  <div className="skeleton-line skeleton-line-short"></div>
                </div>
              ) : filteredHistoryItems.length === 0 ? (
                <div className="history-empty-state">
                  <p>No history items found</p>
                </div>
              ) : (
                <div className="history-list">
                  {filteredHistoryItems.map((item) => (
                    <div
                      key={item.id}
                      className="history-item"
                      onClick={() => setSelectedHistoryItem(item)}
                    >
                      <div className="history-item-header">
                        <span className="history-item-mode">{getModeLabel(item.mode)}</span>
                        <span className="history-item-timestamp">{formatTimestamp(item.timestamp)}</span>
                      </div>
                      <div className="history-item-title">{item.title}</div>
                      <div className="history-item-url">{item.url}</div>
                      <div className="history-item-preview">
                        {item.answer.substring(0, 150)}{item.answer.length > 150 ? "..." : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="popup-container">
      <div className="popup-header">
        <div className="header-left">
          <div className="header-icon">
            <AppIcon />
          </div>
          <div className="header-text">
            <h1>ContextCopilot</h1>
            <p className="header-subtitle">AI-Powered Page Assistant</p>
          </div>
        </div>
        <div className="header-right">
          <button 
            className="header-icon-button" 
            title="Open Dashboard"
            onClick={() => {
              chrome.tabs.create({ url: DASHBOARD_URL });
            }}
          >
            <ClockIcon />
          </button>
          <button 
            className="header-icon-button" 
            title={isDarkMode ? "Light Mode" : "Dark Mode"}
            onClick={toggleTheme}
          >
            <MoonIcon />
          </button>
        </div>
      </div>

      <div className="popup-content">
        <div className="tabs">
          <button
            className={`tab ${activeTab === "quick-actions" ? "active" : ""}`}
            onClick={() => setActiveTab("quick-actions")}
          >
            Quick Actions
          </button>
          <button
            className={`tab ${activeTab === "ask-question" ? "active" : ""}`}
            onClick={() => setActiveTab("ask-question")}
          >
            Ask Question
          </button>
        </div>

        {activeTab === "ask-question" && (
          <div className="question-section">
            <div className="textarea-wrapper">
              <textarea
                className="question-input"
                placeholder="Ask anything about this page..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={6}
                disabled={loading || summaryLoading}
              />
              <button
                className={`mic-button ${isRecording ? "recording" : ""}`}
                onClick={toggleSpeechRecognition}
                disabled={!isSpeechSupported || loading || summaryLoading}
                title={isRecording ? "Stop recording" : "Start voice input"}
              >
                <MicIcon />
                {isRecording && <span className="recording-dot"></span>}
              </button>
            </div>
            {!isSpeechSupported && (
              <div className="speech-unsupported">
                Speech recognition not supported in this browser.
              </div>
            )}
            {askError && <div className="error-message">{askError}</div>}
            <button
              className="ask-ai-button"
              onClick={handleAsk}
              disabled={loading || summaryLoading || !question.trim()}
            >
              {loading ? (
                <>
                  <span className="button-spinner"></span>
                  <span>Asking...</span>
                </>
              ) : (
                "✨ Ask AI"
              )}
            </button>
          </div>
        )}

        {activeTab === "quick-actions" && (
          <div className="quick-actions-section">
            {youtubeMessage && (
              <div className="youtube-message">{youtubeMessage}</div>
            )}
            <div className="quick-actions-grid">
              <button
                className="quick-action-card"
                onClick={handleYouTubeSummarize}
                disabled={loading || summaryLoading}
              >
                <div className="quick-action-icon youtube-icon">
                  <YouTubeIcon />
                </div>
                <div className="quick-action-content">
                  <span className="quick-action-label">Summarize YouTube</span>
                  <span className="quick-action-description">Get video summary</span>
                </div>
              </button>
              <button
                className="quick-action-card"
                onClick={() => handleAsk("Summarize this page")}
                disabled={loading || summaryLoading}
              >
                <div className="quick-action-icon summarize-icon">
                  <SummarizeIcon />
                </div>
                <div className="quick-action-content">
                  <span className="quick-action-label">Summarize Page</span>
                  <span className="quick-action-description">Get a concise summary</span>
                </div>
              </button>
              <button
                className="quick-action-card"
                onClick={() => handleAsk("What are the key takeaways and main points?")}
                disabled={loading || summaryLoading}
              >
                <div className="quick-action-icon keypoints-icon">
                  <KeyPointsIcon />
                </div>
                <div className="quick-action-content">
                  <span className="quick-action-label">Key Points</span>
                  <span className="quick-action-description">Extract main takeaways</span>
                </div>
              </button>
              <button
                className="quick-action-card"
                onClick={() => handleAsk("Explain Like I'm 5")}
                disabled={loading || summaryLoading}
              >
                <div className="quick-action-icon eli5-icon">
                  <ELI5Icon />
                </div>
                <div className="quick-action-content">
                  <span className="quick-action-label">Explain Like I'm 5</span>
                  <span className="quick-action-description">Simplify the content</span>
                </div>
              </button>
              <button
                className="quick-action-card"
                onClick={() => handleAsk("What are the action items and next steps?")}
                disabled={loading || summaryLoading}
              >
                <div className="quick-action-icon actionitems-icon">
                  <ActionItemsIcon />
                </div>
                <div className="quick-action-content">
                  <span className="quick-action-label">Action Items</span>
                  <span className="quick-action-description">Identify next steps</span>
                </div>
              </button>
              <button
                className="quick-action-card"
                onClick={handleEmailToneAndReplies}
                disabled={loading || summaryLoading}
              >
                <div className="quick-action-icon email-icon">
                  <EmailIcon />
                </div>
                <div className="quick-action-content">
                  <span className="quick-action-label">Email Tone & Replies</span>
                  <span className="quick-action-description">Analyze tone and get replies</span>
                </div>
              </button>
            </div>
            {emailMessage && (
              <div className="youtube-message">{emailMessage}</div>
            )}
          </div>
        )}

        {(loading || summaryLoading) && !currentResponse && (
          <div className="response-card skeleton-card">
            <div className="skeleton-header">
              <div className="skeleton-chip"></div>
              <div className="skeleton-actions">
                <div className="skeleton-icon"></div>
                <div className="skeleton-icon"></div>
              </div>
            </div>
            <div className="skeleton-content">
              <div className="skeleton-line"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line skeleton-line-short"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line skeleton-line-short"></div>
            </div>
          </div>
        )}

        {emailTone && emailReplies.length > 0 && (
          <div className="response-card">
            <div className="response-header">
              <span className="tone-chip">Tone: {emailTone}</span>
            </div>
            <div className="email-replies-section">
              <h3 className="replies-heading">Recommended Replies</h3>
              <div className="replies-grid">
                {emailReplies.map((reply, idx) => (
                  <div key={idx} className="reply-card">
                    <div className="reply-text">{reply}</div>
                    <button
                      className="reply-copy-button"
                      onClick={() => handleCopy(reply)}
                      title="Copy reply"
                    >
                      <CopyIcon />
                      {copied && <span className="copy-toast">Copied!</span>}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentResponse && !emailTone && (
          <div className="response-card">
            <div className="response-header">
              <span className="eli5-chip">ELI5</span>
              <div className="response-actions">
                <button
                  className="icon-button"
                  onClick={() => handleCopy(responseText)}
                  title="Copy"
                >
                  <CopyIcon />
                  {copied && <span className="copy-toast">Copied!</span>}
                </button>
                <button
                  className="icon-button"
                  onClick={handleDownload}
                  title="Download PDF"
                >
                  <DownloadIcon />
                </button>
              </div>
            </div>
            <div className="response-text">{responseText}</div>
            {answer && citations.length > 0 && (
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
