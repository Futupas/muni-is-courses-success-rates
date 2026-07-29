(async function() {
    // ==========================================
    // CONFIGURATION
    // ==========================================
    const GRADE_CATEGORIES = {
        'A': 'pass', 'B': 'pass', 'C': 'pass', 'D': 'pass', 'E': 'pass', 'Z': 'pass', 'P': 'pass',
        'F': 'fail', '-': 'fail', 'N': 'fail', 'X': 'fail',
    };

    const COLORS = { pass: '#4caf50', fail: '#f44336', unknown: '#9e9e9e' };

    // ==========================================
    // INJECT CSS
    // ==========================================
    const style = document.createElement('style');
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
        .sr-popup-header { font-weight: bold; font-size: 14px; margin-bottom: 8px; border-bottom: 2px solid #eee; padding-bottom: 6px; }
        .sr-popup-row { display: flex; justify-content: space-between; margin: 4px 0; }
        .sr-popup-close { float: right; cursor: pointer; color: #aaa; font-weight: bold; }
        .sr-popup-close:hover { color: #333; }
    `;
    document.head.appendChild(style);

    const popup = document.createElement('div');
    popup.id = 'sr-popup-pnd';
    document.body.appendChild(popup);

    document.addEventListener('click', (e) => {
        if (!popup.contains(e.target) && !e.target.classList.contains('sr-badge')) {
            popup.style.display = 'none';
        }
    });

    // ==========================================
    // HELPER FUNCTIONS
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
            <div class="sr-popup-close" onclick="document.getElementById('sr-popup-pnd').style.display='none'">✕</div>
            <div class="sr-popup-header">${stats.courseCode} <span style="font-weight:normal; color:#666;">(${stats.semester})</span></div>
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
    }

    // ==========================================
    // CORE FETCH LOGIC (Returns raw data, doesn't touch UI directly)
    // ==========================================
    async function fetchCourseStats(url) {
        let iframe1, iframe2;
        try {
            iframe1 = await loadViaIframe(url);
            const statsLink = Array.from(iframe1.iDoc.querySelectorAll('#app_content > ul > li a'))
                .find(a => a.innerText.trim().toLowerCase() === 'nejnovější' && a.href.includes('statistika_znamek'));
            
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

            const stats = { courseCode, semester, totalStudents: 0, successRate: null, average: null, grades: {} };

            for (let i = 1; i < headers.length; i++) {
                const header = headers[i];
                const value = dataCells[i];
                if (header === 'Celkem studentů') stats.totalStudents = parseInt(value, 10) || 0;
                else if (header === 'Úspěšně') stats.successRate = parseFloat(value.replace(/[^\d.-]/g, ''));
                else if (header === 'Průměr') stats.average = parseFloat(value.replace(',', '.'));
                else stats.grades[header] = { count: parseInt(value, 10) || 0 };
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

    // ==========================================
    // UI PROCESSING & DEDUPLICATION
    // ==========================================
    const statsCache = new Map();     // url -> resolved stats
    const pendingFetches = new Map(); // url -> active promise

    async function processLinkUI(a) {
        // Add animated dots immediately
        const span = document.createElement('span');
        span.className = 'sr-badge sr-loading';
        span.innerText = 'SR: ';
        a.insertAdjacentElement('afterend', span);

        const url = a.href;
        let stats;

        try {
            // Deduplication logic: Don't load iframes twice for identical courses on screen
            if (statsCache.has(url)) {
                stats = statsCache.get(url);
            } else if (pendingFetches.has(url)) {
                stats = await pendingFetches.get(url); // Wait for the active iframe to finish
            } else {
                const fetchPromise = fetchCourseStats(url);
                pendingFetches.set(url, fetchPromise);
                stats = await fetchPromise;
                statsCache.set(url, stats);
                pendingFetches.delete(url);
            }

            if (!stats) throw new Error("Stats not available");

            // Apply stats to UI
            span.className = 'sr-badge'; 
            span.innerText = `SR: ${stats.successRate}%`;
            span.style.color = getColorForSuccessRate(stats.successRate);
            span.title = `Success rate: ${stats.successRate}% (${stats.semester}). Click to view details.`;
            
            span.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                showPopup(e, stats);
            });

        } catch (error) {
            span.className = 'sr-badge'; span.innerText = `SR: ?`; span.style.color = 'gray';
            span.title = 'No statistics available.';
        }
    }

    // ==========================================
    // VISIBILITY OBSERVER (Triggered by Scroll natively)
    // ==========================================
    const visibilityObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            // If the element is actually visible in the browser window
            if (entry.isIntersecting) {
                const a = entry.target;
                
                // Stop observing it (we only want to fetch once)
                observer.unobserve(a); 

                // Mark the element exactly as requested so we ignore it completely in the future
                a.dataIsMuCoursesPassStatsProcessesPND = true;
                a.dataset.isMuCoursesPassStatsProcessesPnd = "true";
                
                // Start the fetch & UI process
                processLinkUI(a);
            }
        });
    }, {
        root: null, // Viewport
        threshold: 0.1 // Triggers when 10% of the link enters the screen
    });

    // Helper: Finds new courses on the page and tells the observer to watch them
    function observeNewCourses() {
        // Ignore links we are already observing, and links we have already processed
        const links = document.querySelectorAll('a[href*="/predmet/"]:not([data-is-mu-courses-pass-stats-processes-pnd="true"]):not([data-sr-observing="true"])');
        
        links.forEach(a => {
            a.dataset.srObserving = "true"; // Mark as being watched
            visibilityObserver.observe(a);  // The moment you scroll to it, it will trigger processLinkUI
        });
    }

    // ==========================================
    // INITIALIZATION & DOM CHANGE LISTENER
    // ==========================================
    console.log("Course Stats native visibility processor running...");
    
    // 1. Observe all links currently on the page
    observeNewCourses();

    // 2. Watch the DOM for any new courses loaded via AJAX/React
    const domObserver = new MutationObserver((mutations) => {
        const hasAddedNodes = mutations.some(m => m.addedNodes.length > 0);
        if (hasAddedNodes) {
            observeNewCourses();
        }
    });
    
    domObserver.observe(document.body, { childList: true, subtree: true });

})();
