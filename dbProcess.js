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
        // const result = await pool.request().query(`
        //     SELECT TOP (20) s.*
        //     FROM BoschSaleslinesYesterdayTest s
        //     JOIN CustomersBoschExtra c ON s.CUSTACCOUNT = c.customerId
        // `);

        // Production query
        const result = await pool.request().query(`
            SELECT s.*
            FROM BoschSaleslinesYesterday s
            JOIN CustomersBoschExtra c ON s.CUSTACCOUNT = c.customerId
        `);

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

const readCustomersBoschExtra = async (database_url, database_name, database_username, database_password) => {
    try {
        const pool = await connection(
            database_url,
            database_name,
            database_username,
            database_password
        );
        const result = await pool.request().query("SELECT * FROM CustomersBoschExtra;");
        return result.recordset;
    } catch (error) {
        console.error("Error reading CustomersBoschExtra:", error);
        throw error;
    }
}

// Strategy 1: Bulk insert using table-valued parameter (most efficient for large datasets)
const addCustomersBoschExtraBulk = async (database_url, database_name, database_username, database_password, customers) => {
    try {
        const pool = await connection(
            database_url,
            database_name,
            database_username,
            database_password
        );

        const table = new mssql.Table('CustomersBoschExtra');
        table.create = false; // Don't create the table, it should already exist

    // Match SQL Server schema: varchar(255), varchar(50), int, varchar(255)
    table.columns.add('customerId', mssql.VarChar(255), { nullable: true });
    table.columns.add('status', mssql.VarChar(50), { nullable: true });
    table.columns.add('wholesalerId', mssql.Int, { nullable: true });
    table.columns.add('wholesalerName', mssql.VarChar(255), { nullable: true });

        // Debug: print first 3 customers
        customers.slice(0, 3).forEach((customer, idx) => {
            console.log(`Bulk insert customer[${idx}]:`, customer);
        });

        customers.forEach(customer => {
            table.rows.add(
                customer.customerId ? String(customer.customerId) : null,
                customer.status ? String(customer.status) : null,
                customer.wholesalerId !== undefined ? parseInt(customer.wholesalerId) : null,
                customer.wholesalerName ? String(customer.wholesalerName) : null
            );
        });
        
        const request = pool.request();
        const result = await request.bulk(table);
        console.log(`Bulk inserted ${customers.length} customers successfully`);
        return result;
    } catch (error) {
        console.error("Error bulk adding customers to CustomersBoschExtra:", error);
        throw error;
    }
}


module.exports = {
    connection,
    closeConnection,
    queryAndCreateSaleslines,
    getSaleslines,
    readCustomersBoschExtra,
    addCustomersBoschExtraBulk
}