const express = require('express');
const axios = require('axios');
const pdf = require('pdf-parse');
const cors = require('cors');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let data = {
    lastUpdated: new Date().toLocaleString(),
    hospitals: {
        JPCH: { 
            name: "Jim Pattison Children's Hospital", 
            admittedPtsInED: 0, 
            active: 0, 
            consults: 2, 
            activeConsults: 0,
            edBreakdown: {}
        },
        RUH: { 
            name: "Royal University Hospital", 
            admittedPtsInED: 19, 
            active: 24, 
            consults: 6, 
            activeConsults: 24,
            edBreakdown: {
                "Medicine ED": 12,
                "Neurosciences ED": 2,
                "Oncology ED": 4,
                "Surgery ED": 1
            }
        },
        SPH: { 
            name: "St. Paul's Hospital", 
            admittedPtsInED: 8, 
            active: 26, 
            consults: 1, 
            activeConsults: 26,
            edBreakdown: {
                "Medicine ED": 7
            }
        },
        SCH: { 
            name: "Saskatoon City Hospital", 
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
        console.log('EMS546 - Fetching PDF...');
        const response = await axios.get('https://www.ehealthsask.ca/reporting/Documents/SaskatoonHospitalBedCapacity.pdf', {
            responseType: 'arraybuffer',
            timeout: 30000
        });
        const pdfData = await pdf(response.data);
        const text = pdfData.text;
        console.log('EMS546 - PDF parsed, length:', text.length);
        
        // Extract timestamp from the PDF
        const timestampMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)/);
        if (timestampMatch) {
            data.lastUpdated = timestampMatch[1];
        }
        
        // Look for the Emergency Department section
        // The pattern in the PDF is:
        // Site Admitted Pts in ED Active Consults Total
        // JPCH 0 0 2 2
        // RUH 19 24 6 49
        // SPH 8 26 1 35
        // Total 27 50 9 86
        
        // More flexible regex patterns to handle whitespace variations
        const edSectionMatch = text.match(/Site\s+Admitted\s+Pts\s+in\s+ED\s+Active\s+Consults\s+Total([\s\S]*?)(?:Site\s+Service|Please\s+be\s+advised)/i);
        
        if (edSectionMatch) {
            const edSection = edSectionMatch[1];
            console.log('EMS546 - Found ED section');
            
            // Extract individual hospital data with more flexible patterns
            const jpchMatch = edSection.match(/JPCH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
            const ruhMatch = edSection.match(/RUH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
            const sphMatch = edSection.match(/SPH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
            const totalMatch = edSection.match(/Total\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
            
            if (jpchMatch) {
                data.hospitals.JPCH.admittedPtsInED = parseInt(jpchMatch[1]);
                data.hospitals.JPCH.active = parseInt(jpchMatch[2]);
                data.hospitals.JPCH.consults = parseInt(jpchMatch[3]);
                data.hospitals.JPCH.activeConsults = parseInt(jpchMatch[2]);
                console.log('EMS546 - JPCH:', jpchMatch[1], jpchMatch[2], jpchMatch[3], jpchMatch[4]);
            }
            
            if (ruhMatch) {
                data.hospitals.RUH.admittedPtsInED = parseInt(ruhMatch[1]);
                data.hospitals.RUH.active = parseInt(ruhMatch[2]);
                data.hospitals.RUH.consults = parseInt(ruhMatch[3]);
                data.hospitals.RUH.activeConsults = parseInt(ruhMatch[2]);
                console.log('EMS546 - RUH:', ruhMatch[1], ruhMatch[2], ruhMatch[3], ruhMatch[4]);
            }
            
            if (sphMatch) {
                data.hospitals.SPH.admittedPtsInED = parseInt(sphMatch[1]);
                data.hospitals.SPH.active = parseInt(sphMatch[2]);
                data.hospitals.SPH.consults = parseInt(sphMatch[3]);
                data.hospitals.SPH.activeConsults = parseInt(sphMatch[2]);
                console.log('EMS546 - SPH:', sphMatch[1], sphMatch[2], sphMatch[3], sphMatch[4]);
            }
            
            // SCH doesn't appear in the ED section, so set to 0
            data.hospitals.SCH.admittedPtsInED = 0;
            data.hospitals.SCH.active = 0;
            data.hospitals.SCH.consults = 0;
            data.hospitals.SCH.activeConsults = 0;
            
            if (totalMatch) {
                data.total.admittedPtsInED = parseInt(totalMatch[1]);
                data.total.active = parseInt(totalMatch[2]);
                data.total.consults = parseInt(totalMatch[3]);
                data.total.totalPatients = parseInt(totalMatch[4]);
                data.total.activeConsults = parseInt(totalMatch[2]);
                console.log('EMS546 - Total:', totalMatch[1], totalMatch[2], totalMatch[3], totalMatch[4]);
            }
            
            // Extract ED breakdown if available
            const edBreakdownMatch = text.match(/Site\s+Service\s+Department\s+Total([\s\S]*?)(?:Emergency\s+Department|$)/i);
            if (edBreakdownMatch) {
                const breakdown = edBreakdownMatch[1];
                
                // RUH breakdown
                const ruhMedicineED = breakdown.match(/RUH\s+Medicine\s+ED\s+(\d+)/);
                const ruhNeurosciencesED = breakdown.match(/Neurosciences\s+ED\s+(\d+)/);
                const ruhOncologyED = breakdown.match(/Oncology\s+ED\s+(\d+)/);
                const ruhSurgeryED = breakdown.match(/Surgery\s+ED\s+(\d+)/);
                
                if (ruhMedicineED || ruhNeurosciencesED || ruhOncologyED || ruhSurgeryED) {
                    data.hospitals.RUH.edBreakdown = {};
                    if (ruhMedicineED) data.hospitals.RUH.edBreakdown["Medicine ED"] = parseInt(ruhMedicineED[1]);
                    if (ruhNeurosciencesED) data.hospitals.RUH.edBreakdown["Neurosciences ED"] = parseInt(ruhNeurosciencesED[1]);
                    if (ruhOncologyED) data.hospitals.RUH.edBreakdown["Oncology ED"] = parseInt(ruhOncologyED[1]);
                    if (ruhSurgeryED) data.hospitals.RUH.edBreakdown["Surgery ED"] = parseInt(ruhSurgeryED[1]);
                }
                
                // SPH breakdown
                const sphMedicineED = breakdown.match(/SPH\s+Medicine\s+ED\s+(\d+)/);
                if (sphMedicineED) {
                    data.hospitals.SPH.edBreakdown = {
                        "Medicine ED": parseInt(sphMedicineED[1])
                    };
                }
            }
        } else {
            console.log('EMS546 - Could not find ED section in PDF');
            // Log first 500 chars for debugging
            console.log('EMS546 - PDF text preview:', text.substring(0, 500));
        }
        
        if (!data.lastUpdated) {
            data.lastUpdated = new Date().toLocaleString();
        }
        
        console.log('EMS546 - Data updated:', JSON.stringify(data.total));
        return data;
    } catch (error) {
        console.error('EMS546 - Error:', error.message);
        return data;
    }
}

app.get('/api/hospital-data', async (req, res) => {
    const result = await updateData();
    res.json({ success: true, data: result, cached: false });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        hasData: true,
        dataPreview: {
            totalAdmitted: data.total.admittedPtsInED,
            totalActive: data.total.active,
            totalConsults: data.total.consults,
            totalPatients: data.total.totalPatients
        }
    });
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

console.log('EMS546 - Starting...');
updateData().then(() => console.log('EMS546 - Ready!'));

// Schedule automatic updates every 15 minutes
cron.schedule('*/15 * * * *', () => {
    console.log('EMS546 - Running scheduled update...');
    updateData();
});

app.listen(PORT, () => {
    console.log('EMS546 running on port ' + PORT);
});

module.exports = app;
