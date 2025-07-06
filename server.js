// server.js - Final fix with working PDF pattern matching
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
app.use(express.static('public'));

// In-memory storage for the parsed data
let cachedData = null;
let lastUpdateTime = null;

// Saskatchewan Health PDF URL
const PDF_URL = 'https://www.ehealthsask.ca/reporting/Documents/SaskatoonHospitalBedCapacity.pdf';

// Function to parse the PDF and extract key data
async function parsePDF() {
    try {
        console.log('EMS546 - Fetching PDF from:', PDF_URL);
        
        const response = await axios.get(PDF_URL, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; EMS546-HospitalTracker/1.0)'
            }
        });

        const pdfData = await pdf(response.data);
        const text = pdfData.text;
        
        console.log('EMS546 - PDF parsed successfully, text length:', text.length);
        
        const data = extractHospitalData(text);
        
        cachedData = data;
        lastUpdateTime = new Date();
        
        console.log('EMS546 - Data extracted and cached successfully');
        console.log('EMS546 - Summary:', {
            totalAdmitted: data.total.admittedPtsInED,
            totalActive: data.total.active,
            totalConsults: data.total.consults,
            totalPatients: data.total.totalPatients
        });
        
        return data;
        
    } catch (error) {
        console.error('EMS546 - Error parsing PDF:', error.message);
        throw error;
    }
}

