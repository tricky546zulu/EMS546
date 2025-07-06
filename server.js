// server.js

// Import required modules using straight quotes
const express = require('express');
const axios = require('axios');
const pdf = require('pdf-parse');
const path = require('path');

// Initialize the Express app
const app = express();
const PORT = process.env.PORT || 3000;

// The direct URL to the eHealth Saskatchewan PDF
const pdfUrl = 'https://www.saskhealthauthority.ca/sites/default/files/2024-07/ER-Wait-Times.pdf';

// --- Middleware ---
// Serve static files (like index.html, app.js, styles.css) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- Data Scraping Function ---
/**
 * Fetches and parses the PDF to extract wait times for specific hospitals.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of hospital data.
 */
const scrapeWaitTimes = async () => {
    try {
        // Fetch the PDF file as a buffer
        const response = await axios.get(pdfUrl, {
            responseType: 'arraybuffer'
        });

        // Parse the PDF buffer to extract text
        const data = await pdf(response.data);
        const text = data.text;

        // The specific hospitals we want to get data for
        const hospitals = [
            'Royal University Hospital',
            'St. Paul\'s Hospital', // Note: Using a backslash to escape the single quote
            'Jim Pattison Children\'s Hospital',
            'Saskatoon City Hospital'
        ];

        const results = [];
        const lines = text.split('\n');

        // Loop through each hospital name to find its data in the text
        hospitals.forEach(hospitalName => {
            const hospitalData = {
                name: hospitalName,
                waitTime: 'N/A',
                peopleWaiting: 'N/A',
                lastUpdated: 'N/A'
            };

            // Find the line index where the hospital name appears
            const hospitalIndex = lines.findIndex(line => line.includes(hospitalName));

            if (hospitalIndex !== -1) {
                // Search in the lines following the hospital name for wait time details
                for (let i = hospitalIndex + 1; i < lines.length; i++) {
                    const line = lines[i];

                    // Regex to find the wait time format (e.g., "1 hr, 30 min (5)")
                    const waitTimeMatch = line.match(/(\d+)\s+hr,\s+(\d+)\s+min\s+\((\d+)\)/);
                    if (waitTimeMatch) {
                        hospitalData.waitTime = `${waitTimeMatch[1]} hr, ${waitTimeMatch[2]} min`;
                        hospitalData.peopleWaiting = waitTimeMatch[3];
                        break; // Stop searching once wait time is found for this hospital
                    }

                    // Stop if we hit another hospital name before finding the data
                    if (hospitals.some(h => line.includes(h))) {
                        break;
                    }
                }
            }
            results.push(hospitalData);
        });
        
        // Try to find the "Last updated" timestamp in the document
        const lastUpdatedMatch = text.match(/Last updated:\s*(.*)/);
        if (lastUpdatedMatch) {
            const lastUpdated = lastUpdatedMatch[1].trim();
            // Add the timestamp to each hospital's data
            results.forEach(r => r.lastUpdated = lastUpdated);
        }


        return results;

    } catch (error) {
        console.error('Error scraping PDF:', error);
        // In case of an error, return an empty array or an error object
        return { error: 'Failed to retrieve wait times.' };
    }
};


// --- API Route ---
// Define an API endpoint that the frontend can call to get the data
app.get('/api/wait-times', async (req, res) => {
    const data = await scrapeWaitTimes();
    res.json(data);
});


// --- Server Startup ---
// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

