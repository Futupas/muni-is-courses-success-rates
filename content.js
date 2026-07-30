// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
const GRADE_CATEGORIES = {
    'A': 'pass', 'B': 'pass', 'C': 'pass', 'D': 'pass', 'E': 'pass', 'Z': 'pass', 'P': 'pass',
    'F': 'fail', '-': 'fail', 'N': 'fail', 'X': 'fail',
};

const COLORS = { pass: '#4caf50', fail: '#f44336', unknown: '#9e9e9e' };
const styleId = 'sr-style-pnd';
const popupId = 'sr-popup-pnd';

// State trackers
let isInitialized = false;
let domObserver = null;
let visibilityObserver = null;
const statsCache = new Map();     
const pendingFetches = new Map(); 

// ==========================================
// CORE LOGIC & PARSING
// ==========================================
function loadViaIframe(url) {
    return new Promise((resolve, reject) => {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed'; iframe.style.width = '1px'; iframe.style.height = '1px'; 
        iframe.style.opacity = '0'; iframe.style.pointerEvents = 'none';
        
        iframe.addEventListener('load', () => {
            try {
                const iDoc = iframe.contentDocument || iframe.contentWindow.document;
                resolve({ iDoc, close: () => iframe.remove() });
            } catch (e) { iframe.remove(); reject(e); }
        });
        iframe.addEventListener('error', () => { iframe.remove(); reject(new Error('Load failed')); });
        iframe.src = url; document.body.appendChild(iframe);
    });
}

function getColorForSuccessRate(sr) {
    if (typeof sr !== 'number' || isNaN(sr)) return 'gray';
    const index = Math.max(0, Math.min(9, Math.floor((sr - 46) / 5)));
    const hue = Math.round(index * 13.33); 
    return `hsl(${hue}, 80%, 42%)`;
}

function showPopup(event, stats) {
    const popup = document.getElementById(popupId);
    if (!popup) return;

    let gradesHtml = '';
    for (const [grade, data] of Object.entries(stats.grades)) {
        const type = GRADE_CATEGORIES[grade] || 'unknown';
        const color = COLORS[type];
        gradesHtml += `<div class="sr-popup-row" style="color: ${color}">
            <span>Grade <b>${grade}</b></span> 
            <span><b>${data.count}</b> <span style="opacity: 0.7; font-size: 0.9em">(${data.percentage}%)</span></span>
        </div>`;
    }

    popup.innerHTML = `
        <div class="sr-popup-close" id="sr-close-pnd-btn">✕</div>
        <div class="sr-popup-header">
            <div class="sr-popup-code">${stats.courseCode} <span style="font-weight:normal; color:#666;">(${stats.semester})</span></div>
            ${stats.courseFullName ? `<div class="sr-popup-name">${stats.courseFullName}</div>` : ''}
        </div>
        <div class="sr-popup-row"><span>Total Students:</span> <b>${stats.totalStudents}</b></div>
        <div class="sr-popup-row"><span>Success Rate:</span> <b>${stats.successRate}%</b></div>
        ${stats.average ? `<div class="sr-popup-row"><span>Average:</span> <b>${stats.average}</b></div>` : ''}
        <div style="border-top: 1px solid #eee; margin: 8px 0;"></div>
        ${gradesHtml}
    `;
    
    popup.style.display = 'block';
    popup.style.left = (event.pageX + 15) + 'px';
    popup.style.top = (event.pageY + 15) + 'px';
    
    const rect = popup.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        popup.style.left = (window.innerWidth - rect.width - 20) + 'px';
    }

    document.getElementById('sr-close-pnd-btn').onclick = () => popup.style.display = 'none';
}

