const express = require(‘express’);
const axios = require(‘axios’);
const pdf = require(‘pdf-parse’);
const cors = require(‘cors’);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(‘public’));

let cachedData = {
lastUpdated: new Date().toLocaleString(),
hospitals: {
JPCH: {
name: “Jim Pattison Children’s Hospital”,
admittedPtsInED: 0,
active: 12,
consults: 1,
activeConsults: 12
},
RUH: {
name: “Royal University Hospital”,
admittedPtsInED: 14,
active: 36,
consults: 6,
activeConsults: 36
},
SPH: {
name: “St. Paul’s Hospital”,
admittedPtsInED: 4,
active: 20,
consults: 4,
activeConsults: 20
},
SCH: {
name: “Saskatoon City Hospital”,
admittedPtsInED: 0,
active: 19,
consults: 0,
activeConsults: 19
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

async function parsePDF() {
try {
console.log(‘EMS546 - Fetching PDF…’);

```
    const response = await axios.get('https://www.ehealthsask.ca/reporting/Documents/SaskatoonHospitalBedCapacity.pdf', {
        responseType: 'arraybuffer',
        timeout: 30000
    });

    const pdfData = await pdf(response.data);
    const text = pdfData.text;
    
    console.log('EMS546 - PDF parsed, length:', text.length);
    
    const timestampMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)/);
    if (timestampMatch) {
        cachedData.lastUpdated = timestampMatch[1];
        console.log('EMS546 - Timestamp:', timestampMatch[1]);
    }
    
    const jpchMatch = text.match(/JPCH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);
    const ruhMatch = text.match(/RUH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);
    const sphMatch = text.match(/SPH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);
    const schMatch = text.match(/SCH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);
    const totalMatch = text.match(/Total\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);

    if (jpchMatch) {
        cachedData.hospitals.JPCH.admittedPtsInED = parseInt(jpchMatch[1]);
        cachedData.hospitals.JPCH.active = parseInt(jpchMatch[2]);
        cachedData.hospitals.JPCH.consults = parseInt(jpchMatch[3]);
        cachedData.hospitals.JPCH.activeConsults = cachedData.hospitals.JPCH.active;
        console.log('EMS546 - JPCH:', jpchMatch[1], jpchMatch[2], jpchMatch[3]);
    }

    if (ruhMatch) {
        cachedData.hospitals.RUH.admittedPtsInED = parseInt(ruhMatch[1]);
        cachedData.hospitals.RUH.active = parseInt(ruhMatch[2]);
        cachedData.hospitals.RUH.consults = parseInt(ruhMatch[3]);
        cachedData.hospitals.RUH.activeConsults = cachedData.hospitals.RUH.active;
        console.log('EMS546 - RUH:', ruhMatch[1], ruhMatch[2], ruhMatch[3]);
    }

    if (sphMatch) {
        cachedData.hospitals.SPH.admittedPtsInED = parseInt(sphMatch[1]);
        cachedData.hospitals.SPH.active = parseInt(sphMatch[2]);
        cachedData.hospitals.SPH.consults = parseInt(sphMatch[3]);
        cachedData.hospitals.SPH.activeConsults = cachedData.hospitals.SPH.active;
        console.log('EMS546 - SPH:', sphMatch[1], sphMatch[2], sphMatch[3]);
    }

    if (schMatch) {
        cachedData.hospitals.SCH.admittedPtsInED = parseInt(schMatch[1]);
        cachedData.hospitals.SCH.active = parseInt(schMatch[2]);
        cachedData.hospitals.SCH.consults = parseInt(schMatch[3]);
        cachedData.hospitals.SCH.activeConsults = cachedData.hospitals.SCH.active;
        console.log('EMS546 - SCH:', schMatch[1], schMatch[2], schMatch[3]);
    }

    if (totalMatch) {
        cachedData.total.admittedPtsInED = parseInt(totalMatch[1]);
        cachedData.total.active = parseInt(totalMatch[2]);
        cachedData.total.consults = parseInt(totalMatch[3]);
        cachedData.total.totalPatients = parseInt(totalMatch[4]);
        cachedData.total.activeConsults = cachedData.total.active;
        console.log('EMS546 - Totals:', totalMatch[1], totalMatch[2], totalMatch[3], totalMatch[4]);
    }

    console.log('EMS546 - Data updated successfully');
    return cachedData;
    
} catch (error) {
    console.error('EMS546 - Error:', error.message);
    return cachedData;
}
```

}

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

(async () => {
console.log(‘EMS546 - Starting…’);
await parsePDF();
console.log(‘EMS546 - Ready!’);
})();

app.listen(PORT, () => {
console.log(`EMS546 running on port ${PORT}`);
});

module.exports = app;
