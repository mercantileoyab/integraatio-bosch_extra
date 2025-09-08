const dotenv = require('dotenv');
const https = require('https');
const { getSaleslines } = require('./dbProcess');
const { getCustomersInExtra, 
    getProductGroups, 
    createTurnoverObjects,
    bookPoints,
    getFailedTurnovers,
    clearAllFailedTurnovers } = require('./apiBosch')

const defineDotEnvFileName = () => {
    const envArgs = process.argv.slice(2);
    if (envArgs.length === 0) {
        console.warn('No environment file specified. Using default .env file.');
        dotenv.config();
    } else {
        envArgs.forEach((arg) => {
            const envFilePath = `./.env.${arg}`;
            dotenv.config({ path: envFilePath });
        });
    }
};

// Defining if running with prod or dev .env -file
defineDotEnvFileName();

// Defining configurations for making AXIOS-request - depends on .env -file
const getConfig = () => {
    return {
        config: {
            baseURL: process.env.API_BOSCH_URL,
            timeout: process.env.API_BOSCH_TIMEOUT,
            auth: {
                username: process.env.API_BOSCH_USERNAME,
                password: process.env.API_BOSCH_PASSWORD,
            },
            headers: {
                RequestKey: process.env.API_BOSCH_REQUEST_KEY,
                'Content-Type': 'application/json',
            },
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            }),
        },
        options: {
            testMode: process.env.API_BOSCH_TEST_MODE,
            wholesaler: process.env.API_BOSCH_WHOLESALER,
            country: process.env.API_BOSCH_COUNTRY
        }           
        
    };
};

// 0. Creating configuration file for creating AXIOS requests for BOSCH API
const config = getConfig()

const processSaleslines = async () => {
    try {

        // 1. Get customers registered to Bosch Extra
        const customers = await getCustomersInExtra(config);
        // console.log(customers)

        // 2. Get saleslines for Bosch-labeled articles from AX for yesterday
        let saleslines = await getSaleslines(
            process.env.ORUM_DATABASE_URL,
            process.env.ORUM_DATABASE_NAME,
            process.env.ORUM_DATABASE_USERNAME,
            process.env.ORUM_DATABASE_PASSWORD
        );

        

        // 3. Filter saleslines where the customer is registered to Bosch EXTRA
        saleslines = saleslines.filter(line => 
            customers.some(customer => customer.customerId === line.custAccount)
        );

        // console.log('Saleslines count: ' + saleslines.length)

        // 4. Filter saleslines where article is part of Bosch Extra & add Bosch Extra info to lines
        const products = await getProductGroups(config, [...new Set(saleslines.map(line => line.itemId))], process.env.API_BOSCH_COUNTRY)
        
        saleslines = saleslines
            // Filtering saleslines where article can be found from products
            .filter(line => {
            return products.some(product => product.articleNr === line.itemId)   
            })
            // Adding Bosch EXTRA product data to salesline-objects
            .map(line => {
                const found = products.find(product => product.articleNr === line.itemId)
                return {...line, ...found}
            })

        // console.log('Saleslines (2) count: ' + saleslines.length)
        // 5. Create turnovers based on saleslines
        const turnovers = createTurnoverObjects(saleslines, process.env.API_BOSCH_WHOLESALER)
        
        // 6. Send turnovers to Bosch EXTRA and book points
        bookPoints(config, turnovers, process.env.API_BOSCH_COUNTRY, process.env.API_BOSCH_BATCHSIZE)


    } catch (err) {
        console.error("Error processing saleslines:", err);
        throw err;
    }
}

// Process turnovers from tmp which failed
const processFailedTurnovers = async () => {
    try {
        const failedTurnovers = getFailedTurnovers()

        // Remove duplicates based on turnover, operator and trasactionId
        const uniqueTurnovers = new Set()
        const filteredTurnovers = failedTurnovers.filter(turnover => {
            const uniqueKey = `${turnover.turnover}_${turnover.operator}${turnover.transactionId}`
            if (uniqueTurnovers.has(uniqueKey)) {
                return false
            }
            uniqueTurnovers.add(uniqueKey)
            return true
        })
        clearAllFailedTurnovers()
        bookPoints(config, filteredTurnovers, process.env.API_BOSCH_COUNTRY, process.env.API_BOSCH_BATCHSIZE)
        
        
    } catch(err) {
        console.error(err)
    }
}


