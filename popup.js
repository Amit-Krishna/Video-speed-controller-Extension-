// --- ELEMENT SELECTORS ---
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const presetButtons = document.getElementById('preset-buttons');
const toggleButton = document.getElementById('toggle-site-button');
const shortcutsLink = document.getElementById('shortcuts-link');

// --- GLOBAL VARIABLES ---
let currentTab;
let currentHostname;
let excludedSites = [];

// --- CORE FUNCTIONS ---
function updateUI(speed) {
  if (typeof speed !== 'number' || isNaN(speed)) {
    speed = 1.0; // Default to 1.0 if speed is invalid
  }
  const formattedSpeed = speed.toFixed(2);
  speedValue.textContent = `${formattedSpeed}x`;
  speedSlider.value = speed;
}

function applySpeed(speed) {
  // Save the desired speed globally
  chrome.storage.sync.set({ 'videoSpeed': speed });

  // Send a message to the content script to apply the speed immediately
  chrome.tabs.sendMessage(currentTab.id, {
    action: 'set-speed',
    speed: speed
  }, (response) => {
    if (chrome.runtime.lastError) {
      // This can happen if the content script isn't injected yet, which is okay.
      // The content script will pick up the saved speed on its own.
    }
  });
}

const updateToggleButton = () => {
  const isExcluded = excludedSites.includes(currentHostname);
  if (isExcluded) {
    toggleButton.textContent = `Enable on ${currentHostname}`;
    toggleButton.className = 'disabled';
  } else {
    toggleButton.textContent = `Disable on ${currentHostname}`;
    toggleButton.className = 'enabled';
  }
  toggleButton.disabled = false;
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tabs[0];

    // THE FIX: Check if `currentTab.url` exists and is a valid web URL.
    if (!currentTab || !currentTab.url || !currentTab.url.startsWith('http')) {
      document.body.innerHTML = '<div style="padding: 10px; text-align: center;">Not available on this page.</div>';
      return;
    }
    
    currentHostname = new URL(currentTab.url).hostname;
    
    // Load exclusion settings and update the button
    const data = await chrome.storage.sync.get(['excludedSites']);
    excludedSites = data.excludedSites || [];
    updateToggleButton();

    // Get the current speed from the content script to initialize the UI
    chrome.tabs.sendMessage(currentTab.id, { action: 'getSpeed' }, (response) => {
      if (chrome.runtime.lastError) {
        // If content script isn't ready, get speed from storage as a fallback
        chrome.storage.sync.get('videoSpeed', (data) => {
            updateUI(data.videoSpeed || 1.0);
        });
        return;
      }
      if (response && typeof response.speed !== 'undefined') {
        updateUI(response.speed);
      } else {
        updateUI(1.0);
      }
    });

  } catch (error) {
    console.error("Error initializing popup:", error);
    document.body.innerHTML = '<div style="padding: 10px; text-align: center;">An error occurred.</div>';
  }
});


// --- EVENT LISTENERS ---
speedSlider.addEventListener('input', (event) => {
  const newSpeed = parseFloat(event.target.value);
  updateUI(newSpeed);
  applySpeed(newSpeed);
});

presetButtons.addEventListener('click', (event) => {
  if (event.target.tagName === 'BUTTON' && event.target.dataset.speed) {
    const newSpeed = parseFloat(event.target.dataset.speed);
    updateUI(newSpeed);
    applySpeed(newSpeed);
  }
});

toggleButton.addEventListener('click', async () => {
  const isExcluded = excludedSites.includes(currentHostname);

  if (isExcluded) {
    excludedSites = excludedSites.filter(site => site !== currentHostname);
  } else {
    excludedSites.push(currentHostname);
  }
  
  await chrome.storage.sync.set({ excludedSites: excludedSites });
  
  updateToggleButton();
  
  // Reload the tab to apply/remove the content script
  chrome.tabs.reload(currentTab.id);
  window.close(); // Close the popup after action
});

shortcutsLink.addEventListener('click', (event) => {
  event.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});