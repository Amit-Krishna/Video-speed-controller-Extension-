console.log('Background script started.');

function injectInitialScript(tabId) {
  chrome.scripting.executeScript({
    target: { tabId: tabId, allFrames: true },
    files: ['injector.js']
  }).catch(err => {
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    if (tab.url && (tab.url.startsWith('http') || tab.url.startsWith('file'))) {
      injectInitialScript(tabId);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'injectContentScript') {
    const tabId = sender.tab.id;
    const frameId = sender.frameId;

    console.log(`VSC Background: Received injection request for tab ${tabId}. Relaying...`);

    chrome.scripting.insertCSS({
      target: { tabId: tabId, frameIds: [frameId] },
      files: ['hud.css']
    });

    chrome.scripting.executeScript({
      target: { tabId: tabId, frameIds: [frameId] },
      files: ['content.js']
    });
  }

  return true;
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: command });
  }
});

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateBadge' && sender.tab) {
    updateBadge(message.speed, sender.tab.id);
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  queryTabAndUpdateBadge(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    queryTabAndUpdateBadge(tabId);
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    const welcomeUrl = chrome.runtime.getURL('welcome.html');
    chrome.tabs.create({ url: welcomeUrl });
  }
});