const processSaleslinesTest = async () => {
    try {

        // 1. Get customers registered to Bosch Extra
        const customers = await getCustomersInExtra(config);
        console.log(`Checking if customerid includes '61-225027'`)
        customers.forEach(customer => {
            if (customer.customerId.includes('61-225027')) {
                console.log(customer);
            }
        });
        console.log('-------------------')

        // 2. Get saleslines for Bosch-labeled articles from AX for yesterday
        let saleslines = await getSaleslines(
            process.env.ORUM_DATABASE_URL,
            process.env.ORUM_DATABASE_NAME,
            process.env.ORUM_DATABASE_USERNAME,
            process.env.ORUM_DATABASE_PASSWORD
        );

        console.log(`Checking if saleslines filtered customerid includes '61-225027'`)
        saleslines.forEach(line => {
            if (line.custAccount.includes('61-225027')) {
                console.log(line);
            }
        });
        console.log('-------------------')
        

        // 3. Filter saleslines where the customer is registered to Bosch EXTRA
        saleslines = saleslines.filter(line => 
            customers.some(customer => customer.customerId === line.custAccount)
        );

        // console.log('Saleslines count: ' + saleslines.length)

        
        // 4. Filter saleslines where article is part of Bosch Extra & add Bosch Extra info to lines
        const products = await getProductGroups(config, [...new Set(saleslines.map(line => line.itemId))], process.env.API_BOSCH_COUNTRY)
        
        saleslines = saleslines
            // Filtering saleslines where article can be found from products
            .filter(line => {
            return products.some(product => product.articleNr === line.itemId)   
            })
            // Adding Bosch EXTRA product data to salesline-objects
            .map(line => {
                const found = products.find(product => product.articleNr === line.itemId)
                return {...line, ...found}
            })
        
        saleslines.forEach(line => {
            if (line.custAccount.includes('61-225027')) {
                console.log(line);
            }
        })

        console.log('-------------------')
        console.log(`Creating turnvover objects...`)
        // console.log('Saleslines (2) count: ' + saleslines.length)
        // 5. Create turnovers based on saleslines
        const turnovers = createTurnoverObjects(saleslines, process.env.API_BOSCH_WHOLESALER)
        turnovers.forEach(turnover => {
            if (turnover.customer.includes('225027')) {
                console.log(turnover);
            }
        })


        // 6. Send turnovers to Bosch EXTRA and book points
        // bookPoints(config, turnovers, process.env.API_BOSCH_COUNTRY, process.env.API_BOSCH_BATCHSIZE)


    } catch (err) {
        console.error("Error processing saleslines:", err);
        throw err;
    }
}

const customersTesting = async () => {
    try {
        const customers = await getCustomersInExtra(config);
        customers.filter(customer => customer.customerId.includes('61-61-')).forEach(customer => {
            console.log(customer);
        })
    } catch (err) {
        console.error("Error getting customers in Bosch Extra:", err);
        throw err;
    }
}

const getProductGroupsTest = async (country, itemIds) => {
    try {
        const products = await getProductGroups(config, itemIds, country);
        // products.forEach(product => {
        //     console.log(product);
        // })
    } catch (err) {
        console.error("Error getting product groups:", err);
        throw err;
    }
}

const mode = process.argv[3]

if (mode === undefined) {
    processSaleslines();
} else if (mode === "handlefailed") {
    processFailedTurnovers();
} else if (mode === "testing") {
    processTest();
} else if (mode === "test") {
    // customersTesting();
    getProductGroupsTest(process.env.API_BOSCH_COUNTRY, ['0986479C20', '0986479939', '0986494668'], 'FI')
}
