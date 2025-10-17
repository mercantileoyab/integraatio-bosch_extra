const axios = require('axios');
const Product = require('./objects/product');
const Customer = require('./objects/customer');
const Turnover = require('./objects/turnover');
const { saveTurnoversToTemp } = require('./fileProcess')
const fs = require('fs');

// Location and file for failed turnovers
const failedTurnoversFile = './tmp/failed_turnovers.json'

// Getting customers registered to Bosch EXTRA
const getCustomersInExtra = async (configFile) => {
    const { config } = configFile
    try {
        const response = await axios.get("masterdata/participatingcustomers/get", config)
        return response?.data.customers.map(obj => {
            return new Customer(obj.customerNumber, obj.status, obj.wholesalerId, obj.wholesalerName)
        })
    } catch(err) {
        console.error(err)
    }
};

// Getting products and linked PG for all products and saving data to file in ./tmp
const getProductGroupsToAllProducts = async (configFile, country) => {
    const { config } = configFile;

    // Version 3.7 api
    const data = JSON.stringify({
        "country": country.toUpperCase(),
        "tradelevel": "WORKSHOP",
        "withChildElements": true,
        "partnerId": 1,
        "productGroups": [
            {
                "name": "PG001"  // All products
            }
        ]
    })

    try {
        const response = await axios.post('productgroup/get', data, config)
        // Save response.data to file in ./tmp
        fs.writeFileSync('./tmp/all_products_with_pg.json', JSON.stringify(response.data, null, 2), 'utf-8');
        console.log('All products with product groups saved to ./tmp/all_products_with_pg.json');
        
    } catch(err) {
        console.error(err)
    }
};

// Getting products that are in Bosch EXTRA + getting those Productgroup id:s
const getProductGroups = async (configFile, itemIds, country) => {
    const { config } = configFile;

    // Version 3.7 api
    const data = JSON.stringify({
        "country": country.toUpperCase(),
        "tradelevel": "WORKSHOP",        
        "partnerId": 1,           // <-- now at root level
        "withChildElements": true,
        "withPointsOnly": true,
        "omitPointsInResponse": false,
        "productGroups": itemIds.map(item => {
            return {
                "name": item
            }
        })
    })

    try {
        const response = await axios.post('productgroup/get', data, config)
        return response?.data.productGroups.map(obj => {
            return new Product(obj.name, obj.rule, obj.parameter)
        })
        
    } catch(err) {
        console.error(err)
    }
}

// For getting failed turnovers from .tmp folder
const getFailedTurnovers = () => {
    try {
        const data = fs.readFileSync(failedTurnoversFile, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.log('Error reading failed turnovers:', err.message);
        return [];
    }
};

// For saving failed turnovers to ./tmp folder
const saveFailedTurnovers = (turnovers) => {
    const data = JSON.stringify(turnovers)
    fs.writeFile(failedTurnoversFile, data, 'utf-8', (err) => {
        if (err) {
            console.log('Error saving failed turnovers:', err.message);
        } else {
            console.log('Turnovers in error saved in tmp-folder');
        }
    });
};

// For handling errors when sending batch
const handleErrorWhenSendingBatch = (turnovers) => {
    const failedTurnovers = getFailedTurnovers()
    const updatedTurnovers = failedTurnovers.concat(turnovers)
    saveFailedTurnovers(updatedTurnovers)
};

const clearAllFailedTurnovers = () => {
    const data = JSON.stringify([])
    fs.writeFile(failedTurnoversFile, data, 'utf-8', (err) => {
        if (err) {
            console.log('Error saving failed turnovers:', err.message);
        } else {
            console.log('Turnovers in error saved in tmp-folder');
        }
    });
}

// Make batches from turnovers inside turnover object 
const getTurnoversAsBatches = (batchSize, turnovers) => {
   
    let turnoverBatches = [];
    let batch = [];

    turnovers.forEach(turnover => {
        if (batch.length < batchSize) {
            batch.push(turnover)
        } else {
            turnoverBatches.push(batch)
            batch = [ turnover ]
        }
    });
    turnoverBatches.push(batch)
    return turnoverBatches
}

const bookPoints = async (configFile, turnovers, country, batchSize) => {
    // Get config for sending to Bosch EXTRA
    const { config } = configFile;

    // Make batches from turnovers inside turnover object
    const turnoverBatches = getTurnoversAsBatches(batchSize, turnovers)

    let i = 1;

    let failedTurnovers = [];
    let succeedTurnovers = [];

    // Send batches to Bosch Extra if there is something to be sent
    if (turnoverBatches.length > 0) {
        for (const batch of turnoverBatches) {

            console.log(`Sending batch ${i}/${turnoverBatches.length}`)
            // console.log(batch)
            i++
            const turnover = getTurnoverRequest(batch, country);
            try {
                const response = await sendBookPoints(turnover, config);
                succeedTurnovers = succeedTurnovers.concat(response.data.turnovers)
                // console.log(response.data);
            } catch (err) {
                console.error(`Error when sending batch of transactions: ${err}`)
                failedTurnovers = failedTurnovers.concat(batch)
            }
        }
    }

    // Save failed turnovers for later 'resque'
    failedTurnovers.length > 0 && handleErrorWhenSendingBatch(failedTurnovers)

    // Save succeeded turnovers to tmp-folder
    succeedTurnovers.length > 0 && saveTurnoversToTemp(succeedTurnovers)
}

// const sendBookPoints = async (data, config) => {
//     // throw 'simulating error'
//     // console.log(JSON.stringify(data))
//     try {
        
//         const response = await axios.post('points/book', data, config)
//         // console.log(response)
//         // console.log(JSON.stringify(response.data, null, 2));
//         console.log('Res status after sending this: ' + response.status)
        
//         return response
//     } catch(err) {
//         // console.error(err)
//         console.log(JSON.stringify(response.data, null, 2));
//         throw err;
//     }
// }

const sendBookPoints = async (data, config) => {
    try {
        // console.log("-----next batch------")
        // console.log('Objects to be sent in this batch:')
        // console.log(JSON.stringify(data))
        const response = await axios.post('points/book', data, config);
        console.log('Res status after sending this: ' + response.status);
        return response;
    } catch (err) {
        if (err.response) {
            console.log('Error status:', err.response.status);
            console.log('Error response:', JSON.stringify(err.response.data, null, 2));
        } else if (err.request) {
            console.log('No response received:', err.request);
        } else {
            console.log('Request setup error:', err.message);
        }
        throw err;
    }
    
}


// Period must in form YEAR_MM (example 2024_12)
const getPeriod = (datetime) => {
    const date = new Date(datetime)
    return `${date.getFullYear()}_${date.getMonth() < 9 ? `0${date.getMonth() + 1}` : date.getMonth() + 1}`
}

const createTurnoverObjects = (saleslines, wholesaler) => {
    return saleslines.map(l => {
        return new Turnover(
            l.boschExtraAccount,
            wholesaler,
            getPeriod(l.createdDatetime),
            l.lineAmount,
            l.importerProductCode,
            l.salesid
        )
    })
}

// For getting correct form of turnover request
const getTurnoverRequest = (turnovers, country) => {
    return {
        "bookTurnover": true,
        "country": country.toUpperCase(),
        "language": country,
        "tradelevel": "WORKSHOP",
        "turnovers": turnovers
    }
}

module.exports = {
    getCustomersInExtra,
    getProductGroups,
    createTurnoverObjects,
    bookPoints,
    getFailedTurnovers,
    clearAllFailedTurnovers,
    getProductGroupsToAllProducts
};
