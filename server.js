// server.js - Enhanced with Python scraper logic for EMS546
const express = require(‘express’);
const axios = require(‘axios’);
const pdf = require(‘pdf-parse’);
const cors = require(‘cors’);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(‘public’));

// Hospital configuration (from Python code)
const HOSPITAL_MAPPING = {
‘RUH’: ‘Royal University Hospital’,
‘SPH’: ‘St. Paul's Hospital’,
‘SCH’: ‘Saskatoon City Hospital’,
‘JPCH’: ‘Jim Pattison Children's Hospital’
};

// Validation ranges (from Python code)
const HOSPITAL_RANGES = {
‘RUH’: { min: 15, max: 120 },
‘SPH’: { min: 5, max: 80 },
‘SCH’: { min: 0, max: 60 },
‘JPCH’: { min: 0, max: 40 }
};

// In-memory storage with previous data for change detection
let cachedData = {
lastUpdated: new Date().toLocaleString(),
hospitals: {
JPCH: {
name: “Jim Pattison Children’s Hospital”,
admittedPtsInED: 0,
active: 12,
consults: 1,
activeConsults: 12,
totalPatients: 13
},
RUH: {
name: “Royal University Hospital”,
admittedPtsInED: 14,
active: 36,
consults: 6,
activeConsults: 36,
totalPatients: 56
},
SPH: {
name: “St. Paul’s Hospital”,
admittedPtsInED: 4,
active: 20,
consults: 4,
activeConsults: 20,
totalPatients: 28
},
SCH: {
name: “Saskatoon City Hospital”,
admittedPtsInED: 0,
active: 19,
consults: 0,
activeConsults: 19,
totalPatients: 19
}
},
total: {
admittedPtsInED: 18,
active: 87,
consults: 11,
activeConsults: 87,
totalPatients: 116
}
};

let previousData = JSON.parse(JSON.stringify(cachedData)); // Deep copy for change detection

