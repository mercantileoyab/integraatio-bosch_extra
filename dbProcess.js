const mssql = require("mssql");
const Salesline = require('./objects/salesline')

const connection = async (server_url, database_name, database_username, database_password) => {
    try {
        const config = {
            server: server_url,
            database: database_name,
            user: database_username,
            password: database_password,
            options: {
                encrypt: false,
                trustServerCertificate: true
            },
            connectionTimeout: 60000, // 60 seconds
            requestTimeout: 60000 // 60 seconds
        };

        const pool = await mssql.connect(config);
        console.log("Connected to the database successfully!");
        return pool;
    } catch (error) {
        console.error("Database connection failed:", error);
        throw error;
    }
}

const closeConnection = async (pool) => {
    try {
        await pool.close();
        console.log("Database connection closed successfully!");
    } catch (error) {
        console.error("Error closing the database connection:", error);
        throw error;
    }
}

const queryAndCreateSaleslines = async (pool) => {
    try {
        // This query result for testing
        // const result = await pool.request().query("SELECT TOP(20) * FROM BoschSaleslinesYesterdayTest;");

        // Production query
        const result = await pool.request().query("SELECT * FROM BoschSaleslinesYesterday;");
        
        const saleslines = result.recordset.map(row => new Salesline(
            row.SALESID,
            row.ITEMID,
            row.LINEAMOUNT,
            row.QTYORDERED,
            row.CUSTACCOUNT,
            row.CREATEDDATETIME,
            row.ProductLabel,
            row.ImporterProductCode
        ));

        return saleslines;
    } catch (error) {
        console.error("Error executing query:", error);
        throw error;
    }
}

const getSaleslines = async (database_url, database_name, database_username, database_password) => {
    let connectionPool;
    try {
        connectionPool = await connection(
            database_url,
            database_name,
            database_username,
            database_password
        )

        const saleslines = await queryAndCreateSaleslines(connectionPool)

        return saleslines

    } catch(error) {
        console.error("Error during database operation:", error);
        throw error;
    } finally {
        if (connectionPool) {
            // Close the connection
            await closeConnection(connectionPool);
        }
    }
}

module.exports = {
    connection,
    closeConnection,
    queryAndCreateSaleslines,
    getSaleslines
}