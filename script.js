{
    /**
     * Retrieves course statistics dynamically.
     * You can pass a full URL as the first argument, OR pass fakulta, obdobi, and kod.
     * 
     * @param {string} urlOrFakulta - The full URL OR the "fakulta" code (e.g., "1433")
     * @param {string} [obdobi] - The "obdobi" code (e.g., "9783")
     * @param {string} [kod] - The course code (e.g., "PB029")
     * @returns {Promise<Object>} Dictionary containing stats
     */
    async function getCourseStats(urlOrFakulta, obdobi, kod) {
        return new Promise((resolve, reject) => {
            // Determine the URL based on the provided arguments
            let url = urlOrFakulta;
            if (obdobi && kod) {
                url = `https://is.muni.cz/auth/predmety/statistika_znamek?fakulta=${urlOrFakulta};obdobi=${obdobi};kod=${kod}`;
            }

            // Create invisible iframe
            const iframe = document.createElement('iframe');
            iframe.style.position = 'absolute';
            iframe.style.width = '0px';
            iframe.style.height = '0px';
            iframe.style.border = 'none';
            iframe.style.visibility = 'hidden';
            
            iframe.addEventListener('load', () => {
                try {
                    const iDoc = iframe.contentDocument || iframe.contentWindow.document;
                    const table = iDoc.querySelector('#app_content table.data1');
                    
                    if (!table) {
                        throw new Error('Stats table not found in the loaded page.');
                    }

                    const rows = table.querySelectorAll('tr');
                    if (rows.length < 2) {
                        throw new Error('Unexpected table structure: missing data rows.');
                    }

                    // Extract headers and data cells
                    const headers = Array.from(rows[0].querySelectorAll('th')).map(th => th.innerText.trim());
                    const dataCells = Array.from(rows[1].querySelectorAll('td')).map(td => td.innerText.trim());

                    const stats = {
                        course: '',
                        totalStudents: 0,
                        successRate: '',
                        average: null,
                        grades: {} // Will hold { "A": { count: 18, percentage: "24.32%" }, ... }
                    };

                    // Map the table columns dynamically
                    for (let i = 0; i < headers.length; i++) {
                        const header = headers[i];
                        const value = dataCells[i];

                        if (header === 'Předmět') {
                            // Extract course name (removes excess newlines if present)
                            stats.course = value.replace(/\s+/g, ' ').trim();
                        } else if (header === 'Celkem studentů') {
                            stats.totalStudents = parseInt(value, 10) || 0;
                        } else if (header === 'Úspěšně') {
                            stats.successRate = value;
                        } else if (header === 'Průměr') {
                            stats.average = value;
                        } else {
                            // Anything else is treated as a grade (Z, A, B, C, D, E, F, -)
                            stats.grades[header] = {
                                count: parseInt(value, 10) || 0
                            };
                        }
                    }

                    // Calculate percentages for each grade
                    if (stats.totalStudents > 0) {
                        for (const grade in stats.grades) {
                            const count = stats.grades[grade].count;
                            const percentage = ((count / stats.totalStudents) * 100).toFixed(2);
                            stats.grades[grade].percentage = `${percentage}%`;
                        }
                    }

                    // Cleanup and resolve
                    document.body.removeChild(iframe);
                    resolve(stats);

                } catch (error) {
                    document.body.removeChild(iframe);
                    reject(error);
                }
            });

            iframe.addEventListener('error', () => {
                document.body.removeChild(iframe);
                reject(new Error('Failed to load the iframe.'));
            });

            // Trigger the load
            iframe.src = url;
            document.body.appendChild(iframe);
        });
    }

    await getCourseStats('https://is.muni.cz/auth/predmety/statistika_znamek?fakulta=1433;obdobi=9783;kod=PB029');
}
