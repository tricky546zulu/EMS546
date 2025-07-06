const express = require(‘express’);
const axios = require(‘axios’);
const pdf = require(‘pdf-parse’);
const cors = require(‘cors’);
const cron = require(‘node-cron’);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(‘public’));

let data = {
lastUpdated: new Date().toLocaleString(),
hospitals: {
JPCH: {
name: “Jim Pattison Children’s Hospital”,
admittedPtsInED: 0,
active: 0,
consults: 2,
activeConsults: 0,
edBreakdown: {}
},
RUH: {
name: “Royal University Hospital”,
admittedPtsInED: 19,
active: 24,
consults: 6,
activeConsults: 24,
edBreakdown: {
“Medicine ED”: 12,
“Neurosciences ED”: 2,
“Oncology ED”: 4,
“Surgery ED”: 1
}
},
SPH: {
name: “St. Paul’s Hospital”,
admittedPtsInED: 8,
active: 26,
consults: 1,
activeConsults: 26,
edBreakdown: {
“Medicine ED”: 7
}
},
SCH: {
name: “Saskatoon City Hospital”,
admittedPtsInED: 0,
active: 0,
consults: 0,
activeConsults: 0,
edBreakdown: {}
}
},
total: {
admittedPtsInED: 27,
active: 50,
consults: 9,
activeConsults: 50,
totalPatients: 86
}
};

