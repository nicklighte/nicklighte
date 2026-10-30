/**
 * Database settings, shared by db.js (the app) and setup-db.js (creates the tables).
 * Everything comes from environment variables. The defaults match local XAMPP.
 *
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME   where the database is
 *   DB_SSL=true      encrypt the connection (cloud databases such as Aiven need this)
 *   DB_SSL_CA        optional: the provider's CA certificate text, to also verify the server
 */
function sslOptions() {
    if (process.env.DB_SSL_CA) {
        // the certificate is pasted as one line, with \n where the line breaks were
        return { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n'), rejectUnauthorized: true };
    }
    if (['1', 'true', 'yes'].includes(String(process.env.DB_SSL || '').toLowerCase())) {
        return { rejectUnauthorized: false }; // encrypted, but the server's identity is not checked
    }
    return undefined; // local XAMPP: no encryption needed
}

module.exports = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'green_agribusiness',
    charset: 'utf8mb4',
    ssl: sslOptions()
};
