if (window.vscInitialized) {
} else {
  window.vscInitialized = true;
  runSpeedController();
}

function runSpeedController() {
  const scriptInstanceId = Math.random().toString(36).substring(2);
  const scriptInstanceTimestamp = Date.now();
  let isDeactivated = false;

  let desiredSpeed = 1.0;
  let speedStep = 0.10;
  let skipAmount = 5;
  let activeVideoContainers = new Set();
  let hudElement = null;
  let hasUserInteracted = false;

  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  };

  const throttle = (func, limit) => {
    let inThrottle;
    return function () {
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

  let hideHudTimeout;

  const showHud = () => {
    if (isDeactivated || !hudElement) return;
    clearTimeout(hideHudTimeout);
    hudElement.classList.add('vsc-hud-visible');
  };

  const startHideTimer = (duration) => {
    if (isDeactivated) return;
    clearTimeout(hideHudTimeout);
    hideHudTimeout = setTimeout(() => {
      if (hudElement) {
        hudElement.classList.remove('vsc-hud-visible');
      }
    }, duration);
  };

  const createHud = async () => {
    if (isDeactivated || document.getElementById(`vsc-hud-container-${scriptInstanceId}`)) return;
    try {
      const hudContainer = document.createElement('div');
      hudContainer.id = `vsc-hud-container-${scriptInstanceId}`;
      hudContainer.className = 'vsc-hud-container-class';
      hudContainer.innerHTML = `
        <div id="vsc-hud-speed" style="font-weight: bold; min-width: 50px; text-align: center;">1.00x</div>
        <div id="vsc-hud-controls" style="display: flex; gap: 6px;">
          <button id="vsc-hud-replay">«</button>
          <button id="vsc-hud-decrease">-</button>
          <button id="vsc-hud-reset">Reset</button>
          <button id="vsc-hud-increase">+</button>
          <button id="vsc-hud-skip">»</button>
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

      window.top.postMessage({
        type: 'VSC_HUD_CREATED',
        scriptInstanceId: scriptInstanceId,
        scriptInstanceTimestamp: scriptInstanceTimestamp
      }, '*');
    } catch (error) {
      console.error('VSC: Failed to create HUD.', error);
    }
  };

  const skip = (seconds) => {
    if (isDeactivated) return;
    queryAllMediaDeep().forEach(media => {
      if (isFinite(media.duration)) {
        media.currentTime = Math.max(0, Math.min(media.duration, media.currentTime + seconds));
      }
    });
    showHud();
    startHideTimer(5000);
  };

  const updateHudDisplay = () => {
    if (isDeactivated || !hudElement) return;
    const speedDisplay = hudElement.querySelector('#vsc-hud-speed');
    if (speedDisplay) {
      speedDisplay.textContent = `${desiredSpeed.toFixed(2)}x`;
    }
  };

  const _setSpeedForAllMedia = (newSpeed) => {
    if (isDeactivated) return;
    hasUserInteracted = true;
    const clampedSpeed = Math.max(0.1, Math.min(newSpeed, 16.0));
    desiredSpeed = clampedSpeed;
    queryAllMediaDeep().forEach(media => {
      if (media.readyState > 0) {
        media.playbackRate = desiredSpeed;
      }
    });
    if (chrome.runtime?.id) {
      chrome.storage.sync.set({ 'videoSpeed': desiredSpeed });
      chrome.runtime.sendMessage({ action: 'updateBadge', speed: desiredSpeed });
    }
    updateHudDisplay();
    showHud();
    startHideTimer(5000);
  };

  const setSpeedForAllMedia = debounce(_setSpeedForAllMedia, 50);

  const processMediaElement = (media) => {
    if (isDeactivated || media.getAttribute('data-vsc-processed')) return;
    media.setAttribute('data-vsc-processed', 'true');
    media.addEventListener('ratechange', () => {
      if (isDeactivated) return;
      const shouldEnforceSpeed = hasUserInteracted &&
        chrome.runtime?.id &&
        media.playbackRate !== desiredSpeed &&
        !media.paused &&
        media.readyState >= 3;
      if (shouldEnforceSpeed) {
        media.playbackRate = desiredSpeed;
      }
    });
    media.addEventListener('canplay', () => {
      if (isDeactivated) return;
      if (hasUserInteracted) {
        media.playbackRate = desiredSpeed;
      }
    });
  };

  const runDetection = () => {
    if (isDeactivated) return;
    const mediaElements = queryAllMediaDeep();
    if (mediaElements.length > 0) {
      createHud();
      const currentContainers = new Set();
      mediaElements.forEach(media => {
        processMediaElement(media);
        const container = media.parentElement || media;
        currentContainers.add(container);
      });
      activeVideoContainers = currentContainers;
    } else {
      activeVideoContainers.clear();
    }
  };

  document.addEventListener('mousemove', throttle((e) => {
    if (isDeactivated || !hudElement) return;
    let isOverVideo = false;
    for (const container of activeVideoContainers) {
      if (container.contains(e.target)) {
        isOverVideo = true;
        break;
      }
    }
    const isOverHud = hudElement.contains(e.target);
    if (isOverVideo || isOverHud) {
      showHud();
      startHideTimer(5000);
    }
  }, 100));

  (async () => {
    const handleCompetition = (event) => {
      if (event.data.type === 'VSC_HUD_CREATED' && event.data.scriptInstanceId !== scriptInstanceId) {
        if (event.data.scriptInstanceTimestamp > scriptInstanceTimestamp) {
          console.log(`VSC (${scriptInstanceId}): Deactivating because a newer instance has taken over.`);
          isDeactivated = true;
          if (hudElement) {
            hudElement.remove();
          }
          window.removeEventListener('message', handleCompetition);
        }
      }
    };
    window.addEventListener('message', handleCompetition);

    const data = await chrome.storage.sync.get(['siteRules', 'videoSpeed', 'speedStep', 'skipAmount']);
    speedStep = data.speedStep || 0.10;
    skipAmount = data.skipAmount || 5;
    const siteRules = data.siteRules || {};
    const globalSpeed = data.videoSpeed || 1.0;
    const currentHostname = window.location.hostname;
    desiredSpeed = siteRules[currentHostname] || globalSpeed;

    runDetection();
  })();

  document.addEventListener('fullscreenchange', () => {
    if (!isDeactivated) debounce(runDetection, 100)();
  });

  const observer = new MutationObserver(() => {
    if (!isDeactivated) debounce(runDetection, 500)();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (isDeactivated || !chrome.runtime?.id) return;
    if (message.action === 'getSpeed') {
      sendResponse({ speed: desiredSpeed });
      return true;
    }
    switch (message.action) {
      case 'set-speed':
        setSpeedForAllMedia(message.speed);
        break;
      case 'increase-speed':
        setSpeedForAllMedia(desiredSpeed + speedStep);
        break;
      case 'decrease-speed':
        setSpeedForAllMedia(desiredSpeed - speedStep);
        break;
      case 'reset-speed':
        setSpeedForAllMedia(1.0);
        break;
    }
    return true;
  });
}
