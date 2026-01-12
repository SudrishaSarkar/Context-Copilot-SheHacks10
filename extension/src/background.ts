// Background service worker for Manifest V3
// Minimal implementation - all logic is in content script and popup

console.log("✅ ContextCopilot extension installed");

// Listen for extension installation/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install" || details.reason === "update") {
    console.log("ContextCopilot extension installed/updated:", details.reason);
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle any background-level messages if needed
  return false;
});
