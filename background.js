console.log('Background script started.');

// A function to update the badge icon
const updateBadge = (speed, tabId) => {
  // Ensure speed is a number before calling toFixed
  const numericSpeed = Number(speed);
  if (isNaN(numericSpeed)) {
    chrome.action.setBadgeText({ text: '', tabId: tabId });
    return;
  }
  
  const text = numericSpeed.toFixed(1);

  if (text === '1.0') {
    chrome.action.setBadgeText({ text: '', tabId: tabId });
  } else {
    chrome.action.setBadgeText({ text: text, tabId: tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#2E8B57' });
  }
};

// A reusable function to query the speed from a tab and update the badge
const queryTabAndUpdateBadge = (tabId) => {
  if (!tabId) return;

  chrome.tabs.sendMessage(tabId, { action: 'getSpeed' }, (response) => {
    // If there's an error, it means the content script isn't there.
    // We just return and do nothing, which solves the bug.
    if (chrome.runtime.lastError) {
      // console.log(`Could not connect to tab ${tabId}: ${chrome.runtime.lastError.message}`);
      chrome.action.setBadgeText({ text: '', tabId: tabId }); // Clear badge on error pages
      return; 
    }
    
    // If we get a valid response, update the badge
    if (response && typeof response.speed !== 'undefined') {
      updateBadge(response.speed, tabId);
    } else {
      // Content script is there but no speed is set (e.g. no video)
      chrome.action.setBadgeText({ text: '', tabId: tabId });
    }
  });
};

// --- LISTENERS ---

// Listen for messages from content scripts (e.g., when speed changes)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateBadge' && sender.tab) {
    updateBadge(message.speed, sender.tab.id);
  }
  // Allows async sendResponse
  return true; 
});

// Update badge when the user switches to a different tab
chrome.tabs.onActivated.addListener((activeInfo) => {
  queryTabAndUpdateBadge(activeInfo.tabId);
});

// Update badge when a tab is updated (e.g., user navigates to a new page)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // We only care when the tab is fully loaded and active
    if (changeInfo.status === 'complete' && tab.active) {
        queryTabAndUpdateBadge(tabId);
    }
});

// --- ONBOARDING LOGIC (Now at the top level) ---
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        const welcomeUrl = chrome.runtime.getURL('welcome.html');
        chrome.tabs.create({ url: welcomeUrl });
    }
});