async function updateData() {
try {
console.log(‘EMS546 - Fetching PDF…’);
const response = await axios.get(‘https://www.ehealthsask.ca/reporting/Documents/SaskatoonHospitalBedCapacity.pdf’, {
responseType: ‘arraybuffer’,
timeout: 30000,
headers: {
‘User-Agent’: ‘Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36’
}
});

```
    console.log('EMS546 - PDF downloaded, size:', response.data.length);
    
    const pdfData = await pdf(response.data);
    const text = pdfData.text;
    console.log('EMS546 - PDF parsed, text length:', text.length);
    
    // Clean up the text - remove multiple spaces and normalize line breaks
    const cleanText = text.replace(/\s+/g, ' ').replace(/\n/g, ' ');
    
    // Log sections to debug
    console.log('EMS546 - Looking for emergency department data...');
    
    // Extract timestamp - multiple patterns
    let timestamp = null;
    const timestampPatterns = [
        /(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)/,
        /(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}:\d{2})/,
        /(\d{1,2}\/\d{1,2}\/\d{4})/
    ];
    
    for (const pattern of timestampPatterns) {
        const match = text.match(pattern);
        if (match) {
            timestamp = match[1];
            console.log('EMS546 - Found timestamp:', timestamp);
            break;
        }
    }
    
    // Find the Emergency Department section
    // The key is to find where it says "Site Admitted Pts in ED Active Consults Total"
    // followed by the hospital data
    
    // Method 1: Look for the exact table structure
    let edData = null;
    
    // Try to find the ED table header and extract following lines
    const edHeaderIndex = cleanText.indexOf('Site Admitted Pts in ED');
    if (edHeaderIndex > -1) {
        console.log('EMS546 - Found ED header at position:', edHeaderIndex);
        // Extract the next 500 characters after the header
        const edSection = cleanText.substring(edHeaderIndex, edHeaderIndex + 500);
        console.log('EMS546 - ED section:', edSection);
        
        // Parse each hospital line
        const lines = edSection.split(/(?=JPCH|RUH|SPH|Total)/);
        
        for (const line of lines) {
            if (line.includes('JPCH')) {
                const match = line.match(/JPCH\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
                if (match) {
                    data.hospitals.JPCH.admittedPtsInED = parseInt(match[1]) || 0;
                    data.hospitals.JPCH.active = parseInt(match[2]) || 0;
                    data.hospitals.JPCH.consults = parseInt(match[3]) || 0;
                    data.hospitals.JPCH.activeConsults = parseInt(match[2]) || 0;
                    console.log('EMS546 - JPCH data:', match[1], match[2], match[3], match[4]);
                }
            } else if (line.includes('RUH')) {
                const match = line.match(/RUH\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
                if (match) {
                    data.hospitals.RUH.admittedPtsInED = parseInt(match[1]) || 0;
                    data.hospitals.RUH.active = parseInt(match[2]) || 0;
                    data.hospitals.RUH.consults = parseInt(match[3]) || 0;
                    data.hospitals.RUH.activeConsults = parseInt(match[2]) || 0;
                    console.log('EMS546 - RUH data:', match[1], match[2], match[3], match[4]);
                }
            } else if (line.includes('SPH')) {
                const match = line.match(/SPH\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
                if (match) {
                    data.hospitals.SPH.admittedPtsInED = parseInt(match[1]) || 0;
                    data.hospitals.SPH.active = parseInt(match[2]) || 0;
                    data.hospitals.SPH.consults = parseInt(match[3]) || 0;
                    data.hospitals.SPH.activeConsults = parseInt(match[2]) || 0;
                    console.log('EMS546 - SPH data:', match[1], match[2], match[3], match[4]);
                }
            } else if (line.includes('Total') && !line.includes('Department')) {
                const match = line.match(/Total\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
                if (match) {
                    data.total.admittedPtsInED = parseInt(match[1]) || 0;
                    data.total.active = parseInt(match[2]) || 0;
                    data.total.consults = parseInt(match[3]) || 0;
                    data.total.totalPatients = parseInt(match[4]) || 0;
                    data.total.activeConsults = parseInt(match[2]) || 0;
                    console.log('EMS546 - Total data:', match[1], match[2], match[3], match[4]);
                }
            }
        }
    }
    
    // Method 2: If method 1 fails, try alternative patterns
    if (data.total.totalPatients === 0) {
        console.log('EMS546 - Method 1 failed, trying alternative patterns...');
        
        // Look for patterns anywhere in the text
        const patterns = {
            jpch: /JPCH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/g,
            ruh: /RUH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/g,
            sph: /SPH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/g,
            total: /Total\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/g
        };
        
        let jpchMatch = patterns.jpch.exec(cleanText);
        let ruhMatch = patterns.ruh.exec(cleanText);
        let sphMatch = patterns.sph.exec(cleanText);
        let totalMatch = patterns.total.exec(cleanText);
        
        // Keep looking for the right match (sometimes there are multiple tables)
        while (jpchMatch && jpchMatch[1] === '0' && jpchMatch[2] === '0') {
            jpchMatch = patterns.jpch.exec(cleanText);
        }
        while (ruhMatch && ruhMatch[1] === '0' && ruhMatch[2] === '0') {
            ruhMatch = patterns.ruh.exec(cleanText);
        }
        while (sphMatch && sphMatch[1] === '0' && sphMatch[2] === '0') {
            sphMatch = patterns.sph.exec(cleanText);
        }
        
        if (jpchMatch) {
            data.hospitals.JPCH.admittedPtsInED = parseInt(jpchMatch[1]) || 0;
            data.hospitals.JPCH.active = parseInt(jpchMatch[2]) || 0;
            data.hospitals.JPCH.consults = parseInt(jpchMatch[3]) || 0;
            data.hospitals.JPCH.activeConsults = parseInt(jpchMatch[2]) || 0;
            console.log('EMS546 - JPCH (method 2):', jpchMatch[0]);
        }
        
        if (ruhMatch) {
            data.hospitals.RUH.admittedPtsInED = parseInt(ruhMatch[1]) || 0;
            data.hospitals.RUH.active = parseInt(ruhMatch[2]) || 0;
            data.hospitals.RUH.consults = parseInt(ruhMatch[3]) || 0;
            data.hospitals.RUH.activeConsults = parseInt(ruhMatch[2]) || 0;
            console.log('EMS546 - RUH (method 2):', ruhMatch[0]);
        }
        
        if (sphMatch) {
            data.hospitals.SPH.admittedPtsInED = parseInt(sphMatch[1]) || 0;
            data.hospitals.SPH.active = parseInt(sphMatch[2]) || 0;
            data.hospitals.SPH.consults = parseInt(sphMatch[3]) || 0;
            data.hospitals.SPH.activeConsults = parseInt(sphMatch[2]) || 0;
            console.log('EMS546 - SPH (method 2):', sphMatch[0]);
        }
        
        if (totalMatch) {
            data.total.admittedPtsInED = parseInt(totalMatch[1]) || 0;
            data.total.active = parseInt(totalMatch[2]) || 0;
            data.total.consults = parseInt(totalMatch[3]) || 0;
            data.total.totalPatients = parseInt(totalMatch[4]) || 0;
            data.total.activeConsults = parseInt(totalMatch[2]) || 0;
            console.log('EMS546 - Total (method 2):', totalMatch[0]);
        }
    }
    
    // Extract ED breakdown
    const breakdownIndex = cleanText.indexOf('Site Service Department Total');
    if (breakdownIndex > -1) {
        const breakdownSection = cleanText.substring(breakdownIndex, breakdownIndex + 300);
        console.log('EMS546 - Found breakdown section');
        
        // RUH breakdown
        const ruhMedicine = breakdownSection.match(/RUH Medicine ED (\d+)/);
        const ruhNeuro = breakdownSection.match(/Neurosciences ED (\d+)/);
        const ruhOnco = breakdownSection.match(/Oncology ED (\d+)/);
        const ruhSurgery = breakdownSection.match(/Surgery ED (\d+)/);
        
        if (ruhMedicine || ruhNeuro || ruhOnco || ruhSurgery) {
            data.hospitals.RUH.edBreakdown = {};
            if (ruhMedicine) data.hospitals.RUH.edBreakdown["Medicine ED"] = parseInt(ruhMedicine[1]);
            if (ruhNeuro) data.hospitals.RUH.edBreakdown["Neurosciences ED"] = parseInt(ruhNeuro[1]);
            if (ruhOnco) data.hospitals.RUH.edBreakdown["Oncology ED"] = parseInt(ruhOnco[1]);
            if (ruhSurgery) data.hospitals.RUH.edBreakdown["Surgery ED"] = parseInt(ruhSurgery[1]);
        }
        
        // SPH breakdown
        const sphMedicine = breakdownSection.match(/SPH Medicine ED (\d+)/);
        if (sphMedicine) {
            data.hospitals.SPH.edBreakdown = {
                "Medicine ED": parseInt(sphMedicine[1])
            };
        }
    }
    
    // SCH doesn't appear in ED data
    data.hospitals.SCH.admittedPtsInED = 0;
    data.hospitals.SCH.active = 0;
    data.hospitals.SCH.consults = 0;
    data.hospitals.SCH.activeConsults = 0;
    
    // Update timestamp
    data.lastUpdated = timestamp || new Date().toLocaleString();
    
    console.log('EMS546 - Update complete. Summary:', {
        timestamp: data.lastUpdated,
        total: data.total,
        hospitals: {
            JPCH: `${data.hospitals.JPCH.admittedPtsInED}/${data.hospitals.JPCH.active}/${data.hospitals.JPCH.consults}`,
            RUH: `${data.hospitals.RUH.admittedPtsInED}/${data.hospitals.RUH.active}/${data.hospitals.RUH.consults}`,
            SPH: `${data.hospitals.SPH.admittedPtsInED}/${data.hospitals.SPH.active}/${data.hospitals.SPH.consults}`,
            SCH: `${data.hospitals.SCH.admittedPtsInED}/${data.hospitals.SCH.active}/${data.hospitals.SCH.consults}`
        }
    });
    
    return data;
} catch (error) {
    console.error('EMS546 - Error updating data:', error.message);
    console.error('EMS546 - Stack trace:', error.stack);
    
    // Return existing data if update fails
    return data;
}
```

}

