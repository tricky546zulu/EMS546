// server.js

// Import required modules
const express = require('express');
const axios = require('axios');
const pdf = require('pdf-parse');
const path = require('path');

// Initialize the Express app
const app = express();
const PORT = process.env.PORT || 3000;

// URL for the Saskatoon Hospital Bed Capacity PDF report
const BED_CAPACITY_PDF_URL = 'https://www.ehealthsask.ca/reporting/Documents/SaskatoonHospitalBedCapacity.pdf';

/**
 * Fetches and parses the bed capacity PDF to extract data for specific hospitals.
 * @returns {Promise<Object>} A promise that resolves to an object containing hospital data and the last updated timestamp.
 */
const scrapeBedCapacity = async () => {
    try {
        console.log(`Fetching bed capacity PDF from: ${BED_CAPACITY_PDF_URL}`);
        // Fetch the PDF file as a buffer
        const response = await axios.get(BED_CAPACITY_PDF_URL, {
            responseType: 'arraybuffer'
        });

        // Parse the PDF buffer to extract text
        const data = await pdf(response.data);
        const text = data.text;
        
        // The specific hospitals we want to get data for
        const hospitalsToFind = [
            'Royal University Hospital',
            'St. Paul\'s Hospital',
            'Saskatoon City Hospital',
            'Jim Pattison Children\'s Hospital'
        ];

        const results = [];
        
        // Split the text by hospital names to create blocks of text for each one.
        const textBlocks = text.split(/(?=Royal University Hospital|St\. Paul's Hospital|Saskatoon City Hospital|Jim Pattison Children's Hospital)/g);

        hospitalsToFind.forEach(hospitalName => {
            // Find the block of text corresponding to the current hospital
            const block = textBlocks.find(b => b.trim().startsWith(hospitalName));
            
            const hospitalData = {
                name: hospitalName,
                inpatient: { occupancy: 'N/A', beds: 'N/A' },
                emergency: { patientsInED: 'N/A', patientsWaiting: 'N/A' },
                admittedWaiting: { count: 'N/A' }
            };

            if (block) {
                // Regex to find Inpatient Bed data (e.g., "Inpatient Beds 96% 450")
                const inpatientMatch = block.match(/Inpatient Beds\s*(\d+)%\s*(\d+)/);
                if (inpatientMatch) {
                    hospitalData.inpatient.occupancy = inpatientMatch[1];
                    hospitalData.inpatient.beds = inpatientMatch[2];
                }

                // Regex to find Emergency Department data (e.g., "Emergency Department (ED) 55 12")
                const emergencyMatch = block.match(/Emergency Department \(ED\)\s*(\d+)\s*(\d+)/);
                if (emergencyMatch) {
                    hospitalData.emergency.patientsInED = emergencyMatch[1];
                    hospitalData.emergency.patientsWaiting = emergencyMatch[2];
                }

                // Regex to find Admitted Patients Waiting data (e.g., "Admitted Patients Waiting for an Inpatient Bed 23")
                const admittedMatch = block.match(/Admitted Patients Waiting for an Inpatient Bed\s*(\d+)/);
                if (admittedMatch) {
                    hospitalData.admittedWaiting.count = admittedMatch[1];
                }
            }
            results.push(hospitalData);
        });
        
        let lastUpdated = 'N/A';
        // Try to find the "Data as of:" timestamp anywhere in the document
        const lastUpdatedMatch = text.match(/Data as of:\s*(.*)/);
        if (lastUpdatedMatch) {
            lastUpdated = lastUpdatedMatch[1].trim();
        }

        console.log('Successfully scraped and parsed bed capacity data.');
        return { lastUpdated, hospitals: results };

    } catch (error) {
        console.error('Error in scrapeBedCapacity function:', error.message);
        return { error: 'Failed to retrieve bed capacity. The source PDF may have changed or is unavailable.' };
    }
};

// --- Middleware ---
// Serve static files (like index.html, app.js, styles.css) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- API Route ---
// Define an API endpoint that the frontend can call to get the data
app.get('/api/bed-capacity', async (req, res) => {
    const data = await scrapeBedCapacity();
    res.json(data);
});

// --- Server Startup ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

