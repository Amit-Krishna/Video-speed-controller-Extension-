
// File: popup.js (New version with site exclusion logic)

// --- GLOBAL VARIABLES ---
let currentTab;
let currentHostname;
let excludedSites = [];
const toggleButton = document.getElementById('toggle-site-button');


// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
  
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tabs[0];
  
  if (currentTab.url.startsWith('chrome://')) {
    toggleButton.textContent = 'Cannot run on this page';
    toggleButton.disabled = true;
    return;
  }
  
  currentHostname = new URL(currentTab.url).hostname;
  
  const data = await chrome.storage.sync.get(['excludedSites']);
  excludedSites = data.excludedSites || [];
  
  updateToggleButton();
});

// --- UI FUNCTIONS ---
const updateToggleButton = () => {
  const isExcluded = excludedSites.includes(currentHostname);
  if (isExcluded) {
    toggleButton.textContent = chrome.i18n.getMessage("enableOnSite", currentHostname);
    toggleButton.className = 'disabled';
  } else {
    toggleButton.textContent = chrome.i18n.getMessage("disableOnSite", currentHostname);
    toggleButton.className = 'enabled';
  }
};


// --- EVENT LISTENERS ---
toggleButton.addEventListener('click', async () => {
  const isExcluded = excludedSites.includes(currentHostname);

  if (isExcluded) {
    excludedSites = excludedSites.filter(site => site !== currentHostname);
  } else {
    excludedSites.push(currentHostname);
  }
  
  await chrome.storage.sync.set({ excludedSites: excludedSites });
  
  updateToggleButton();
  
  chrome.tabs.reload(currentTab.id);
});


const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');

document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTabId = tabs[0].id;
    chrome.scripting.executeScript({
      target: { tabId: activeTabId },
      function: () => {
        const video = document.querySelector('video');
        return video ? video.playbackRate : 1.0;
      }
    }, (injectionResults) => {
      if (chrome.runtime.lastError || !injectionResults || !injectionResults.length) {
        return;
      }
      const currentPageSpeed = injectionResults[0].result;
      updateUI(currentPageSpeed);
    });
  });
});

function applySpeed(speed) {
  chrome.storage.sync.set({ 'videoSpeed': speed });
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTabId = tabs[0].id;
    chrome.scripting.executeScript({
      target: { tabId: activeTabId },
      function: (newSpeed) => {
        const videos = document.querySelectorAll('video');
        videos.forEach(video => video.playbackRate = newSpeed);
      },
      args: [speed]
    });
  });
}

function updateUI(speed) {
  const formattedSpeed = (speed % 1 === 0) ? `${speed}.0` : speed.toFixed(2);
  speedValue.textContent = `${formattedSpeed}x`;
  speedSlider.value = speed;
}

speedSlider.addEventListener('input', (event) => {
  const newSpeed = parseFloat(event.target.value);
  updateUI(newSpeed);
  applySpeed(newSpeed);
});

document.getElementById('preset-buttons').addEventListener('click', (event) => {
  if (event.target.tagName === 'BUTTON') {
    const newSpeed = parseFloat(event.target.dataset.speed);
    updateUI(newSpeed);
    applySpeed(newSpeed);
  }
});


document.getElementById('shortcuts-link').addEventListener('click', (event) => {
  event.preventDefault(); 
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});