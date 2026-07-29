(async function() {
    /**
     * Helper function: Loads a URL in a hidden iframe and returns its document.
     * Includes a close() method to remove the iframe from the DOM when done.
     */
    function loadViaIframe(url) {
        return new Promise((resolve, reject) => {
            const iframe = document.createElement('iframe');
            
            // Hide the iframe but DO NOT use display:none (otherwise innerText won't work)
            iframe.style.position = 'fixed';
            iframe.style.width = '1px';
            iframe.style.height = '1px';
            iframe.style.opacity = '0';
            iframe.style.pointerEvents = 'none';
            
            iframe.addEventListener('load', () => {
                try {
                    const iDoc = iframe.contentDocument || iframe.contentWindow.document;
                    resolve({ 
                        iDoc, 
                        close: () => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); } 
                    });
                } catch (e) {
                    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
                    reject(e);
                }
            });

            iframe.addEventListener('error', () => {
                if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
                reject(new Error(`Failed to load URL: ${url}`));
            });

            iframe.src = url;
            document.body.appendChild(iframe);
        });
    }

    /**
     * Helper function: Processes a single course link.
     */
    async function processCourseLink(courseLink) {
        const courseName = courseLink.innerText.trim();
        const courseUrl = courseLink.href;
        
        let iframeStep1;
        let iframeStep2;

        try {
            // STEP 1: Load the course page
            iframeStep1 = await loadViaIframe(courseUrl);
            const courseDoc = iframeStep1.iDoc;

            // Find the "nejnovější" link in the specific list
            const links = Array.from(courseDoc.querySelectorAll('#app_content > ul > li a'));
            const statsLink = links.find(a => 
                a.innerText.trim().toLowerCase() === 'nejnovější' && 
                a.href.includes('statistika_znamek')
            );

            if (!statsLink) {
                console.warn(`[SKIP] No 'nejnovější' stats link found for: ${courseName || courseUrl}`);
                iframeStep1.close();
                return;
            }

            const statsUrl = statsLink.href;
            iframeStep1.close(); // Clean up first iframe immediately

            // STEP 2: Load the stats page
            iframeStep2 = await loadViaIframe(statsUrl);
            const statsDoc = iframeStep2.iDoc;

            // Extract the table
            const table = statsDoc.querySelector('#app_content table.data1');
            if (!table) {
                console.warn(`[SKIP] Table not found on stats page for: ${courseName || courseUrl}`);
                iframeStep2.close();
                return;
            }

            const rows = table.querySelectorAll('tr');
            if (rows.length < 2) {
                iframeStep2.close();
                return;
            }

            const headers = Array.from(rows[0].querySelectorAll('th')).map(th => th.innerText.trim());
            const dataCells = Array.from(rows[1].querySelectorAll('td')).map(td => td.innerText.trim());

            // Build dictionary
            const stats = {
                course: courseName || dataCells[0].replace(/\s+/g, ' ').trim(),
                totalStudents: 0,
                successRate: '',
                average: null,
                grades: {}
            };

            for (let i = 0; i < headers.length; i++) {
                const header = headers[i];
                const value = dataCells[i];

                if (header === 'Předmět') continue; // Skip, we already have the name
                
                if (header === 'Celkem studentů') {
                    stats.totalStudents = parseInt(value, 10) || 0;
                } else if (header === 'Úspěšně') {
                    stats.successRate = value;
                } else if (header === 'Průměr') {
                    stats.average = value;
                } else {
                    stats.grades[header] = { count: parseInt(value, 10) || 0 };
                }
            }

            // Calculate percentages
            if (stats.totalStudents > 0) {
                for (const grade in stats.grades) {
                    const count = stats.grades[grade].count;
                    const percentage = ((count / stats.totalStudents) * 100).toFixed(2);
                    stats.grades[grade].percentage = `${percentage}%`;
                }
            }

            console.log(`✅ Stats for ${stats.course}:`, stats);

        } catch (error) {
            console.error(`[ERROR] Processing failed for ${courseName || courseUrl}:`, error);
        } finally {
            // Ensure iframes are deleted even if an error occurs
            if (iframeStep1) iframeStep1.close();
            if (iframeStep2) iframeStep2.close();
        }
    }

    /**
     * Main function: Scans the page and iterates through the links.
     */
    async function main() {
        console.log("Starting course stats extraction...");
        
        // Find all links containing '/predmet/'
        const anchorTags = document.querySelectorAll('a[href*="/predmet/"]');
        
        // Deduplicate URLs so we don't process the same course twice
        const uniqueLinks = new Map();
        for (const a of anchorTags) {
            if (!uniqueLinks.has(a.href)) {
                uniqueLinks.set(a.href, a);
            }
        }

        console.log(`Found ${uniqueLinks.size} unique course links. Processing sequentially...`);

        for (const [url, linkElement] of uniqueLinks) {
            await processCourseLink(linkElement);
            
            // Optional: wait 300ms between requests to avoid overloading the server/browser
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        console.log("🎉 All courses processed successfully.");
    }

    // Execute the main function
    await main();

})();
