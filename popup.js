const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const presetButtons = document.getElementById('preset-buttons');
const toggleButton = document.getElementById('toggle-site-button');
const shortcutsLink = document.getElementById('shortcuts-link');

let currentTab;
let currentHostname;
let excludedSites = [];

function updateUI(speed) {
  if (typeof speed !== 'number' || isNaN(speed)) {
    speed = 1.0;
  }
  const formattedSpeed = speed.toFixed(2);
  speedValue.textContent = `${formattedSpeed}x`;
  speedSlider.value = speed;
}

function applySpeed(speed) {
  chrome.storage.sync.set({ 'videoSpeed': speed });

  chrome.tabs.sendMessage(currentTab.id, {
    action: 'set-speed',
    speed: speed
  }, (response) => {
    if (chrome.runtime.lastError) {
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

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tabs[0];

    if (!currentTab || !currentTab.url || !currentTab.url.startsWith('http')) {
      document.body.innerHTML = '<div style="padding: 10px; text-align: center;">Not available on this page.</div>';
      return;
    }
    
    currentHostname = new URL(currentTab.url).hostname;
    
    const data = await chrome.storage.sync.get(['excludedSites']);
    excludedSites = data.excludedSites || [];
    updateToggleButton();

    chrome.tabs.sendMessage(currentTab.id, { action: 'getSpeed' }, (response) => {
      if (chrome.runtime.lastError) {
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
  
  chrome.tabs.reload(currentTab.id);
  window.close();
});

shortcutsLink.addEventListener('click', (event) => {
  event.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});
