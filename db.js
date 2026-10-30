const mysql = require('mysql2');
const config = require('./dbconfig');

// Settings live in dbconfig.js (environment variables, with defaults for local XAMPP).
const pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true // dates come back as "2026-10-11 09:30:00" text, easy to show on the pages
});

module.exports = pool.promise();
