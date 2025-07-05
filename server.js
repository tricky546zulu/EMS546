// server.js - Simple Express server for parsing Saskatchewan Health PDF
const express = require('express');
const axios = require('axios');
const pdf = require('pdf-parse');
const cors = require('cors');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // For serving the HTML file

// In-memory storage for the parsed data
let cachedData = null;
let lastUpdateTime = null;

// Saskatchewan Health PDF URL
const PDF_URL = 'https://www.ehealthsask.ca/reporting/Documents/SaskatoonHospitalBedCapacity.pdf';

// Function to parse the PDF and extract key data
async function parsePDF() {
    try {
        console.log('Fetching PDF from:', PDF_URL);
        
        // Download the PDF
        const response = await axios.get(PDF_URL, {
            responseType: 'arraybuffer',
            timeout: 30000, // 30 second timeout
        });

        // Parse the PDF
        const pdfData = await pdf(response.data);
        const text = pdfData.text;
        
        console.log('PDF parsed successfully');
        
        // Extract the key data using regex patterns
        const data = extractHospitalData(text);
        
        // Cache the data
        cachedData = data;
        lastUpdateTime = new Date();
        
        console.log('Data extracted and cached:', data);
        return data;
        
    } catch (error) {
        console.error('Error parsing PDF:', error.message);
        throw error;
    }
}

// Function to extract hospital data from PDF text
function extractHospitalData(text) {
    try {
        // Initialize data structure
        const data = {
            lastUpdated: new Date().toLocaleString(),
            hospitals: {
                RUH: {
                    name: "Royal University Hospital",
                    admittedPtsInED: 0,
                    activeConsults: 0,
                    edBreakdown: {},
                    totalBeds: 0,
                    occupiedBeds: 0,
                    overcapacityBeds: 0
                },
                SPH: {
                    name: "St. Paul's Hospital",
                    admittedPtsInED: 0,
                    activeConsults: 0,
                    edBreakdown: {},
                    totalBeds: 0,
                    occupiedBeds: 0,
                    overcapacityBeds: 0
                },
                SCH: {
                    name: "Saskatoon City Hospital",
                    admittedPtsInED: 0,
                    activeConsults: 0,
                    totalBeds: 0,
                    occupiedBeds: 0,
                    overcapacityBeds: 0
                },
                JPCH: {
                    name: "Jim Pattison Children's Hospital",
                    admittedPtsInED: 0,
                    activeConsults: 0,
                    totalBeds: 0,
                    occupiedBeds: 0,
                    overcapacityBeds: 0
                }
            },
            total: {
                admittedPtsInED: 0,
                activeConsults: 0,
                totalPatients: 0
            }
        };

        // Extract timestamp from PDF
        const timestampMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)/);
        if (timestampMatch) {
            data.lastUpdated = timestampMatch[1];
        }

        // Extract the main summary table data
        // Look for the pattern: Site | Admitted Pts in ED | Active Consults | Total
        const summaryPattern = /Site\s+Admitted\s+Pts\s+in\s+ED\s+Active\s+Consults\s+Total\s+([\s\S]*?)(?=Site\s+Service\s+Department|Emergency\s+Department|$)/i;
        const summaryMatch = text.match(summaryPattern);
        
        if (summaryMatch) {
            const summaryText = summaryMatch[1];
            
            // Extract individual hospital data
            const ruhMatch = summaryText.match(/RUH\s+(\d+)\s+(\d+)\s+(\d+)/);
            const sphMatch = summaryText.match(/SPH\s+(\d+)\s+(\d+)\s+(\d+)/);
            const schMatch = summaryText.match(/SCH\s+(\d+)\s+(\d+)\s+(\d+)/);
            const jpchMatch = summaryText.match(/JPCH\s+(\d+)\s+(\d+)\s+(\d+)/);
            const totalMatch = summaryText.match(/Total\s+(\d+)\s+(\d+)\s+(\d+)/);

            if (ruhMatch) {
                data.hospitals.RUH.admittedPtsInED = parseInt(ruhMatch[1]);
                data.hospitals.RUH.activeConsults = parseInt(ruhMatch[2]);
            }

            if (sphMatch) {
                data.hospitals.SPH.admittedPtsInED = parseInt(sphMatch[1]);
                data.hospitals.SPH.activeConsults = parseInt(sphMatch[2]);
            }

            if (schMatch) {
                data.hospitals.SCH.admittedPtsInED = parseInt(schMatch[1]);
                data.hospitals.SCH.activeConsults = parseInt(schMatch[2]);
            }

            if (jpchMatch) {
                data.hospitals.JPCH.admittedPtsInED = parseInt(jpchMatch[1]);
                data.hospitals.JPCH.activeConsults = parseInt(jpchMatch[2]);
            }

            if (totalMatch) {
                data.total.admittedPtsInED = parseInt(totalMatch[1]);
                data.total.activeConsults = parseInt(totalMatch[2]);
                data.total.totalPatients = parseInt(totalMatch[3]);
            }
        }

        // Extract bed capacity data for each hospital
        // Royal University Hospital totals
        const ruhTotalMatch = text.match(/Royal\s+University\s+Hospital[\s\S]*?Total\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);
        if (ruhTotalMatch) {
            data.hospitals.RUH.occupiedBeds = parseInt(ruhTotalMatch[1]);
            data.hospitals.RUH.totalBeds = parseInt(ruhTotalMatch[2]);
            data.hospitals.RUH.overcapacityBeds = parseInt(ruhTotalMatch[3]);
        }

        // St. Paul's Hospital totals
        const sphTotalMatch = text.match(/St\s+Paul's\s+Hospital[\s\S]*?Total\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);
        if (sphTotalMatch) {
            data.hospitals.SPH.occupiedBeds = parseInt(sphTotalMatch[1]);
            data.hospitals.SPH.totalBeds = parseInt(sphTotalMatch[2]);
            data.hospitals.SPH.overcapacityBeds = parseInt(sphTotalMatch[3]);
        }

        // Saskatoon City Hospital totals
        const schTotalMatch = text.match(/Saskatoon\s+City\s+Hospital[\s\S]*?Total\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);
        if (schTotalMatch) {
            data.hospitals.SCH.occupiedBeds = parseInt(schTotalMatch[1]);
            data.hospitals.SCH.totalBeds = parseInt(schTotalMatch[2]);
            data.hospitals.SCH.overcapacityBeds = parseInt(schTotalMatch[3]);
        }

        // Jim Pattison Children's Hospital totals
        const jpchTotalMatch = text.match(/Jim\s+Pattison's?\s+Children\s+Hospital[\s\S]*?Total\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);
        if (jpchTotalMatch) {
            data.hospitals.JPCH.occupiedBeds = parseInt(jpchTotalMatch[1]);
            data.hospitals.JPCH.totalBeds = parseInt(jpchTotalMatch[2]);
            data.hospitals.JPCH.overcapacityBeds = parseInt(jpchTotalMatch[3]);
        }

        // Extract Emergency Department breakdown
        const edBreakdownPattern = /Site\s+Service\s+Department\s+Total\s+([\s\S]*?)(?=Please\s+be\s+advised|$)/i;
        const edBreakdownMatch = text.match(edBreakdownPattern);
        
        if (edBreakdownMatch) {
            const edText = edBreakdownMatch[1];
            
            // Extract RUH departments
            const ruhDepts = edText.match(/RUH\s+([\s\S]*?)(?=SPH|$)/i);
            if (ruhDepts) {
                const deptText = ruhDepts[1];
                const deptMatches = deptText.match(/(\w+\s+ED)\s+(\d+)/g);
                if (deptMatches) {
                    deptMatches.forEach(match => {
                        const [, dept, count] = match.match(/(\w+\s+ED)\s+(\d+)/);
                        data.hospitals.RUH.edBreakdown[dept] = parseInt(count);
                    });
                }
            }
            
            // Extract SPH departments
            const sphDepts = edText.match(/SPH\s+([\s\S]*?)$/i);
            if (sphDepts) {
                const deptText = sphDepts[1];
                const deptMatches = deptText.match(/(\w+\s+ED)\s+(\d+)/g);
                if (deptMatches) {
                    deptMatches.forEach(match => {
                        const [, dept, count] = match.match(/(\w+\s+ED)\s+(\d+)/);
                        data.hospitals.SPH.edBreakdown[dept] = parseInt(count);
                    });
                }
            }
        }

        return data;
        
    } catch (error) {
        console.error('Error extracting hospital data:', error);
        throw error;
    }
}

