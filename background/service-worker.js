/**
 * Keeps the service worker alive for future commands (shortcuts, omnibox, etc.).
 */
chrome.runtime.onInstalled.addListener(() => {
  console.info("[tab-group-nav] Extension installed");
});
