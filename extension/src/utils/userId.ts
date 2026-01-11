/**
 * User ID utility for Chrome Extension
 * Generates and stores a unique user ID per extension installation
 */

const USER_ID_STORAGE_KEY = "contextcopilot_user_id";

/**
 * Get or create a unique user ID for this extension installation
 * Uses Chrome storage to persist the ID across sessions
 */
export async function getUserId(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get([USER_ID_STORAGE_KEY], (result) => {
      if (result[USER_ID_STORAGE_KEY]) {
        resolve(result[USER_ID_STORAGE_KEY]);
      } else {
        // Generate a new unique ID
        const newUserId = generateUserId();
        chrome.storage.local.set({ [USER_ID_STORAGE_KEY]: newUserId }, () => {
          resolve(newUserId);
        });
      }
    });
  });
}

/**
 * Generate a unique user ID
 * Format: timestamp-randomstring (e.g., "1703123456789-abc123def456")
 */
function generateUserId(): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15) + 
                    Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomStr}`;
}

/**
 * Clear the stored user ID (for testing/reset purposes)
 */
export async function clearUserId(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove([USER_ID_STORAGE_KEY], () => {
      resolve();
    });
  });
}