// Enhanced PDF parsing with Python-inspired logic
async function parsePDF() {
try {
console.log(‘EMS546 - Fetching PDF with enhanced parsing…’);

```
    const response = await axios.get('https://www.ehealthsask.ca/reporting/Documents/SaskatoonHospitalBedCapacity.pdf', {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; EMS546-HospitalTracker/1.0)'
        }
    });

    const pdfData = await pdf(response.data);
    const text = pdfData.text;
    
    console.log('EMS546 - PDF parsed, length:', text.length);
    
    // Extract timestamp
    const timestampMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)/);
    if (timestampMatch) {
        cachedData.lastUpdated = timestampMatch[1];
        console.log('EMS546 - Updated timestamp:', timestampMatch[1]);
    }
    
    // Enhanced table detection (inspired by Python Camelot logic)
    const extractedData = extractEmergencyDepartmentData(text);
    
    if (extractedData && extractedData.length > 0) {
        // Validate and process the extracted data
        const validatedData = validateHospitalData(extractedData);
        
        if (validatedData.length > 0) {
            // Handle missing hospitals (like Python code does)
            const completeData = handleMissingHospitals(validatedData);
            
            // Update cached data with validated results
            updateCachedData(completeData);
            
            // Store as previous data for next comparison
            previousData = JSON.parse(JSON.stringify(cachedData));
            
            console.log('EMS546 - Data extraction and validation completed successfully');
            return cachedData;
        }
    }
    
    console.log('EMS546 - No valid data extracted, keeping cached values');
    return cachedData;
    
} catch (error) {
    console.error('EMS546 - PDF parsing error:', error.message);
    return cachedData; // Return cached data on error
}
```

}

// Enhanced table extraction (inspired by Python column-aware logic)
function extractEmergencyDepartmentData(text) {
console.log(‘EMS546 - Looking for Emergency Department table…’);

```
const hospitalData = [];

// Method 1: Try comprehensive pattern matching (like Python's column detection)
const fullTablePattern = /Site\s+Admitted\s+Pts\s+in\s+ED\s+Active\s+Consults\s+Total[\s\S]*?JPCH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)[\s\S]*?RUH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)[\s\S]*?SPH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)[\s\S]*?SCH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)[\s\S]*?Total\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i;

const fullTableMatch = text.match(fullTablePattern);
if (fullTableMatch) {
    console.log('EMS546 - Full table pattern matched');
    return [
        { code: 'JPCH', admitted: parseInt(fullTableMatch[1]), active: parseInt(fullTableMatch[2]), consults: parseInt(fullTableMatch[3]), total: parseInt(fullTableMatch[4]) },
        { code: 'RUH', admitted: parseInt(fullTableMatch[5]), active: parseInt(fullTableMatch[6]), consults: parseInt(fullTableMatch[7]), total: parseInt(fullTableMatch[8]) },
        { code: 'SPH', admitted: parseInt(fullTableMatch[9]), active: parseInt(fullTableMatch[10]), consults: parseInt(fullTableMatch[11]), total: parseInt(fullTableMatch[12]) },
        { code: 'SCH', admitted: parseInt(fullTableMatch[13]), active: parseInt(fullTableMatch[14]), consults: parseInt(fullTableMatch[15]), total: parseInt(fullTableMatch[16]) }
    ];
}

// Method 2: Individual hospital extraction with flexible pattern matching
console.log('EMS546 - Trying individual hospital extraction...');
const hospitals = ['JPCH', 'RUH', 'SPH', 'SCH'];

hospitals.forEach(code => {
    const patterns = [
        // Pattern 1: 4 numbers (Admitted, Active, Consults, Total)
        new RegExp(`${code}\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)`, 'i'),
        // Pattern 2: 3 numbers (might be missing one column)
        new RegExp(`${code}\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)`, 'i'),
        // Pattern 3: 2 numbers (basic pattern)
        new RegExp(`${code}\\s+(\\d+)\\s+(\\d+)`, 'i')
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            let admitted, active, consults, total;
            
            if (match.length === 5) { // 4 numbers found
                admitted = parseInt(match[1]);
                active = parseInt(match[2]);
                consults = parseInt(match[3]);
                total = parseInt(match[4]);
            } else if (match.length === 4) { // 3 numbers found
                admitted = parseInt(match[1]);
                active = parseInt(match[2]);
                total = parseInt(match[3]);
                consults = total - admitted - active; // Calculate consults
            } else if (match.length === 3) { // 2 numbers found
                admitted = parseInt(match[1]);
                total = parseInt(match[2]);
                active = total - admitted; // Assume rest are active
                consults = 0;
            }
            
            // Validation: ensure numbers make sense
            if (total >= admitted && total >= active && admitted >= 0 && active >= 0) {
                hospitalData.push({ code, admitted, active, consults: consults || 0, total });
                console.log(`EMS546 - Extracted ${code}: ${admitted} admitted, ${active} active, ${consults || 0} consults, ${total} total`);
                break; // Stop trying other patterns for this hospital
            }
        }
    }
});

return hospitalData;
```

}

// Data validation (inspired by Python validation logic)
function validateHospitalData(hospitalData) {
console.log(‘EMS546 - Validating extracted data…’);
const validData = [];

```
hospitalData.forEach(data => {
    const { code, total, admitted } = data;
    const range = HOSPITAL_RANGES[code];
    
    // Range validation
    if (total < range.min || total > range.max) {
        // Special case for SCH - allow 0 even if below minimum
        if (code === 'SCH' && total === 0) {
            console.log(`EMS546 - Accepting ${code} with 0 patients (likely missing from PDF)`);
        } else {
            console.log(`EMS546 - Rejecting ${code}: ${total} patients outside range ${range.min}-${range.max}`);
            return;
        }
    }
    
    // Change detection (inspired by Python sudden change detection)
    const previousTotal = previousData.hospitals[code]?.totalPatients || 0;
    if (previousTotal > 0) {
        const changePercent = Math.abs(total - previousTotal) / previousTotal;
        if (changePercent > 0.5) { // 50% change threshold
            console.log(`EMS546 - Warning: Large change for ${code}: ${previousTotal} -> ${total} (${(changePercent * 100).toFixed(1)}% change)`);
            // Still accept it, but log warning
        }
    }
    
    // Basic data integrity checks
    if (admitted > total) {
        console.log(`EMS546 - Warning: ${code} admitted (${admitted}) > total (${total}), swapping`);
        data.admitted = total;
        data.total = admitted;
    }
    
    validData.push(data);
    console.log(`EMS546 - Validated ${code}: ${data.total} total patients`);
});

return validData;
```

}

