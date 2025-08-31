// File: content.js (Complete version with Site Exclusion)

// --- INITIALIZATION CHECK (GATEKEEPER) ---
// This async IIFE (Immediately Invoked Function Expression) acts as the main gatekeeper.
// It checks if the current site is excluded before running any of the speed control logic.
(async () => {
  try {
    const data = await chrome.storage.sync.get(['excludedSites']);
    const excludedSites = data.excludedSites || [];
    const currentHostname = window.location.hostname;

    // If the current website is in our exclusion list, stop the script immediately.
    if (excludedSites.includes(currentHostname)) {
      console.log(`Video Speed Controller is disabled on ${currentHostname}.`);
      return;
    }
    
    // If the site is not excluded, proceed to run the main controller logic.
    runSpeedController();

  } catch (error) {
    console.error("Video Speed Controller: Error during initialization check.", error);
  }
})();


// --- MAIN LOGIC WRAPPER ---
// All of the extension's active functionality is contained within this function.
// It will only be called if the site is not on the exclusion list.
function runSpeedController() {

  let desiredSpeed = 1.0;
  let speedStep = 0.10;
let skipAmount = 5;

 // --- NEW: HUD Visibility Logic ---
    let hideHudTimeout;

    // This function makes the HUD visible and cancels any pending hide command.
    const showHud = () => {
        const hud = document.getElementById('vsc-hud-container');
        if (hud) {
            clearTimeout(hideHudTimeout);
            hud.classList.add('vsc-hud-visible');
        }
    };

    // This function starts the 2-second countdown to hide the HUD.
    const startHideTimer = () => {
        clearTimeout(hideHudTimeout);
        hideHudTimeout = setTimeout(() => {
            const hud = document.getElementById('vsc-hud-container');
            if (hud) {
                hud.classList.remove('vsc-hud-visible');
            }
        }, 2000); // Hide after 2 seconds
    };
    
    // Attaches all necessary visibility events to a given element (video or HUD).
    const attachHudVisibilityEvents = (element) => {
        if (element.getAttribute('data-vsc-events-attached')) return;
        element.setAttribute('data-vsc-events-attached', 'true');

        // Show the HUD instantly when the mouse enters the element's area.
        element.addEventListener('mouseenter', showHud);

        // While the mouse is moving over the element, continuously reset the hide timer.
        element.addEventListener('mousemove', () => {
            showHud(); // Keep it visible
            startHideTimer(); // And reset the hide timer
        });

        // When the mouse leaves the element's area, start the hide timer one last time.
        element.addEventListener('mouseleave', startHideTimer);
    };
   // --- DEBOUNCE UTILITY FUNCTION ---
  // This function prevents a function from being called too frequently.
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  };

   // *** NEW FLAG to prevent storage listener feedback loop ***
  let isLocalChange = false;

  // --- HELPER FUNCTION: Deep Media Query ---
  // Recursively searches for video/audio elements, including inside Shadow DOMs.
  const queryAllMediaDeep = (node = document.body) => {
    let media = Array.from(node.querySelectorAll('video, audio'));
    const elementsWithShadowRoot = node.querySelectorAll('*');
    for (const el of elementsWithShadowRoot) {
      if (el.shadowRoot) {
        media = media.concat(queryAllMediaDeep(el.shadowRoot));
      }
    }
    return [...new Set(media)]; // Return a unique set of elements
  };
  // *** NEW FUNCTION: Skip/Replay ***
  const skip = (seconds) => {
    queryAllMediaDeep().forEach(media => {
      // Ensure we don't go past the beginning or end of the media
      media.currentTime = Math.max(0, Math.min(media.duration, media.currentTime + seconds));
    });
  };

  // --- HUD HELPER FUNCTIONS ---
  const updateHudDisplay = () => {
    const speedDisplay = document.getElementById('vsc-hud-speed');
    if (speedDisplay) {
      speedDisplay.textContent = `${desiredSpeed.toFixed(2)}x`;
    }
  };

  const createHud = async () => {
    if (document.getElementById('vsc-hud-container')) return;
    try {
      const hudHtmlUrl = chrome.runtime.getURL('hud.html');
      const hudCssUrl = chrome.runtime.getURL('hud.css');
      const [htmlContent, cssContent] = await Promise.all([
        fetch(hudHtmlUrl).then(res => res.text()),
        fetch(hudCssUrl).then(res => res.text())
      ]);

      const hudContainer = document.createElement('div');
      hudContainer.id = 'vsc-hud-container';
      hudContainer.innerHTML = htmlContent;
      document.body.appendChild(hudContainer);

      const styleElement = document.createElement('style');
      styleElement.textContent = cssContent;
      document.head.appendChild(styleElement);

      attachHudVisibilityEvents(document.getElementById('vsc-hud-container'));
      hudContainer.addEventListener('mouseenter', showHud);
      hudContainer.addEventListener('mouseleave', startHideTimer);
      
      let isDragging = false, offsetX = 0, offsetY = 0;
      const storageKey = `vsc_hud_pos_${window.location.hostname}`;

      chrome.storage.sync.get(storageKey, (data) => {
        if (data[storageKey]) {
          hudContainer.style.top = data[storageKey].top;
          hudContainer.style.left = data[storageKey].left;
        } else {
          hudContainer.style.top = '10px';
          hudContainer.style.left = '10px';
        }
      });

      const onMouseDown = (e) => {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        hudContainer.style.cursor = 'grabbing';
        offsetX = e.clientX - hudContainer.getBoundingClientRect().left;
        offsetY = e.clientY - hudContainer.getBoundingClientRect().top;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp, { once: true });
      };

      const onMouseMove = (e) => {
        if (!isDragging) return;
        const rect = hudContainer.getBoundingClientRect();
        let newLeft = Math.max(0, Math.min(e.clientX - offsetX, window.innerWidth - rect.width));
        let newTop = Math.max(0, Math.min(e.clientY - offsetY, window.innerHeight - rect.height));
        hudContainer.style.left = `${newLeft}px`;
        hudContainer.style.top = `${newTop}px`;
      };

      const onMouseUp = () => {
        isDragging = false;
        hudContainer.style.cursor = 'grab';
        document.removeEventListener('mousemove', onMouseMove);
        const finalPosition = { top: hudContainer.style.top, left: hudContainer.style.left };
        chrome.storage.sync.set({ [storageKey]: finalPosition });
      };
      hudContainer.addEventListener('mousedown', onMouseDown);
      
      document.getElementById('vsc-hud-increase').addEventListener('click', () => setSpeedForAllMedia(desiredSpeed + speedStep));
      document.getElementById('vsc-hud-decrease').addEventListener('click', () => setSpeedForAllMedia(desiredSpeed - speedStep));
      document.getElementById('vsc-hud-reset').addEventListener('click', () => setSpeedForAllMedia(1.0));

       // Add event listeners to buttons
      document.getElementById('vsc-hud-increase').addEventListener('click', () => setSpeedForAllMedia(desiredSpeed + speedStep));
      document.getElementById('vsc-hud-decrease').addEventListener('click', () => setSpeedForAllMedia(desiredSpeed - speedStep));
      document.getElementById('vsc-hud-reset').addEventListener('click', () => setSpeedForAllMedia(1.0));
      
      // Add listeners for our new buttons
      document.getElementById('vsc-hud-replay').addEventListener('click', () => skip(-skipAmount));
      document.getElementById('vsc-hud-skip').addEventListener('click', () => skip(skipAmount));
      
      updateHudDisplay();
    } catch (error) {
      console.error('Video Speed Controller: Failed to create HUD.', error);
    }
  };

  // --- CORE SPEED CONTROL FUNCTIONS ---
   const _setSpeedForAllMedia = (newSpeed) => {
    const clampedSpeed = Math.max(0.1, Math.min(newSpeed, 16.0));
    desiredSpeed = clampedSpeed;
    
    queryAllMediaDeep().forEach(media => { media.playbackRate = desiredSpeed; });
    
    chrome.storage.sync.set({ 'videoSpeed': desiredSpeed });
    updateHudDisplay();
    chrome.runtime.sendMessage({ action: 'updateBadge', speed: desiredSpeed });
  };
  
  const setSpeedForAllMedia = debounce(_setSpeedForAllMedia, 50);

  const applySpeedToMedia = (media) => {
    if (media.getAttribute('data-speed-controller-active')) return;
    media.setAttribute('data-speed-controller-active', 'true');
    
    media.playbackRate = desiredSpeed; 

    media.addEventListener('ratechange', () => { if (media.playbackRate !== desiredSpeed) media.playbackRate = desiredSpeed; });
    media.addEventListener('loadeddata', () => { media.playbackRate = desiredSpeed; });
    attachHudVisibilityEvents(media);
    createHud();
  };

  const processAllMedia = () => { queryAllMediaDeep().forEach(applySpeedToMedia); };

  // --- INITIALIZATION AND LISTENERS for the controller ---
  (async () => {
      const currentHostname = window.location.hostname;
        const data = await chrome.storage.sync.get(['siteRules', 'videoSpeed', 'speedStep', 'skipAmount']);
        const siteRules = data.siteRules || {};
        const globalSpeed = data.videoSpeed || 1.0;

        speedStep = data.speedStep || 0.10;
        skipAmount = data.skipAmount || 5;

      if (siteRules[currentHostname]) {
            desiredSpeed = siteRules[currentHostname];
        } else {
            desiredSpeed = globalSpeed;
        }

      _setSpeedForAllMedia(desiredSpeed);
      processAllMedia();
  })();

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.videoSpeed) {
      _setSpeedForAllMedia(changes.videoSpeed.newValue);
    }
  });

   const observer = new MutationObserver(() => processAllMedia());
  observer.observe(document.body, { childList: true, subtree: true });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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