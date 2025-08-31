// --- INITIALIZATION CHECK (GATEKEEPER) ---
(async () => {
  try {
    const data = await chrome.storage.sync.get(['excludedSites']);
    const excludedSites = data.excludedSites || [];
    const currentHostname = window.location.hostname;

    if (excludedSites.includes(currentHostname)) {
      console.log(`Video Speed Controller is disabled on ${currentHostname}.`);
      return;
    }
    runSpeedController();
  } catch (error) {
    console.error("Video Speed Controller: Error during initialization check.", error);
  }
})();


// --- MAIN LOGIC WRAPPER ---
function runSpeedController() {

  // --- STATE VARIABLES ---
  let desiredSpeed = 1.0;
  let speedStep = 0.10;
  let skipAmount = 5;
  let activeVideoContainers = new Set();
  let hudElement = null;

  // --- UTILITIES ---
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => { func.apply(this, args); }, delay);
    };
  };

  const throttle = (func, limit) => {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  };

  const queryAllMediaDeep = (node = document.body) => {
    let media = Array.from(node.querySelectorAll('video, audio'));
    const elementsWithShadowRoot = node.querySelectorAll('*');
    for (const el of elementsWithShadowRoot) {
      if (el.shadowRoot) {
        media = media.concat(queryAllMediaDeep(el.shadowRoot));
      }
    }
    return [...new Set(media)];
  };

  // --- HUD VISIBILITY LOGIC ---
  let hideHudTimeout;
  const showHud = () => {
    if (hudElement) {
      clearTimeout(hideHudTimeout);
      hudElement.classList.add('vsc-hud-visible');
    }
  };
  
  const startHideTimer = (duration) => {
    clearTimeout(hideHudTimeout);
    hideHudTimeout = setTimeout(() => {
        if (hudElement) {
            hudElement.classList.remove('vsc-hud-visible');
        }
    }, duration);
  };
  
  // --- CORE ACTIONS ---
  const skip = (seconds) => {
    queryAllMediaDeep().forEach(media => {
      // FIX #1: Safety check to prevent crash if video duration isn't loaded yet.
      if (isFinite(media.duration)) {
        media.currentTime = Math.max(0, Math.min(media.duration, media.currentTime + seconds));
      }
    });
    showHud();
    startHideTimer(5000);
  };

  const updateHudDisplay = () => {
    if (hudElement) {
      const speedDisplay = hudElement.querySelector('#vsc-hud-speed');
      if (speedDisplay) {
        speedDisplay.textContent = `${desiredSpeed.toFixed(2)}x`;
      }
    }
  };

  const _setSpeedForAllMedia = (newSpeed) => {
    const clampedSpeed = Math.max(0.1, Math.min(newSpeed, 16.0));
    desiredSpeed = clampedSpeed;
    queryAllMediaDeep().forEach(media => { media.playbackRate = desiredSpeed; });

    if (chrome.runtime?.id) {
        chrome.storage.sync.set({ 'videoSpeed': desiredSpeed });
        chrome.runtime.sendMessage({ action: 'updateBadge', speed: desiredSpeed });
    }
    updateHudDisplay();
    showHud();
    startHideTimer(5000);
  };
  const setSpeedForAllMedia = debounce(_setSpeedForAllMedia, 50);

  // --- HUD CREATION & MANAGEMENT ---
  const createHud = async () => {
    if (document.getElementById('vsc-hud-container')) return;
    try {
      const hudContainer = document.createElement('div');
      hudContainer.id = 'vsc-hud-container';
      hudContainer.innerHTML = `
        <div id="vsc-hud-speed" style="font-weight: bold; min-width: 50px; text-align: center;">1.00x</div>
        <div id="vsc-hud-controls" style="display: flex; gap: 6px;">
          <button id="vsc-hud-replay" title="Replay 5 seconds" aria-label="Replay 5 seconds">«</button>
          <button id="vsc-hud-decrease" title="Decrease speed" aria-label="Decrease speed">-</button>
          <button id="vsc-hud-reset" title="Reset speed" aria-label="Reset speed">Reset</button>
          <button id="vsc-hud-increase" title="Increase speed" aria-label="Increase speed">+</button>
          <button id="vsc-hud-skip" title="Skip 5 seconds" aria-label="Skip 5 seconds">»</button>
        </div>`;
      
      document.body.appendChild(hudContainer);
      hudElement = hudContainer;
      
      let isDragging = false, offsetX = 0, offsetY = 0;
      const storageKey = `vsc_hud_pos_${window.location.hostname}`;

      if (chrome.runtime?.id) {
        chrome.storage.sync.get(storageKey, (data) => {
            if (chrome.runtime.lastError) return;
            if (data[storageKey]?.top && data[storageKey]?.left) {
              hudContainer.style.top = data[storageKey].top;
              hudContainer.style.left = data[storageKey].left;
            } else {
              hudContainer.style.top = '10px';
              hudContainer.style.left = '10px';
            }
        });
      }

      const onMouseDown = (e) => {
        // FIX #2: Don't start dragging if the context is invalidated.
        if (!chrome.runtime?.id || e.target.tagName === 'BUTTON') return;
        
        isDragging = true;
        hudContainer.style.cursor = 'grabbing';
        offsetX = e.clientX - hudContainer.getBoundingClientRect().left;
        offsetY = e.clientY - hudContainer.getBoundingClientRect().top;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp, { once: true });
      };

      const onMouseMove = (e) => {
        if (!isDragging) return;
        let newLeft = Math.max(0, Math.min(e.clientX - offsetX, window.innerWidth - hudContainer.offsetWidth));
        let newTop = Math.max(0, Math.min(e.clientY - offsetY, window.innerHeight - hudContainer.offsetHeight));
        hudContainer.style.left = `${newLeft}px`;
        hudContainer.style.top = `${newTop}px`;
      };

      const onMouseUp = () => {
        isDragging = false;
        hudContainer.style.cursor = 'grab';
        document.removeEventListener('mousemove', onMouseMove);
        const finalPosition = { top: hudContainer.style.top, left: hudContainer.style.left };
        
        if (chrome.runtime?.id) {
            chrome.storage.sync.set({ [storageKey]: finalPosition });
        }
      };
      hudContainer.addEventListener('mousedown', onMouseDown);
      
      hudContainer.querySelector('#vsc-hud-increase').addEventListener('click', () => setSpeedForAllMedia(desiredSpeed + speedStep));
      hudContainer.querySelector('#vsc-hud-decrease').addEventListener('click', () => setSpeedForAllMedia(desiredSpeed - speedStep));
      hudContainer.querySelector('#vsc-hud-reset').addEventListener('click', () => setSpeedForAllMedia(1.0));
      hudContainer.querySelector('#vsc-hud-replay').addEventListener('click', () => skip(-skipAmount));
      hudContainer.querySelector('#vsc-hud-skip').addEventListener('click', () => skip(skipAmount));
      
      updateHudDisplay();
    } catch (error) { console.error('Video Speed Controller: Failed to create HUD.', error); }
  };

  // --- VIDEO DETECTION & MOUSE LISTENER LOGIC ---
  const findInteractiveContainer = (mediaElement) => {
    const twitterComponent = mediaElement.closest('[data-testid="videoComponent"]');
    if (twitterComponent) return twitterComponent;
    return mediaElement.parentElement || mediaElement;
  };

  const runDetection = () => {
    const mediaElements = queryAllMediaDeep();
    if (mediaElements.length > 0) {
      createHud();
      const currentContainers = new Set();
      mediaElements.forEach(media => {
        if (!media.getAttribute('data-vsc-processed')) {
            media.setAttribute('data-vsc-processed', 'true');
            media.addEventListener('ratechange', () => { if (media.playbackRate !== desiredSpeed) media.playbackRate = desiredSpeed; });
            media.addEventListener('loadeddata', () => { media.playbackRate = desiredSpeed; });
        }
        const container = findInteractiveContainer(media);
        currentContainers.add(container);
      });
      activeVideoContainers = currentContainers;
    } else {
      activeVideoContainers.clear();
    }
  };

  document.addEventListener('mousemove', throttle((e) => {
    if (!hudElement) return;

    let isOverVideo = false;
    for (const container of activeVideoContainers) {
      if (container.contains(e.target)) {
        isOverVideo = true;
        break;
      }
    }

    const isOverHud = hudElement.contains(e.target);

    if (isOverVideo) {
      showHud();
      startHideTimer(5000);
    } else if (isOverHud) {
      // FIX #3: If mouse is over the HUD, always show it and reset the timer.
      // This allows you to move the HUD even if it's far from a video.
      showHud();
      startHideTimer(5000);
    } else {
      // If the mouse is not over a video OR the HUD, hide the HUD.
      // The hide timer is already running from the last time we moved over a safe zone.
    }
  }, 100));

  // --- INITIALIZATION AND LISTENERS ---
  (async () => {
    const data = await chrome.storage.sync.get(['siteRules', 'videoSpeed', 'speedStep', 'skipAmount']);
    speedStep = data.speedStep || 0.10;
    skipAmount = data.skipAmount || 5;
    const siteRules = data.siteRules || {};
    const globalSpeed = data.videoSpeed || 1.0;
    const currentHostname = window.location.hostname;
    desiredSpeed = siteRules[currentHostname] || globalSpeed;
    
    _setSpeedForAllMedia(desiredSpeed);
    runDetection();
  })();

  document.addEventListener('fullscreenchange', () => {
    debounce(runDetection, 100)();
  });

  const observer = new MutationObserver(debounce(runDetection, 500));
  observer.observe(document.body, { childList: true, subtree: true });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!chrome.runtime?.id) return;
    if (message.action === 'getSpeed') {
      sendResponse({ speed: desiredSpeed });
      return true;
    }
    switch (message.action) {
      case 'increase-speed': setSpeedForAllMedia(desiredSpeed + speedStep); break;
      case 'decrease-speed': setSpeedForAllMedia(desiredSpeed - speedStep); break;
      case 'reset-speed':    setSpeedForAllMedia(1.0); break;
    }
    return true;
  });
}