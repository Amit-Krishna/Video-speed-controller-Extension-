console.log('Background script started.');

// ===================================================================
// === NEW INJECTION LOGIC (FOR SANDBOXED IFRAMES) ===
// ===================================================================

// This function will be called to inject our initial, lightweight script.
function injectInitialScript(tabId) {
  chrome.scripting.executeScript({
    target: { tabId: tabId, allFrames: true },
    files: ['injector.js']
  }).catch(err => {
    // This error is expected on pages like chrome://extensions, so we can often ignore it.
    // console.log(`Could not inject into tab ${tabId}: ${err.message}`);
  });
}

// Listen for when a tab is updated (e.g., user navigates to a new page).
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // We inject when the document starts loading to catch videos that appear early.
  if (changeInfo.status === 'loading') {
    // Ensure the URL is accessible before trying to inject.
    if (tab.url && (tab.url.startsWith('http') || tab.url.startsWith('file'))) {
      injectInitialScript(tabId);
    }
  }
});

// The injector.js script will send this message if it finds a video in its frame.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'injectContentScript') {
    const tabId = sender.tab.id;
    const frameId = sender.frameId;

    // Inject the main content script and its CSS only into the specific frame that found a video.
    chrome.scripting.insertCSS({
      target: { tabId: tabId, frameIds: [frameId] },
      files: ['hud.css']
    });
    chrome.scripting.executeScript({
      target: { tabId: tabId, frameIds: [frameId] },
      files: ['content.js']
    });
  }
  // Return true to keep the message channel open for other listeners.
  return true;
});


// ===================================================================
// === YOUR EXISTING BADGE AND ONBOARDING LOGIC (UNCHANGED) ===
// ===================================================================

const updateBadge = (speed, tabId) => {
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

const queryTabAndUpdateBadge = (tabId) => {
  if (!tabId) return;
  chrome.tabs.sendMessage(tabId, { action: 'getSpeed' }, (response) => {
    if (chrome.runtime.lastError) {
      chrome.action.setBadgeText({ text: '', tabId: tabId });
      return; 
    }
    if (response && typeof response.speed !== 'undefined') {
      updateBadge(response.speed, tabId);
    } else {
      chrome.action.setBadgeText({ text: '', tabId: tabId });
    }
  });
};

// Listen for messages from content scripts to update the badge.
// We modify this slightly to avoid conflict with the injection listener.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateBadge' && sender.tab) {
    updateBadge(message.speed, sender.tab.id);
  }
  // No return true here, as the other listener already handles it.
});

// Update badge when the user switches to a different tab.
chrome.tabs.onActivated.addListener((activeInfo) => {
  queryTabAndUpdateBadge(activeInfo.tabId);
});

// Update badge when a tab finishes loading.
// We change this to 'complete' to avoid trying to message a script that isn't fully loaded.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
        queryTabAndUpdateBadge(tabId);
    }
});

// Onboarding logic.
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        const welcomeUrl = chrome.runtime.getURL('welcome.html');
        chrome.tabs.create({ url: welcomeUrl });
    }
});