// Fixed function with working regex pattern
function extractHospitalData(text) {
    try {
        const data = {
            lastUpdated: new Date().toLocaleString(),
            hospitals: {
                JPCH: {
                    name: "Jim Pattison Children's Hospital",
                    admittedPtsInED: 0,
                    active: 0,
                    consults: 0,
                    activeConsults: 0,
                    edBreakdown: {},
                    totalBeds: 0,
                    occupiedBeds: 0,
                    overcapacityBeds: 0
                },
                RUH: {
                    name: "Royal University Hospital",
                    admittedPtsInED: 0,
                    active: 0,
                    consults: 0,
                    activeConsults: 0,
                    edBreakdown: {},
                    totalBeds: 0,
                    occupiedBeds: 0,
                    overcapacityBeds: 0
                },
                SPH: {
                    name: "St. Paul's Hospital",
                    admittedPtsInED: 0,
                    active: 0,
                    consults: 0,
                    activeConsults: 0,
                    edBreakdown: {},
                    totalBeds: 0,
                    occupiedBeds: 0,
                    overcapacityBeds: 0
                },
                SCH: {
                    name: "Saskatoon City Hospital",
                    admittedPtsInED: 0,
                    active: 0,
                    consults: 0,
                    activeConsults: 0,
                    totalBeds: 0,
                    occupiedBeds: 0,
                    overcapacityBeds: 0
                }
            },
            total: {
                admittedPtsInED: 0,
                active: 0,
                consults: 0,
                activeConsults: 0,
                totalPatients: 0
            }
        };

        // Extract timestamp
        const timestampMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)/);
        if (timestampMatch) {
            data.lastUpdated = timestampMatch[1];
            console.log('EMS546 - Timestamp found:', timestampMatch[1]);
        }

        // Use the working pattern that captures all hospital data in one go
        console.log('EMS546 - Looking for hospital data pattern...');
        
        // Pattern that matches the entire hospital table data
        const hospitalDataPattern = /JPCH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)[\s\S]*?RUH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)[\s\S]*?SPH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)[\s\S]*?SCH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)[\s\S]*?Total\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i;
        
        const hospitalMatch = text.match(hospitalDataPattern);
        
        if (hospitalMatch) {
            console.log('EMS546 - Hospital data pattern found successfully!');
            
            // Extract JPCH data (groups 1-4)
            data.hospitals.JPCH.admittedPtsInED = parseInt(hospitalMatch[1]);
            data.hospitals.JPCH.active = parseInt(hospitalMatch[2]);
            data.hospitals.JPCH.consults = parseInt(hospitalMatch[3]);
            data.hospitals.JPCH.activeConsults = data.hospitals.JPCH.active;
            console.log('EMS546 - JPCH:', hospitalMatch[1], hospitalMatch[2], hospitalMatch[3], hospitalMatch[4]);
            
            // Extract RUH data (groups 5-8)
            data.hospitals.RUH.admittedPtsInED = parseInt(hospitalMatch[5]);
            data.hospitals.RUH.active = parseInt(hospitalMatch[6]);
            data.hospitals.RUH.consults = parseInt(hospitalMatch[7]);
            data.hospitals.RUH.activeConsults = data.hospitals.RUH.active;
            console.log('EMS546 - RUH:', hospitalMatch[5], hospitalMatch[6], hospitalMatch[7], hospitalMatch[8]);
            
            // Extract SPH data (groups 9-12)
            data.hospitals.SPH.admittedPtsInED = parseInt(hospitalMatch[9]);
            data.hospitals.SPH.active = parseInt(hospitalMatch[10]);
            data.hospitals.SPH.consults = parseInt(hospitalMatch[11]);
            data.hospitals.SPH.activeConsults = data.hospitals.SPH.active;
            console.log('EMS546 - SPH:', hospitalMatch[9], hospitalMatch[10], hospitalMatch[11], hospitalMatch[12]);
            
            // Extract SCH data (groups 13-16)
            data.hospitals.SCH.admittedPtsInED = parseInt(hospitalMatch[13]);
            data.hospitals.SCH.active = parseInt(hospitalMatch[14]);
            data.hospitals.SCH.consults = parseInt(hospitalMatch[15]);
            data.hospitals.SCH.activeConsults = data.hospitals.SCH.active;
            console.log('EMS546 - SCH:', hospitalMatch[13], hospitalMatch[14], hospitalMatch[15], hospitalMatch[16]);
            
            // Extract totals (groups 17-20)
            data.total.admittedPtsInED = parseInt(hospitalMatch[17]);
            data.total.active = parseInt(hospitalMatch[18]);
            data.total.consults = parseInt(hospitalMatch[19]);
            data.total.totalPatients = parseInt(hospitalMatch[20]);
            data.total.activeConsults = data.total.active;
            console.log('EMS546 - Totals:', hospitalMatch[17], hospitalMatch[18], hospitalMatch[19], hospitalMatch[20]);
            
        } else {
            console.log('EMS546 - Pattern not found, trying individual hospital extraction...');
            
            // Fallback: try individual hospital patterns
            const jpchMatch = text.match(/JPCH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);
            const ruhMatch = text.match(/RUH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);
            const sphMatch = text.match(/SPH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);
            const schMatch = text.match(/SCH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);
            const totalMatch = text.match(/Total\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);
            
            if (jpchMatch) {
                data.hospitals.JPCH.admittedPtsInED = parseInt(jpchMatch[1]);
                data.hospitals.JPCH.active = parseInt(jpchMatch[2]);
                data.hospitals.JPCH.consults = parseInt(jpchMatch[3]);
                data.hospitals.JPCH.activeConsults = data.hospitals.JPCH.active;
                console.log('EMS546 - JPCH individual match:', jpchMatch[1], jpchMatch[2], jpchMatch[3]);
            }
            
            if (ruhMatch) {
                data.hospitals.RUH.admittedPtsInED = parseInt(ruhMatch[1]);
                data.hospitals.RUH.active = parseInt(ruhMatch[2]);
                data.hospitals.RUH.consults = parseInt(ruhMatch[3]);
                data.hospitals.RUH.activeConsults = data.hospitals.RUH.active;
                console.log('EMS546 - RUH individual match:', ruhMatch[1], ruhMatch[2], ruhMatch[3]);
            }
            
            if (sphMatch) {
                data.hospitals.SPH.admittedPtsInED = parseInt(sphMatch[1]);
                data.hospitals.SPH.active = parseInt(sphMatch[2]);
                data.hospitals.SPH.consults = parseInt(sphMatch[3]);
                data.hospitals.SPH.activeConsults = data.hospitals.SPH.active;
                console.log('EMS546 - SPH individual match:', sphMatch[1], sphMatch[2], sphMatch[3]);
            }
            
            if (schMatch) {
                data.hospitals.SCH.admittedPtsInED = parseInt(schMatch[1]);
                data.hospitals.SCH.active = parseInt(schMatch[2]);
                data.hospitals.SCH.consults = parseInt(schMatch[3]);
                data.hospitals.SCH.activeConsults = data.hospitals.SCH.active;
                console.log('EMS546 - SCH individual match:', schMatch[1], schMatch[2], schMatch[3]);
            }
            
            if (totalMatch) {
                data.total.admittedPtsInED = parseInt(totalMatch[1]);
                data.total.active = parseInt(totalMatch[2]);
                data.total.consults = parseInt(totalMatch[3]);
                data.total.totalPatients = parseInt(totalMatch[4]);
                data.total.activeConsults = data.total.active;
                console.log('EMS546 - Total individual match:', totalMatch[1], totalMatch[2], totalMatch[3], totalMatch[4]);
            }
            
            // If individual patterns worked, log success
            if (jpchMatch || ruhMatch || sphMatch || schMatch) {
                console.log('EMS546 - Individual hospital patterns successful');
            } else {
                console.log('EMS546 - No patterns matched, using fallback values');
                throw new Error('Unable to extract hospital data from PDF');
            }
        }

        // Extract bed capacity data for each hospital (unchanged)
        const ruhTotalPattern = /Royal\s+University\s+Hospital[\s\S]*?Total\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i;
        const ruhTotalMatch = text.match(ruhTotalPattern);
        if (ruhTotalMatch) {
            data.hospitals.RUH.occupiedBeds = parseInt(ruhTotalMatch[1]);
            data.hospitals.RUH.totalBeds = parseInt(ruhTotalMatch[2]);
            data.hospitals.RUH.overcapacityBeds = parseInt(ruhTotalMatch[3]);
            console.log('EMS546 - RUH bed capacity:', ruhTotalMatch[1], ruhTotalMatch[2], ruhTotalMatch[3]);
        }

        const sphTotalPattern = /St\s+Paul's\s+Hospital[\s\S]*?Total\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i;
        const sphTotalMatch = text.match(sphTotalPattern);
        if (sphTotalMatch) {
            data.hospitals.SPH.occupiedBeds = parseInt(sphTotalMatch[1]);
            data.hospitals.SPH.totalBeds = parseInt(sphTotalMatch[2]);
            data.hospitals.SPH.overcapacityBeds = parseInt(sphTotalMatch[3]);
            console.log('EMS546 - SPH bed capacity:', sphTotalMatch[1], sphTotalMatch[2], sphTotalMatch[3]);
        }

        const schTotalPattern = /Saskatoon\s+City\s+Hospital[\s\S]*?Total\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i;
        const schTotalMatch = text.match(schTotalPattern);
        if (schTotalMatch) {
            data.hospitals.SCH.occupiedBeds = parseInt(schTotalMatch[1]);
            data.hospitals.SCH.totalBeds = parseInt(schTotalMatch[2]);
            data.hospitals.SCH.overcapacityBeds = parseInt(schTotalMatch[3]);
            console.log('EMS546 - SCH bed capacity:', schTotalMatch[1], schTotalMatch[2], schTotalMatch[3]);
        }

        const jpchTotalPattern = /Jim\s+Pattison's?\s+Children\s+Hospital[\s\S]*?Total\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i;
        const jpchTotalMatch = text.match(jpchTotalPattern);
        if (jpchTotalMatch) {
            data.hospitals.JPCH.occupiedBeds = parseInt(jpchTotalMatch[1]);
            data.hospitals.JPCH.totalBeds = parseInt(jpchTotalMatch[2]);
            data.hospitals.JPCH.overcapacityBeds = parseInt(jpchTotalMatch[3]);
            console.log('EMS546 - JPCH bed capacity:', jpchTotalMatch[1], jpchTotalMatch[2], jpchTotalMatch[3]);
        }

        // Extract Emergency Department breakdown (unchanged)
        const edBreakdownPattern = /Site\s+Service\s+Department\s+Total\s+([\s\S]*?)(?=Please\s+be\s+advised|Emergency\s+Department)/i;
        const edBreakdownMatch = text.match(edBreakdownPattern);
        
        if (edBreakdownMatch) {
            const edText = edBreakdownMatch[1];
            
            const ruhDeptMatches = edText.match(/RUH\s+([\s\S]*?)(?=SPH|$)/i);
            if (ruhDeptMatches) {
                const departments = ruhDeptMatches[1].match(/(\w+\s+ED)\s+(\d+)/g);
                if (departments) {
                    departments.forEach(dept => {
                        const [, name, count] = dept.match(/(\w+\s+ED)\s+(\d+)/);
                        data.hospitals.RUH.edBreakdown[name] = parseInt(count);
                    });
                    console.log('EMS546 - RUH ED breakdown extracted');
                }
            }
            
            const sphDeptMatches = edText.match(/SPH\s+([\s\S]*?)$/i);
            if (sphDeptMatches) {
                const departments = sphDeptMatches[1].match(/(\w+\s+ED)\s+(\d+)/g);
                if (departments) {
                    departments.forEach(dept => {
                        const [, name, count] = dept.match(/(\w+\s+ED)\s+(\d+)/);
                        data.hospitals.SPH.edBreakdown[name] = parseInt(count);
                    });
                    console.log('EMS546 - SPH ED breakdown extracted');
                }
            }
        }

        return data;
        
    } catch (error) {
        console.error('EMS546 - Error extracting hospital data:', error);
        throw error;
    }
}

