/**
 * Creates the tables in the database named by your environment variables.
 * Use it for a cloud database, where phpMyAdmin is not available:   npm run setup-db
 * Safe to run more than once (the SQL uses CREATE TABLE IF NOT EXISTS).
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('./dbconfig');

(async () => {
    let conn;
    try {
        conn = await mysql.createConnection({ ...config, multipleStatements: true });
        const sql = fs.readFileSync(path.join(__dirname, 'schema-cloud.sql'), 'utf8');
        await conn.query(sql);
        const [tables] = await conn.query('SHOW TABLES');
        console.log('Connected to ' + config.host + ':' + config.port + ' / ' + config.database);
        console.log('Tables ready: ' + tables.map((t) => Object.values(t)[0]).join(', '));
    } catch (err) {
        console.error('Could not set up the database: ' + err.message);
        console.error('Check DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME and DB_SSL.');
        process.exitCode = 1;
    } finally {
        if (conn) await conn.end();
    }
})();
