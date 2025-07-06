const express = require('express');
const axios = require('axios');
const pdf = require('pdf-parse');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let data = {
    lastUpdated: new Date().toLocaleString(),
    hospitals: {
        JPCH: { name: "Jim Pattison Children's Hospital", admittedPtsInED: 0, active: 12, consults: 1, activeConsults: 12 },
        RUH: { name: "Royal University Hospital", admittedPtsInED: 14, active: 36, consults: 6, activeConsults: 36 },
        SPH: { name: "St. Paul's Hospital", admittedPtsInED: 4, active: 20, consults: 4, activeConsults: 20 },
        SCH: { name: "Saskatoon City Hospital", admittedPtsInED: 0, active: 19, consults: 0, activeConsults: 19 }
    },
    total: { admittedPtsInED: 18, active: 87, consults: 11, activeConsults: 87, totalPatients: 116 }
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
        console.log('EMS546 - PDF parsed');
        
        const jpch = text.match(/JPCH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);
        const ruh = text.match(/RUH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);
        const sph = text.match(/SPH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);
        const sch = text.match(/SCH\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);
        const total = text.match(/Total\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);

        if (jpch) {
            data.hospitals.JPCH.admittedPtsInED = parseInt(jpch[1]);
            data.hospitals.JPCH.active = parseInt(jpch[2]);
            data.hospitals.JPCH.consults = parseInt(jpch[3]);
            data.hospitals.JPCH.activeConsults = data.hospitals.JPCH.active;
        }
        if (ruh) {
            data.hospitals.RUH.admittedPtsInED = parseInt(ruh[1]);
            data.hospitals.RUH.active = parseInt(ruh[2]);
            data.hospitals.RUH.consults = parseInt(ruh[3]);
            data.hospitals.RUH.activeConsults = data.hospitals.RUH.active;
        }
        if (sph) {
            data.hospitals.SPH.admittedPtsInED = parseInt(sph[1]);
            data.hospitals.SPH.active = parseInt(sph[2]);
            data.hospitals.SPH.consults = parseInt(sph[3]);
            data.hospitals.SPH.activeConsults = data.hospitals.SPH.active;
        }
        if (sch) {
            data.hospitals.SCH.admittedPtsInED = parseInt(sch[1]);
            data.hospitals.SCH.active = parseInt(sch[2]);
            data.hospitals.SCH.consults = parseInt(sch[3]);
            data.hospitals.SCH.activeConsults = data.hospitals.SCH.active;
        }
        if (total) {
            data.total.admittedPtsInED = parseInt(total[1]);
            data.total.active = parseInt(total[2]);
            data.total.consults = parseInt(total[3]);
            data.total.totalPatients = parseInt(total[4]);
            data.total.activeConsults = data.total.active;
        }
        
        data.lastUpdated = new Date().toLocaleString();
        console.log('EMS546 - Data updated');
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

app.listen(PORT, () => {
    console.log('EMS546 running on port ' + PORT);
});

module.exports = app;
