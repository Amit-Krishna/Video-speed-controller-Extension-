# Video Speed Controller - Chrome Extension

A powerful, feature-rich browser extension that allows you to control the playback speed of any HTML5 video on any website. This project was built from the ground up and includes an on-page controller, keyboard shortcuts, and a full options page for customization.

## Features

*   **Universal Compatibility:** Works on almost any website with an HTML5 video player, including major streaming platforms and complex e-learning sites that use **sandboxed iFrames**.
*   **On-Page HUD:** An intuitive, auto-hiding controller appears directly on the page. No need to open a popup!
*   **Draggable HUD:** Move the controller to wherever you like on the screen. The position is saved per-site.
*   **Full Keyboard Control:**
    *   **Increase Speed:** `Ctrl+Shift+.`
    *   **Decrease Speed:** `Ctrl+Shift+,`
    *   **Reset Speed:** `Ctrl+Shift+0`
    *   **Skip/Rewind:** Use the `«` and `»` buttons on the HUD.
*   **Full Customization via Options Page:**
    *   Set per-site default speeds (e.g., always 1.5x on YouTube).
    *   Manage a site exclusion list to disable the extension where you don't need it.
    *   Customize the speed step and skip/replay time amounts.
*   **Accessible & Ready for Translation:** Built with accessibility (ARIA labels) and internationalization (i18n) from the start.
*   **Modern & Secure:** Built with Manifest V3 for modern security and performance.

## Installation

1.  Navigate to the **[Releases](../../releases)** page of this repository.
2.  Download the `.zip` file from the latest release.
3.  Unzip the downloaded file on your computer.
4.  Open your Chrome or Edge browser and navigate to `chrome://extensions`.
5.  Enable **"Developer mode"** in the top-right corner.
6.  Click the **"Load unpacked"** button.
7.  Select the unzipped project folder (the one containing `manifest.json`).
8.  The extension is now installed and ready to use!

## Why This Speed Controller?

This project was built to address the limitations of other extensions, specifically on modern websites that use advanced techniques like sandboxed `iFrames` and specialized video player libraries. By using a programmatic injection method and a user-initiated control model, this extension offers superior compatibility where others may fail, ensuring a smooth experience across the web.