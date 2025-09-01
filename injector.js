(() => {
  let hasInjectedForThisFrame = false;
  let pollingIntervalId = null;

  function checkForVideoAndInject() {
    if (hasInjectedForThisFrame) {
      clearInterval(pollingIntervalId);
      return;
    }

    const allVideos = document.querySelectorAll('video');

    for (let i = 0; i < allVideos.length; i = i + 1) {
      const video = allVideos[i];

      const isVisible = video.offsetWidth > 50 && video.offsetHeight > 50;
      const isReady = video.readyState >= 1;

      if (isVisible && isReady) {
        hasInjectedForThisFrame = true;
        clearInterval(pollingIntervalId);

        chrome.runtime.sendMessage({ action: 'injectContentScript' });
        console.log('VSC Injector: Found valid video via polling. Requesting injection.');

        break;
      }
    }
  }

  checkForVideoAndInject();
  pollingIntervalId = setInterval(checkForVideoAndInject, 250);

  setTimeout(() => {
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
    }
  }, 15000);
})();