// API Routes (unchanged)
app.get('/api/hospital-data', async (req, res) => {
    try {
        if (cachedData && lastUpdateTime && (Date.now() - lastUpdateTime.getTime()) < 15 * 60 * 1000) {
            return res.json({
                success: true,
                data: cachedData,
                cached: true,
                cacheAge: Math.floor((Date.now() - lastUpdateTime.getTime()) / 1000)
            });
        }

        const data = await parsePDF();
        
        res.json({
            success: true,
            data: data,
            cached: false
        });
        
    } catch (error) {
        console.error('EMS546 - API Error:', error);
        
        if (cachedData) {
            return res.json({
                success: true,
                data: cachedData,
                cached: true,
                warning: 'Using cached data due to fetch error',
                error: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        lastUpdate: lastUpdateTime ? lastUpdateTime.toISOString() : null,
        hasData: !!cachedData,
        dataPreview: cachedData ? {
            totalAdmitted: cachedData.total.admittedPtsInED,
            totalActive: cachedData.total.active,
            totalConsults: cachedData.total.consults,
            totalPatients: cachedData.total.totalPatients
        } : null
    });
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Schedule PDF parsing every 15 minutes
cron.schedule('*/15 * * * *', async () => {
    console.log('EMS546 - Scheduled PDF parsing started...');
    try {
        await parsePDF();
        console.log('EMS546 - Scheduled PDF parsing completed successfully');
    } catch (error) {
        console.error('EMS546 - Scheduled PDF parsing failed:', error);
    }
});

// Initial data load
(async () => {
    try {
        console.log('🚂 EMS546 - Loading initial hospital data...');
        await parsePDF();
        console.log('✅ EMS546 - Initial data loaded successfully');
    } catch (error) {
        console.error('❌ EMS546 - Failed to load initial data:', error);
    }
})();

app.listen(PORT, () => {
    console.log(`🚂 EMS546 Hospital Tracker running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🏥 API endpoint: http://localhost:${PORT}/api/hospital-data`);
    console.log(`🌐 Website: http://localhost:${PORT}`);
});

module.exports = app;
