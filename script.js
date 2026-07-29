(async function() {
    // 1. Inject CSS for the animated dots and badge styling
    const style = document.createElement('style');
    style.innerHTML = `
        .sr-badge {
            margin-left: 6px;
            font-size: 0.85em;
            font-weight: bold;
            white-space: nowrap;
        }
        .sr-loading { color: #888; }
        .sr-loading::after {
            content: '';
            animation: dots 1.5s steps(4, end) infinite;
        }
        @keyframes dots {
            0% { content: ''; }
            25% { content: '.'; }
            50% { content: '..'; }
            75% { content: '...'; }
        }
    `;
    document.head.appendChild(style);

    // Helper: Loads a URL in a hidden iframe
    function loadViaIframe(url) {
        return new Promise((resolve, reject) => {
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.width = '1px';
            iframe.style.height = '1px';
            iframe.style.opacity = '0';
            iframe.style.pointerEvents = 'none';
            
            iframe.addEventListener('load', () => {
                try {
                    const iDoc = iframe.contentDocument || iframe.contentWindow.document;
                    resolve({ iDoc, close: () => iframe.remove() });
                } catch (e) {
                    iframe.remove();
                    reject(e);
                }
            });
            iframe.addEventListener('error', () => {
                iframe.remove();
                reject(new Error(`Failed to load: ${url}`));
            });

            iframe.src = url;
            document.body.appendChild(iframe);
        });
    }

    // Helper: Determine color based on Success Rate (10 steps from Red to Green)
    function getColorForSuccessRate(sr) {
        if (typeof sr !== 'number' || isNaN(sr)) return 'gray';
        // Formula: <=50% is index 0. Each 5% adds 1. Max index 9 (95-100%).
        const index = Math.max(0, Math.min(9, Math.floor((sr - 46) / 5)));
        // HSL Hue: 0 is Red, 120 is Green. 9 steps -> 120/9 = ~13.33 per step.
        const hue = Math.round(index * 13.33); 
        return `hsl(${hue}, 80%, 42%)`;
    }

    // Core scraping logic for a single URL
    async function fetchCourseStats(url, uiSpans) {
        let iframeStep1, iframeStep2;
        try {
            // STEP 1: Load Course Page
            iframeStep1 = await loadViaIframe(url);
            const statsLink = Array.from(iframeStep1.iDoc.querySelectorAll('#app_content > ul > li a'))
                .find(a => a.innerText.trim().toLowerCase() === 'nejnovější' && a.href.includes('statistika_znamek'));
            
            if (!statsLink) throw new Error("No 'nejnovější' link");
            const statsUrl = statsLink.href;
            iframeStep1.close(); 

            // STEP 2: Load Stats Page
            iframeStep2 = await loadViaIframe(statsUrl);
            const table = iframeStep2.iDoc.querySelector('#app_content table.data1');
            if (!table) throw new Error("No table found");

            const rows = table.querySelectorAll('tr');
            const headers = Array.from(rows[0].querySelectorAll('th')).map(th => th.innerText.trim());
            const dataCells = Array.from(rows[1].querySelectorAll('td')).map(td => td.innerText.trim());

            const stats = {
                course: dataCells[0].replace(/\s+/g, ' ').trim(),
                totalStudents: 0,
                successRate: null,
                average: null,
                grades: {}
            };

            // Parse data dynamically and ensure everything is a NUMBER
            for (let i = 0; i < headers.length; i++) {
                const header = headers[i];
                const value = dataCells[i];

                if (header === 'Předmět') continue;
                if (header === 'Celkem studentů') {
                    stats.totalStudents = parseInt(value, 10) || 0;
                } else if (header === 'Úspěšně') {
                    // Extract number from "90 %" -> 90
                    stats.successRate = parseFloat(value.replace(/[^\d.-]/g, ''));
                } else if (header === 'Průměr') {
                    // Convert "2,07" -> 2.07
                    stats.average = parseFloat(value.replace(',', '.'));
                } else {
                    stats.grades[header] = { count: parseInt(value, 10) || 0 };
                }
            }

            // Calculate numeric percentages for grades
            if (stats.totalStudents > 0) {
                for (const grade in stats.grades) {
                    const count = stats.grades[grade].count;
                    // Store as a float, e.g., 24.32 instead of "24.32%"
                    stats.grades[grade].percentage = parseFloat(((count / stats.totalStudents) * 100).toFixed(2));
                }
            }

            // Update UI with Success
            const color = getColorForSuccessRate(stats.successRate);
            uiSpans.forEach(span => {
                span.className = 'sr-badge'; // removes loading class & dots
                span.innerText = `SR: ${stats.successRate}%`;
                span.style.color = color;
            });

            return stats;

        } catch (error) {
            // Update UI with Fallback
            uiSpans.forEach(span => {
                span.className = 'sr-badge'; // removes loading class & dots
                span.innerText = `SR: ?`;
                span.style.color = 'gray';
            });
            return null; // Return null for failed scrapes to keep the console clean
        } finally {
            if (iframeStep1) iframeStep1.close();
            if (iframeStep2) iframeStep2.close();
        }
    }

    async function main() {
        console.log("Initializing parallel course stats extraction...");
        const anchorTags = document.querySelectorAll('a[href*="/predmet/"]');
        
        // Group DOM elements by unique URL so we don't scrape the same page twice
        const urlMap = new Map();
        
        anchorTags.forEach(a => {
            // Create and attach the loading UI right next to the link
            const span = document.createElement('span');
            span.className = 'sr-badge sr-loading';
            span.innerText = 'SR: ';
            a.insertAdjacentElement('afterend', span);

            if (!urlMap.has(a.href)) {
                urlMap.set(a.href, []);
            }
            urlMap.get(a.href).push(span);
        });

        // Async Mode: Trigger all fetch operations concurrently using Promise.all
        const promises = Array.from(urlMap.entries()).map(([url, spans]) => 
            fetchCourseStats(url, spans)
        );

        // Wait for all iframes and scrapes to finish in parallel
        const results = await Promise.all(promises);
        
        // Print the valid results to the console
        results.filter(r => r !== null).forEach(stat => {
            console.log(`✅ Stats for ${stat.course}:`, stat);
        });

        console.log("🎉 All courses processed successfully.");
    }

    await main();
})();
