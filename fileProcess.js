const fs = require('fs');
const path = require('path');

const fileName = './tmp/turnovers.csv';

// Ensure the tmp directory exists
const ensureDirectoryExists = () => {
    const dir = path.dirname(fileName);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

// Create CSV file from list of turnover objects
const createCSVFileFromListOfTurnoverObjects = (turnovers) => {
    if (!turnovers || turnovers.length === 0) {
        throw new Error('No stock objects provided');
    }

    const headers = Object.keys(turnovers[0]);
    const csvRows = turnovers.map(obj => 
        headers.map(header => obj[header]).join(';')
    );

    return [headers.join(';'), ...csvRows].join('\n');
};

// Read the CSV file in temp (create file if it doesn't exist)
const readCSVFileInTemp = () => {
    ensureDirectoryExists()

    try {
        if (!fs.existsSync(fileName)) {
            fs.writeFileSync(fileName, '', 'utf8');
        }

        const data = fs.readFileSync(fileName, 'utf8');
        return data;
    } catch (err) {
        console.error('Error reading succeeded turnovers');
        throw err;
    }
};

// Save CSV file to temp
const saveCSVFileToTemp = (csvString) => {
    ensureDirectoryExists()

    fs.writeFileSync(fileName, csvString, 'utf8');
    return fileName;
};

// Save turnovers to temp
const saveTurnoversToTemp = (turnovers) => {
    const csvString = createCSVFileFromListOfTurnoverObjects(turnovers);
    const currentSavedTurnovers = readCSVFileInTemp();

    let newSavedTurnovers;
    
    if (currentSavedTurnovers && currentSavedTurnovers.trim()) {
        // If currentSavedTurnovers is not empty, remove the first row (headers) from csvString
        const csvStringRows = csvString.split('\n');
        csvStringRows.shift(); // Remove the first row (header)
        const newCsvString = csvStringRows.join('\n');
        
        newSavedTurnovers = `${currentSavedTurnovers}\n${newCsvString}`;
    } else {
        // If currentSavedTurnovers is empty, just append the whole csvString
        newSavedTurnovers = `${currentSavedTurnovers}\n${csvString}`;
    }

    saveCSVFileToTemp(newSavedTurnovers);
};


module.exports = {
    saveTurnoversToTemp
};
