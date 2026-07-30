# IS MUNI Course Stats Enhancer

A browser utility that dynamically fetches and displays course success rates  directly next to course links on IS MUNI. It automates the process of evaluating courses without requiring you to manually click through deep links.

![IS MUNI Course Stats Screenshot](images/screenshot.png)

## Core Features
* **At-a-Glance Success Rates:** Adds a color-coded badge (e.g., `SR: 90%`) next to course links. Colors automatically scale from red (low success) to green (high success).
* **Detailed Popups:** Click on any badge to view a detailed popup containing the course code, cleaned course name, semester, total student count, average grade, and a categorized grade breakdown.
* **Smart Viewport Fetching:** Uses the browser's native `IntersectionObserver` to trigger fetches *only* when a course link actually scrolls into view, keeping network traffic and server load minimal.
* **Deduplicated Network Requests:** If the same course link appears multiple times on your screen, the script automatically batches them. It loads the invisible iframe only once, updating all associated badges simultaneously.
* **Bilingual:** Works with both English and Czech versions of the website.

---

## Installation & Usage

### Option 1: User JavaScript and CSS
This is a highly popular extension for applying custom scripts and styles to specific websites.

1. Install **User JavaScript and CSS** for your browser:
   * **Chrome Web Store:** [User JavaScript and CSS](https://chromewebstore.google.com/detail/nbhcbdghjpllgmfilhnhkllmkecfmpld)
2. Open [is.muni.cz](https://is.muni.cz/).
3. Click the extension icon and click **"Add New"** (or create a new rule for `is.muni.cz`).
4. In the left panel (the **JS** tab), paste the entire script code.
5. In the URL targeting settings on the right, ensure the rule matches `is.muni.cz`.
6. Click **Save**. The script will now execute automatically whenever you browse course directories on IS MUNI.

---

### Option 2: Tampermonkey (Standard Userscript Manager)
A dedicated userscript manager that supports automatic script updates.

1. Install **Tampermonkey** for your browser:
   * **Official Website:** [Tampermonkey.net](https://www.tampermonkey.net/)
   * **Chrome Web Store:** [Tampermonkey for Chrome](https://chromewebstore.google.com/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   * **Firefox Add-ons:** [Tampermonkey for Firefox](https://addons.mozilla.org/firefox/addon/tampermonkey/)
   * **Mac App Store:** [Tampermonkey for Safari](https://apps.apple.com/app/tampermonkey/id1482490089)
2. Click the extension icon and select **"Create a new script"**.
3. Replace the template code with the full script, ensuring you have the correct metadata block at the very top:

```javascript
// ==UserScript==
// @name         IS MUNI Course Stats Enhancer
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Displays course success rates and names on IS MUNI next to links as you scroll.
// @match        *://is.muni.cz/*
// @grant        none
// ==/UserScript==

(async function() {
    // ... paste the rest of the script here ...
})();
```
4. Save the script (`Ctrl + S` or `Cmd + S`).

---

### Option 3: Developer Console (Temporary Run)
Useful for quick testing without installing extensions.

1. Navigate to any page on [is.muni.cz](https://is.muni.cz/) containing course links.
2. Open the developer tools by pressing `F12` (or `Ctrl + Shift + J` / `Cmd + Option + J`).
3. Paste the entire script code into the **Console** tab and press **Enter**.
4. Scroll down to see the loading badges appear as links enter your viewport.

*Note: You can use basically **any** browser extension or add-on that allows you to run custom JavaScript on specific pages. As long as the tool can inject and run this script under the `is.muni.cz` domain, the enhancer will function properly.*

---

## Web Extension Branch (`web-extension`)

A fully-featured, production-ready version of this tool is available as a standalone browser extension in the `web-extension` branch. 

Unlike the basic userscript, the Web Extension version includes:
* **Interactive Toolbar Popup:** A clean UI featuring a native On/Off sliding toggle.
* **On-the-Fly Cleanup:** Toggling the extension to "Off" instantly removes all custom stylesheets, loading badges, and popup DOM structures, and disconnects all observers without requiring a page reload.
* **Persistent Settings:** Your preferences are saved automatically using the browser's local storage API.

To switch to the extension codebase: `git checkout web-extension`
Or follow https://github.com/Futupas/muni-is-courses-success-rates/tree/web-extension

Made with ❤️ by Futupas. If you want to thank me, you can always buy me a beer
