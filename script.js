(async function() {
    // ==========================================
    // CONFIGURATION: Define Pass / No Pass grades
    // ==========================================
    const GRADE_CATEGORIES = {
        'A': 'pass', 'B': 'pass', 'C': 'pass', 'D': 'pass', 'E': 'pass', 'Z': 'pass', 'P': 'pass',
        'F': 'fail', '-': 'fail', 'N': 'fail', 'X': 'fail',
    };

    const COLORS = {
        pass: '#4caf50',   // Green
        fail: '#f44336',   // Red
        unknown: '#9e9e9e' // Gray
    };

    // ==========================================
    // INJECT CSS (Animations, Badges, Tooltip, Popup, Button)
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

        #sr-load-btn-pnd {
            position: fixed; bottom: 20px; right: 20px; z-index: 999998;
            background: #0056b3; color: white; border: none; padding: 12px 16px;
            border-radius: 20px; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold;
            box-shadow: 0 4px 6px rgba(0,0,0,0.2); cursor: pointer; transition: background 0.2s, transform 0.1s;
        }
        #sr-load-btn-pnd:hover { background: #004494; }
        #sr-load-btn-pnd:active { transform: scale(0.95); }
    `;
    document.head.appendChild(style);

    // Create the Popup container
    const popup = document.createElement('div');
    popup.id = 'sr-popup-pnd';
    document.body.appendChild(popup);

    // Close popup if clicking anywhere outside of it
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

    // Checks if an element is currently visible in the browser viewport
    function isElementInViewport(el) {
        const rect = el.getBoundingClientRect();
        return (
            rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
            rect.bottom > 0 &&
            rect.left < (window.innerWidth || document.documentElement.clientWidth) &&
            rect.right > 0
        );
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
    // CORE LOGIC
    // ==========================================
    async function fetchCourseStats(url, uiSpans) {
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

            const color = getColorForSuccessRate(stats.successRate);
            uiSpans.forEach(span => {
                span.className = 'sr-badge'; 
                span.innerText = `SR: ${stats.successRate}%`;
                span.style.color = color;
                span.title = `Success rate: ${stats.successRate}% (${stats.semester}). Click to view details.`;
                
                span.addEventListener('click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    showPopup(e, stats);
                });
            });

        } catch (error) {
            uiSpans.forEach(span => {
                span.className = 'sr-badge'; span.innerText = `SR: ?`; span.style.color = 'gray';
                span.title = 'No statistics available.';
            });
        } finally {
            if (iframe1) iframe1.close();
            if (iframe2) iframe2.close();
        }
    }

    // Finds links ON SCREEN, marks them, adds loading UI, and fetches stats
    function processVisibleUnmarkedLinks() {
        const anchorTags = document.querySelectorAll('a[href*="/predmet/"]:not([data-sr-processed-pnd="true"])');
        if (anchorTags.length === 0) return 0;

        const urlMap = new Map();
        let processedCount = 0;
        
        anchorTags.forEach(a => {
            // Only process if the link is currently visible on the screen
            if (isElementInViewport(a)) {
                a.dataset.srProcessedPnd = "true";
                
                const span = document.createElement('span');
                span.className = 'sr-badge sr-loading';
                span.innerText = 'SR: ';
                a.insertAdjacentElement('afterend', span);

                if (!urlMap.has(a.href)) urlMap.set(a.href, []);
                urlMap.get(a.href).push(span);
                processedCount++;
            }
        });

        // Trigger fetches in parallel
        Array.from(urlMap.entries()).forEach(([url, spans]) => {
            fetchCourseStats(url, spans).catch(err => {}); 
        });

        return processedCount; // Return amount of newly marked elements
    }

    // ==========================================
    // INITIALIZATION & UI BUTTON
    // ==========================================
    console.log("Course Stats processor ready. Waiting for manual trigger.");
    
    // Create floating manual load button
    const loadBtn = document.createElement('button');
    loadBtn.id = 'sr-load-btn-pnd';
    loadBtn.innerText = 'Load Stats for Visible Courses';
    document.body.appendChild(loadBtn);

    loadBtn.addEventListener('click', () => {
        const count = processVisibleUnmarkedLinks();
        
        // Temporarily change button text to show feedback
        const originalText = 'Load Stats for Visible Courses';
        if (count > 0) {
            loadBtn.innerText = `Loading stats for ${count} courses...`;
            loadBtn.style.background = '#4caf50'; // Green while loading
        } else {
            loadBtn.innerText = 'No new courses visible!';
            loadBtn.style.background = '#f44336'; // Red if nothing to do
        }
        
        setTimeout(() => {
            loadBtn.innerText = originalText;
            loadBtn.style.background = '#0056b3'; // Revert to blue
        }, 2000);
    });

})();