// Cache management
let lastUpdateTime = 0;
let cachedData = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

app.get(’/api/hospital-data’, async (req, res) => {
try {
const now = Date.now();

```
    // Use cache if available and fresh
    if (cachedData && (now - lastUpdateTime) < CACHE_DURATION) {
        console.log('EMS546 - Serving cached data');
        return res.json({ 
            success: true, 
            data: cachedData, 
            cached: true,
            cacheAge: Math.floor((now - lastUpdateTime) / 1000)
        });
    }
    
    // Otherwise, fetch fresh data
    console.log('EMS546 - Fetching fresh data');
    const result = await updateData();
    
    // Update cache
    cachedData = result;
    lastUpdateTime = now;
    
    res.json({ 
        success: true, 
        data: result, 
        cached: false 
    });
} catch (error) {
    console.error('EMS546 - API error:', error);
    
    // If we have cached data, return it even if stale
    if (cachedData) {
        return res.json({ 
            success: true, 
            data: cachedData, 
            cached: true,
            cacheAge: Math.floor((Date.now() - lastUpdateTime) / 1000),
            error: 'Using cached data due to update error'
        });
    }
    
    // Otherwise return the default data
    res.json({ 
        success: true, 
        data: data, 
        cached: false,
        error: error.message 
    });
}
```

});

app.get(’/health’, (req, res) => {
res.json({
status: ‘OK’,
timestamp: new Date().toISOString(),
lastUpdate: data.lastUpdated,
hasData: data.total.totalPatients > 0,
dataPreview: {
totalAdmitted: data.total.admittedPtsInED,
totalActive: data.total.active,
totalConsults: data.total.consults,
totalPatients: data.total.totalPatients
}
});
});

app.get(’/debug’, async (req, res) => {
try {
console.log(‘EMS546 - Debug: Fetching PDF for analysis…’);
const response = await axios.get(‘https://www.ehealthsask.ca/reporting/Documents/SaskatoonHospitalBedCapacity.pdf’, {
responseType: ‘arraybuffer’,
timeout: 30000
});

```
    const pdfData = await pdf(response.data);
    const text = pdfData.text;
    
    // Find and extract relevant sections
    const edHeaderIndex = text.indexOf('Site Admitted Pts in ED');
    const edSection = edHeaderIndex > -1 ? text.substring(edHeaderIndex, edHeaderIndex + 500) : 'Not found';
    
    res.json({
        pdfLength: text.length,
        edHeaderFound: edHeaderIndex > -1,
        edHeaderPosition: edHeaderIndex,
        edSection: edSection,
        sampleText: text.substring(3000, 3500),
        currentData: data
    });
} catch (error) {
    res.json({
        error: error.message,
        stack: error.stack
    });
}
```

});

app.get(’/’, (req, res) => {
res.sendFile(__dirname + ‘/public/index.html’);
});

// Initialize
console.log(‘EMS546 - Starting server…’);
updateData().then(() => {
console.log(‘EMS546 - Initial data loaded’);
}).catch(err => {
console.error(‘EMS546 - Failed to load initial data:’, err);
});

// Schedule automatic updates every 15 minutes
cron.schedule(’*/15 * * * *’, () => {
console.log(‘EMS546 - Running scheduled update…’);
updateData().then(() => {
cachedData = data;
lastUpdateTime = Date.now();
}).catch(err => {
console.error(‘EMS546 - Scheduled update failed:’, err);
});
});

app.listen(PORT, () => {
console.log(`EMS546 - Server running on port ${PORT}`);
console.log(`EMS546 - Health check: http://localhost:${PORT}/health`);
console.log(`EMS546 - Debug endpoint: http://localhost:${PORT}/debug`);
});

module.exports = app;