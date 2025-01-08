const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();
const https = require('https');

const getConfig = () => {
    return {
        baseURL: process.env.API_BOSCH_URL,
        timeout: 60000,
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
    };
};

const getCustomersInExtra = async () => {
    const config = getConfig()
    try {
        const res = await axios.get('/masterdata/participatingcustomers/get', config)
        console.log(res.data)
    } catch(err) {
        console.error(err)
    }
};


module.exports = {
    getCustomersInExtra,
};