// API Routes
app.get('/api/hospital-data', async (req, res) => {
    try {
        // If we have cached data less than 15 minutes old, return it
        if (cachedData && lastUpdateTime && (Date.now() - lastUpdateTime.getTime()) < 15 * 60 * 1000) {
            return res.json({
                success: true,
                data: cachedData,
                cached: true,
                cacheAge: Math.floor((Date.now() - lastUpdateTime.getTime()) / 1000)
            });
        }

        // Otherwise, fetch fresh data
        const data = await parsePDF();
        
        res.json({
            success: true,
            data: data,
            cached: false
        });
        
    } catch (error) {
        console.error('API Error:', error);
        
        // If we have cached data, return it even if it's old
        if (cachedData) {
            return res.json({
                success: true,
                data: cachedData,
                cached: true,
                warning: 'Using cached data due to fetch error',
                error: error.message
            });
        }
        
        // Otherwise return error
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        lastUpdate: lastUpdateTime ? lastUpdateTime.toISOString() : null,
        hasData: !!cachedData
    });
});

// Root endpoint - serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Schedule PDF parsing every 15 minutes
cron.schedule('*/15 * * * *', async () => {
    console.log('Scheduled PDF parsing started...');
    try {
        await parsePDF();
        console.log('Scheduled PDF parsing completed successfully');
    } catch (error) {
        console.error('Scheduled PDF parsing failed:', error);
    }
});

// Initial data load
(async () => {
    try {
        console.log('Loading initial data...');
        await parsePDF();
        console.log('Initial data loaded successfully');
    } catch (error) {
        console.error('Failed to load initial data:', error);
    }
})();

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`API endpoint: http://localhost:${PORT}/api/hospital-data`);
});

module.exports = app;
