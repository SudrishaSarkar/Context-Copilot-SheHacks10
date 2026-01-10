// Background service worker for Manifest V3
// Minimal implementation - all logic is in content script and popup

chrome.runtime.onInstalled.addListener(() => {
  console.log("ContextCopilot extension installed");
});

// Keep service worker alive if needed
chrome.runtime.onConnect.addListener((port) => {
  port.onDisconnect.addListener(() => {
    console.log("Port disconnected");
  });
});
