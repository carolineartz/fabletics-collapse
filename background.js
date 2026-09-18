// Service worker: on a fresh install, start with collapsing turned on, even if
// a setting from a previous install of the same extension is still in storage.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') chrome.storage.sync.set({ enabled: true });
});
