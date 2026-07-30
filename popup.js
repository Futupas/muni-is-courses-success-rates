const toggle = document.getElementById('toggle-switch');
const statusLabel = document.getElementById('status-label');

// Load stored state on popup open (default to enabled)
chrome.storage.local.get({ enabled: true }, (data) => {
    toggle.checked = data.enabled;
    updateUI(data.enabled);
});

// Watch for toggle switches
toggle.addEventListener('change', () => {
    const isEnabled = toggle.checked;
    updateUI(isEnabled);
    
    // Save to local storage
    chrome.storage.local.set({ enabled: isEnabled }, () => {
        // Find the active tab and notify the content script of the change
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "toggleState", enabled: isEnabled }).catch(() => {
                    // Suppress errors when clicking outside compatible pages (e.g. extension page)
                });
            }
        });
    });
});

function updateUI(enabled) {
    statusLabel.innerText = enabled ? 'Enabled' : 'Disabled';
    statusLabel.style.color = enabled ? '#0056b3' : '#666';
}