async function fetchCourseStats(url) {
    let iframe1, iframe2;
    try {
        iframe1 = await loadViaIframe(url);
        
        let courseFullName = '';
        const appNameEl = iframe1.iDoc.querySelector('#app_name');
        if (appNameEl) {
            const rawName = appNameEl.innerText.replace(/\s+/g, ' ').trim();
            courseFullName = rawName
                .replace(/^(Informace o předmětu|Course Information)\s*[\-–—‐‑‒―\s]+/gi, '')
                .replace(/\s*[\-–—‐‑‒―\s]+(Informace o předmětu|Course Information)$/gi, '')
                .replace(/Informace o předmětu|Course Information/gi, '')
                .trim();
        }

        const statsLink = Array.from(iframe1.iDoc.querySelectorAll('#app_content > ul > li a'))
            .find(a => {
                const text = a.innerText.trim().toLowerCase();
                return (text === 'nejnovější' || text === 'recent') && a.href.includes('statistika_znamek');
            });
        
        if (!statsLink) throw new Error("No stats");
        const statsUrl = statsLink.href;
        iframe1.close(); 

        iframe2 = await loadViaIframe(statsUrl);
        const table = iframe2.iDoc.querySelector('#app_content table.data1');
        if (!table) throw new Error("No table");

        const rows = table.querySelectorAll('tr');
        const headers = Array.from(rows[0].querySelectorAll('th')).map(th => th.innerText.trim());
        const dataCells = Array.from(rows[1].querySelectorAll('td')).map(td => td.innerText.trim());

        const rawCourseStr = dataCells[0].replace(/\s+/g, ' ').trim();
        const semesterMatches = [...rawCourseStr.matchAll(/\(([^)]+)\)/g)];
        const semester = semesterMatches.length ? semesterMatches[semesterMatches.length - 1][1] : 'Unknown Sem';
        const courseCode = rawCourseStr.replace(/\s*\(.*?\)\s*$/, '');

        const stats = { courseCode, courseFullName, semester, totalStudents: 0, successRate: null, average: null, grades: {} };

        for (let i = 1; i < headers.length; i++) {
            const header = headers[i];
            const value = dataCells[i];
            if (header === 'Celkem studentů' || header === 'Total Number of Students') {
                stats.totalStudents = parseInt(value, 10) || 0;
            } else if (header === 'Úspěšně' || header === 'Completed') {
                stats.successRate = parseFloat(value.replace(/[^\d.-]/g, ''));
            } else if (header === 'Průměr' || header === 'Average') {
                stats.average = parseFloat(value.replace(',', '.'));
            } else {
                stats.grades[header] = { count: parseInt(value, 10) || 0 };
            }
        }

        if (stats.totalStudents > 0) {
            for (const grade in stats.grades) {
                stats.grades[grade].percentage = parseFloat(((stats.grades[grade].count / stats.totalStudents) * 100).toFixed(2));
            }
        }
        return stats;
    } finally {
        if (iframe1) iframe1.close();
        if (iframe2) iframe2.close();
    }
}

async function processLinkUI(a) {
    // Escape early if disabled during task execution
    if (!isInitialized) return;

    const span = document.createElement('span');
    span.className = 'sr-badge sr-loading';
    span.innerText = 'SR: ';
    a.insertAdjacentElement('afterend', span);

    const url = a.href;
    let stats;

    try {
        if (statsCache.has(url)) {
            stats = statsCache.get(url);
        } else if (pendingFetches.has(url)) {
            stats = await pendingFetches.get(url);
        } else {
            const fetchPromise = fetchCourseStats(url);
            pendingFetches.set(url, fetchPromise);
            stats = await fetchPromise;
            statsCache.set(url, stats);
            pendingFetches.delete(url);
        }

        if (!stats || !isInitialized) {
            span.remove();
            return;
        }

        span.className = 'sr-badge'; 
        span.innerText = `SR: ${stats.successRate}%`;
        span.style.color = getColorForSuccessRate(stats.successRate);
        span.title = `Success rate: ${stats.successRate}% (${stats.semester}). Click to view details.`;
        
        span.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            showPopup(e, stats);
        });

    } catch (error) {
        if (span.parentNode) {
            span.className = 'sr-badge'; span.innerText = `SR: ?`; span.style.color = 'gray';
            span.title = 'No statistics available.';
        }
    }
}

function observeNewCourses() {
    if (!isInitialized) return;
    const links = document.querySelectorAll(
        'a[href*="/predmet/"]:not([data-is-mu-courses-pass-stats-processes-pnd="true"]):not([data-sr-observing="true"]), ' +
        'a[href*="/course/"]:not([data-is-mu-courses-pass-stats-processes-pnd="true"]):not([data-sr-observing="true"])'
    );
    
    links.forEach(a => {
        a.dataset.srObserving = "true"; 
        visibilityObserver.observe(a); 
    });
}