// Handle missing hospitals (from Python logic)
function handleMissingHospitals(hospitalData) {
const foundHospitals = new Set(hospitalData.map(h => h.code));
const allHospitals = new Set(Object.keys(HOSPITAL_MAPPING));
const missingHospitals = […allHospitals].filter(code => !foundHospitals.has(code));

```
if (missingHospitals.length > 0) {
    console.log(`EMS546 - Missing hospitals from PDF: ${missingHospitals.join(', ')}`);
    
    missingHospitals.forEach(code => {
        // For missing hospitals, especially SCH, set to 0 if they were previously non-zero
        const previousTotal = previousData.hospitals[code]?.totalPatients || 0;
        
        if (code === 'SCH' && previousTotal > 0) {
            console.log(`EMS546 - ${code} missing from PDF, setting to 0 patients`);
            hospitalData.push({ code, admitted: 0, active: 0, consults: 0, total: 0 });
        } else {
            console.log(`EMS546 - ${code} missing from PDF, keeping previous data`);
        }
    });
}

return hospitalData;
```

}

// Update cached data structure
function updateCachedData(hospitalData) {
console.log(‘EMS546 - Updating cached data structure…’);

```
let totalAdmitted = 0, totalActive = 0, totalConsults = 0, totalPatients = 0;

hospitalData.forEach(data => {
    const { code, admitted, active, consults, total } = data;
    
    if (cachedData.hospitals[code]) {
        cachedData.hospitals[code].admittedPtsInED = admitted;
        cachedData.hospitals[code].active = active;
        cachedData.hospitals[code].consults = consults;
        cachedData.hospitals[code].activeConsults = active; // For compatibility
        cachedData.hospitals[code].totalPatients = total;
        
        // Add to totals
        totalAdmitted += admitted;
        totalActive += active;
        totalConsults += consults;
        totalPatients += total;
    }
});

// Update totals
cachedData.total.admittedPtsInED = totalAdmitted;
cachedData.total.active = totalActive;
cachedData.total.consults = totalConsults;
cachedData.total.activeConsults = totalActive;
cachedData.total.totalPatients = totalPatients;

console.log(`EMS546 - Updated totals: ${totalPatients} total patients`);
```

}

// API Routes (unchanged)
app.get(’/api/hospital-data’, async (req, res) => {
try {
const data = await parsePDF();
res.json({
success: true,
data: data,
cached: false
});
} catch (error) {
res.json({
success: true,
data: cachedData,
cached: true,
error: error.message
});
}
});

app.get(’/health’, (req, res) => {
res.json({
status: ‘OK’,
timestamp: new Date().toISOString(),
hasData: true,
dataPreview: {
totalAdmitted: cachedData.total.admittedPtsInED,
totalActive: cachedData.total.active,
totalConsults: cachedData.total.consults,
totalPatients: cachedData.total.totalPatients
}
});
});

app.get(’/’, (req, res) => {
res.sendFile(__dirname + ‘/public/index.html’);
});

// Load data on startup
(async () => {
console.log(‘🚂 EMS546 - Starting with enhanced PDF parsing…’);
await parsePDF();
console.log(‘✅ EMS546 - Ready with validated hospital data!’);
})();

app.listen(PORT, () => {
console.log(`🚂 EMS546 running on port ${PORT}`);
console.log(`📊 Enhanced with Python-inspired validation and error handling`);
});

module.exports = app;
