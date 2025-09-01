// injector.js
(() => {
  // Only inject the main script if a video is found in this frame.
  // This is our primary defense against ghost HUDs.
  if (document.querySelector('video, audio')) {
    chrome.runtime.sendMessage({ action: 'injectContentScript' });
  }
})();