function closePopupOnOutsideClick(e) {
    const popup = document.getElementById(popupId);
    if (popup && !popup.contains(e.target) && !e.target.classList.contains('sr-badge')) {
        popup.style.display = 'none';
    }
}

// ==========================================
// CONTROLLER: INITIALIZE & CLEANUP
// ==========================================
function initializeExtension() {
    if (isInitialized) return;
    isInitialized = true;

    // 1. Inject CSS
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            .sr-badge { margin-left: 6px; font-size: 0.85em; font-weight: bold; white-space: nowrap; cursor: pointer; padding: 2px 4px; border-radius: 4px; transition: background 0.2s;}
            .sr-badge:hover { background: rgba(0,0,0,0.05); }
            .sr-loading { color: #888; cursor: default; pointer-events: none; }
            .sr-loading::after { content: ''; animation: dots 1.5s steps(4, end) infinite; }
            @keyframes dots { 0% { content: ''; } 25% { content: '.'; } 50% { content: '..'; } 75% { content: '...'; } }
            
            #sr-popup-pnd {
                position: absolute; background: white; border: 1px solid #ccc; box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                padding: 12px; border-radius: 8px; z-index: 999999; display: none;
                font-family: Arial, sans-serif; font-size: 13px; color: #333; min-width: 220px;
            }
            .sr-popup-header { border-bottom: 2px solid #eee; padding-bottom: 6px; margin-bottom: 8px; }
            .sr-popup-code { font-weight: bold; font-size: 14px; }
            .sr-popup-name { font-size: 12px; color: #555; margin-top: 3px; line-height: 1.2; font-weight: normal; }
            .sr-popup-row { display: flex; justify-content: space-between; margin: 4px 0; }
            .sr-popup-close { float: right; cursor: pointer; color: #aaa; font-weight: bold; margin-left: 10px; }
            .sr-popup-close:hover { color: #333; }
        `;
        document.head.appendChild(style);
    }

    // 2. Inject popup wrapper
    if (!document.getElementById(popupId)) {
        const popup = document.createElement('div');
        popup.id = popupId;
        document.body.appendChild(popup);
    }

    // 3. Setup Observers
    visibilityObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const a = entry.target;
                observer.unobserve(a); 
                a.dataIsMuCoursesPassStatsProcessesPND = true;
                a.dataset.isMuCoursesPassStatsProcessesPnd = "true";
                processLinkUI(a);
            }
        });
    }, { root: null, threshold: 0.1 });

    observeNewCourses();

    domObserver = new MutationObserver((mutations) => {
        const hasAddedNodes = mutations.some(m => m.addedNodes.length > 0);
        if (hasAddedNodes) observeNewCourses();
    });
    domObserver.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('click', closePopupOnOutsideClick);
    console.log("[IS MUNI Stats] Enhancer initialized.");
}

function cleanupExtension() {
    if (!isInitialized) return;
    isInitialized = false;

    // Disconnect observers
    if (domObserver) { domObserver.disconnect(); domObserver = null; }
    if (visibilityObserver) { visibilityObserver.disconnect(); visibilityObserver = null; }

    document.removeEventListener('click', closePopupOnOutsideClick);

    // Remove injected badges, popup, style
    document.querySelectorAll('.sr-badge').forEach(span => span.remove());
    const style = document.getElementById(styleId); if (style) style.remove();
    const popup = document.getElementById(popupId); if (popup) popup.remove();

    // Clear processed attributes on elements
    document.querySelectorAll('a[href*="/predmet/"], a[href*="/course/"]').forEach(a => {
        delete a.dataIsMuCoursesPassStatsProcessesPND;
        a.removeAttribute('data-is-mu-courses-pass-stats-processes-pnd');
        a.removeAttribute('data-sr-observing');
    });

    console.log("[IS MUNI Stats] Enhancer disabled & cleaned up.");
}

// ==========================================
// LISTENERS & ENTRY POINT
// ==========================================
// 1. Initial State Check
chrome.storage.local.get({ enabled: true }, (data) => {
    if (data.enabled) {
        initializeExtension();
    }
});

// 2. Listen for Toggle signals from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "toggleState") {
        if (message.enabled) {
            initializeExtension();
        } else {
            cleanupExtension();
        }
    }
});
