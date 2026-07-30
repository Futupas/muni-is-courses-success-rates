# IS MUNI Course Stats Enhancer (Web Extension)

A Manifest V3 browser extension for Google Chrome, Mozilla Firefox, Microsoft Edge, and Apple Safari. It dynamically fetches and displays course success rates, full course names, and graded evaluations directly next to course links on IS MUNI.

## Features

* **At-a-Glance Success Rates:** Adds a color-coded badge (e.g., `SR: 90%`) next to course links. Colors scale automatically from red (low success) to green (high success).
* **On/Off Toolbar Toggle:** A clean extension popup bubble containing a sliding toggle switch. Turning the extension off instantly cleans up the page (removes badges, stylesheets, and popup DOM elements) without requiring a reload.
* **Bilingual Support:** Natively supports both Czech and English IS MUNI interfaces.
* **Smart Viewport Fetching:** Uses the browser's native `IntersectionObserver` to trigger fetches *only* when a course link scrolls into your active viewport.
* **Request Deduplication:** If identical course links appear on your screen simultaneously, the extension batches them—loading the invisible iframe only once to update all matching badges.
* **Title Cleaning:** Pulls the actual course name from the course home page and cleanly filters out MUNI clutter phrases (e.g., `"Informace o předmětu"` or `"Course Information"`) supporting multiple dash formats (`-`, `–`, `—`).

---

## File Structure

* `manifest.json` — The extension configuration file declaring matches, popup actions, and permissions.
* `popup.html` — The layout for the sliding switch inside the toolbar popup.
* `popup.js` — Handles local storage state and dispatches live toggle signals to the open tabs.
* `content.js` — The core visibility-based parser and iframe scraper.
* `icon.png` — The extension icon (can be generated using our custom icon generator tool).

---

## Local Installation

### Google Chrome / Microsoft Edge / Brave
1. Clone or download this branch to your computer.
2. Open your browser and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click **Load unpacked** in the top left.
5. Select the folder containing these files.

### Mozilla Firefox
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**
3. Select any file in your extension folder (e.g., `manifest.json`).

### Apple Safari
1. Open the **Develop** menu in Safari's settings and check **Allow Unsigned Extensions**.
2. Because Apple requires extensions to be wrapped inside native Mac Apps, you must compile the folder using Xcode. Run the following command in your macOS terminal:
    ```bash
    xcrun safari-web-extension-converter /path/to/your/extension-folder
    ```
---

Made with ❤️ by Futupas. If you want to thank me, you can always buy me a beer
