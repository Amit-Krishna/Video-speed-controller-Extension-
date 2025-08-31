// File: background.js 
console.log('Background script started.'); // For debugging

// A function to update the badge icon
const updateBadge = (speed, tabId) => {
  const text = speed.toFixed(1);

  
  if (text === '1.0') {
    chrome.action.setBadgeText({ text: '', tabId: tabId });
  } else {
    chrome.action.setBadgeText({ text: text, tabId: tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#2E8B57' }); 
  }
};

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateBadge' && sender.tab) {
    updateBadge(message.speed, sender.tab.id);
  }
});

// Logic to handle tab switching
chrome.tabs.onActivated.addListener((activeInfo) => {
  const tabId = activeInfo.tabId;
  chrome.tabs.sendMessage(tabId, { action: 'getSpeed' }, (response) => {
    if (chrome.runtime.lastError) {
      chrome.action.setBadgeText({ text: '', tabId: tabId });
    } else if (response && response.speed) {
      updateBadge(response.speed, tabId);
    }
  });

// --- ONBOARDING LOGIC ---
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        const welcomeUrl = chrome.runtime.getURL('welcome.html');
        chrome.tabs.create({ url: welcomeUrl });
    }
});


});