const dotenv = require('dotenv');
const https = require('https');
const { getSaleslines, readCustomersBoschExtra, addCustomersBoschExtraBulk } = require('./dbProcess');
const { getCustomersInExtra, 
    getProductGroups, 
    createTurnoverObjects,
    // getProductGroupsToAllProducts,
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

        // 1. Get customers registered to Bosch Extra & add if new add to CustomersBoschExtra -table
        const customers = await getCustomersInExtra(config);
        
        const currentCustomers = await readCustomersBoschExtra(
            process.env.ORUM_DATABASE_URL,
            process.env.ORUM_DATABASE_NAME,
            process.env.ORUM_DATABASE_USERNAME,
            process.env.ORUM_DATABASE_PASSWORD
        );
        const newCustomers = customers.filter(cust => !currentCustomers.some(curr => curr.customerId === cust.customerId));
        
        if (newCustomers.length > 0) {
            await addCustomersBoschExtraBulk(
                process.env.ORUM_DATABASE_URL,
                process.env.ORUM_DATABASE_NAME,
                process.env.ORUM_DATABASE_USERNAME,
                process.env.ORUM_DATABASE_PASSWORD,
                newCustomers
            );
        } else {
            console.log('No new customers to add');
        }

        // 2. Get saleslines for Bosch-labeled articles from AX for yesterday for Bosch Extra customers
        let saleslines = await getSaleslines(
            process.env.ORUM_DATABASE_URL,
            process.env.ORUM_DATABASE_NAME,
            process.env.ORUM_DATABASE_USERNAME,
            process.env.ORUM_DATABASE_PASSWORD
        );

        console.log(saleslines.length + ' saleslines fetched from database');

        // 3. Filter saleslines - if no in EXTRA, filter out

        // 3.1 Get all articles in Bosch EXTRA
        const itemIds = [...new Set(saleslines.map(line => line.importerProductCode))];
        
        // Send requests in batches of 300 articles
        const batchSize = 300;
        let itemsInExtra = [];
        
        for (let i = 0; i < itemIds.length; i += batchSize) {
            const batch = itemIds.slice(i, i + batchSize);
            
            const batchResults = await getProductGroups(config, batch, process.env.API_BOSCH_COUNTRY);
            itemsInExtra = itemsInExtra.concat(batchResults);
        }

        // 3.2 Compare saleslines articles to those in EXTRA
        // 3.3 If match, keep the line, if not, filter out
        saleslines = saleslines.filter(line => {
            return itemsInExtra.some(item => item.articleNr === line.importerProductCode);
        });

        console.log(saleslines.length + ' saleslines after filtering with Bosch EXTRA articles');

        // 4. Create turnovers based on saleslines
        // 4.1 Create turnover objects
        const turnovers = createTurnoverObjects(saleslines, process.env.API_BOSCH_WHOLESALER);
        
        // 5. Send turnovers to Bosch EXTRA and book points
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

const mode = process.argv[3]

if (mode === undefined) {
    processSaleslines();
} else if (mode === "handlefailed") {
    processFailedTurnovers();
} else if (mode === "test") {
    console.log('Test mode - no operations defined yet');
}
