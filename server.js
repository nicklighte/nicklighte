/**
 * Green Agribusiness: back end (Express 5 + MySQL).
 *
 * Sections: setup -> helpers -> auth -> public API -> cart & orders (buyer) -> farmer -> admin -> start.
 * Every SQL statement uses ? placeholders, so user input can never change the query (SQL injection).
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const PROD = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ORDER_FLOW = ['placed', 'confirmed', 'dispatched', 'delivered'];
const UNITS = ['kg', 'bunch', 'crate', 'sack', 'piece', 'litre', 'tray'];
const EMAIL_RE = /^[^@\s]{1,64}@[^@\s]{1,255}\.[A-Za-z]{2,}$/;
const PHONE_RE = /^\+?[0-9 ]{9,15}$/;

// ------------------------------------------------------------------ setup
const app = express();
app.disable('x-powered-by');
if (PROD) app.set('trust proxy', 1); // needed behind a hosting proxy so secure cookies work

if (!process.env.SESSION_SECRET) {
    console.warn('Note: SESSION_SECRET is not set. A temporary one is used, so everyone is logged out when the server restarts.');
}

app.use(express.json({ limit: '50kb' }));

// Development only: let pages opened with VS Code Live Server (port 5500/5501) call this API.
// In production this block is off, so only your own site can use the API.
const DEV_ORIGINS = new Set([
    'http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:5501', 'http://127.0.0.1:5501'
]);
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!PROD && origin && DEV_ORIGINS.has(origin)) {
        res.set({
            'Access-Control-Allow-Origin': origin,        // one named origin, never "*", because we use cookies
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Vary': 'Origin'
        });
        if (req.method === 'OPTIONS') return res.sendStatus(204);
    }
    next();
});

app.use((req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'same-origin'
    });
    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
    next();
});

app.use(session({
    name: 'ga.sid',
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,      // JavaScript in the page cannot read the cookie
        sameSite: 'lax',     // the browser will not send it on cross-site POST requests (CSRF protection)
        secure: PROD,        // HTTPS only when deployed
        maxAge: 8 * 60 * 60 * 1000
    }
}));

// ------------------------------------------------------------------ helpers
class HttpError extends Error {
    constructor(status, message, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

const clean = (v, max) => String(v ?? '').trim().slice(0, max);

function toInt(v) {
    const s = String(v ?? '').trim();
    return /^\d{1,9}$/.test(s) ? parseInt(s, 10) : NaN;
}

function validatePassword(pw) {
    if (typeof pw !== 'string' || pw.length < 8 || pw.length > 72) return 'Password must be 8 to 72 characters.';
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password must include at least one letter and one number.';
    return null;
}

const regenerate = (req) => new Promise((resolve, reject) => req.session.regenerate((e) => (e ? reject(e) : resolve())));

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.session.user) return res.status(401).json({ error: 'Please log in to continue.' });
        if (roles.length && !roles.includes(req.session.user.role)) {
            return res.status(403).json({ error: 'Your account type cannot do this.' });
        }
        next();
    };
}

// Image upload: kept in memory, checked by its real file signature (not by its name), then saved with a random name.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });
function uploadPhoto(req, res, next) {
    upload.single('photo')(req, res, (err) => {
        if (!err) return next();
        const tooBig = err.code === 'LIMIT_FILE_SIZE';
        res.status(tooBig ? 413 : 400).json({ error: tooBig ? 'Photo must be under 2 MB.' : 'The photo could not be uploaded.', details: { photo: tooBig ? 'Photo must be under 2 MB.' : 'The photo could not be uploaded.' } });
    });
}

function sniffImage(buf) {
    if (!buf || buf.length < 12) return null;
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
    if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
    if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
    return null;
}

function saveImage(buf, ext) {
    const name = crypto.randomBytes(16).toString('hex') + '.' + ext;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
    return name;
}

function removeImage(name) {
    if (name && /^[a-f0-9]{32}\.(jpg|png|webp)$/.test(name)) {
        fs.promises.unlink(path.join(UPLOAD_DIR, name)).catch(() => {});
    }
}

const PRODUCE_SELECT = `
    SELECT p.id, p.name, p.description, p.price_kes, p.unit, p.quantity, p.photo, p.location, p.status,
           p.farmer_id, p.category_id, c.name AS category, u.full_name AS farmer_name
    FROM produce p
    JOIN categories c ON c.id = p.category_id
    JOIN users u ON u.id = p.farmer_id`;
const PRODUCE_COUNT = `
    SELECT COUNT(*) AS n
    FROM produce p
    JOIN categories c ON c.id = p.category_id
    JOIN users u ON u.id = p.farmer_id`;
const VISIBLE = `p.status = 'approved' AND u.is_approved = 1`; // buyers only ever see approved listings from approved farmers
const SORTS = {
    newest: 'p.created_at DESC, p.id DESC',
    price_asc: 'p.price_kes ASC, p.id ASC',
    price_desc: 'p.price_kes DESC, p.id ASC',
    name: 'p.name ASC'
};

// Turns [{id, qty}] from the browser into a Map(id -> qty), or throws a friendly error.
function parseCartItems(raw) {
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50) throw new HttpError(422, 'Your cart is empty or invalid.');
    const merged = new Map();
    for (const it of raw) {
        const id = toInt(it && it.id);
        const qty = toInt(it && (it.qty ?? it.quantity));
        if (Number.isNaN(id) || Number.isNaN(qty) || qty < 1 || qty > 9999) throw new HttpError(422, 'Your cart contains an invalid item.');
        merged.set(id, (merged.get(id) || 0) + qty);
    }
    return merged;
}

// ------------------------------------------------------------------ auth
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12); // so unknown emails take as long to check as real ones
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 8, skipSuccessfulRequests: true,
    standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many failed attempts. Try again in 15 minutes.' }
});
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many sign-ups from this connection. Try again later.' }
});
const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many messages. Please try again later.' }
});

app.post('/api/register', registerLimiter, async (req, res) => {
    const b = req.body || {};
    const role = b.role;
    const full_name = clean(b.full_name, 80);
    const email = clean(b.email, 120).toLowerCase();
    const phone = clean(b.phone, 20);
    const location = clean(b.location, 80);
    const password = typeof b.password === 'string' ? b.password : '';

    const details = {};
    if (!['buyer', 'farmer'].includes(role)) details.role = 'Choose Buyer or Farmer.';
    if (full_name.length < 2) details.full_name = 'Enter your full name.';
    if (!EMAIL_RE.test(email)) details.email = 'Enter a valid email address.';
    if (!PHONE_RE.test(phone)) details.phone = 'Enter a phone number with 9 to 15 digits, e.g. 0712 345 678.';
    if (role === 'farmer' && location.length < 2) details.location = 'Farmers must enter their town or county.';
    const pwProblem = validatePassword(password);
    if (pwProblem) details.password = pwProblem;
    if (Object.keys(details).length) throw new HttpError(422, 'Please fix the highlighted fields.', details);

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) throw new HttpError(409, 'An account with this email already exists. Log in instead.', { email: 'This email is already registered.' });

    const hash = await bcrypt.hash(password, 12);
    const approved = role === 'buyer' ? 1 : 0; // farmers wait for admin approval
    let result;
    try {
        [result] = await db.query(
            'INSERT INTO users (role, full_name, email, phone, password_hash, location, is_approved) VALUES (?,?,?,?,?,?,?)',
            [role, full_name, email, phone, hash, location || null, approved]
        );
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'An account with this email already exists. Log in instead.', { email: 'This email is already registered.' });
        throw err;
    }
    await regenerate(req);
    req.session.user = { id: result.insertId, role, full_name };
    res.status(201).json({ user: { id: result.insertId, role, full_name, is_approved: approved } });
});

app.post('/api/login', loginLimiter, async (req, res) => {
    const email = clean(req.body && req.body.email, 120).toLowerCase();
    const password = typeof (req.body && req.body.password) === 'string' ? req.body.password : '';
    const [rows] = await db.query('SELECT id, role, full_name, password_hash, is_approved FROM users WHERE email = ?', [email]);
    const u = rows[0];
    const ok = await bcrypt.compare(password, u ? u.password_hash : DUMMY_HASH);
    if (!u || !ok) throw new HttpError(401, 'Email or password is incorrect.'); // same message for both cases
    await regenerate(req); // new session id on login prevents session fixation
    req.session.user = { id: u.id, role: u.role, full_name: u.full_name };
    res.json({ user: { id: u.id, role: u.role, full_name: u.full_name, is_approved: u.is_approved } });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('ga.sid');
        res.json({ ok: true });
    });
});

// Used by the hosting platform and by you to check the server and database are alive
app.get('/api/health', async (req, res) => {
    await db.query('SELECT 1');
    res.json({ status: 'ok', environment: process.env.NODE_ENV || 'development', time: new Date().toISOString() });
});

app.get('/api/me', async (req, res) => {
    const sid = req.session.user && req.session.user.id;
    if (!sid) return res.json({ user: null });
    const [rows] = await db.query('SELECT id, full_name, email, phone, role, is_approved FROM users WHERE id = ?', [sid]);
    if (!rows.length) {
        return req.session.destroy(() => res.json({ user: null }));
    }
    res.json({ user: rows[0] });
});

// ------------------------------------------------------------------ public API
app.get('/api/categories', async (req, res) => {
    const [rows] = await db.query('SELECT id, name, slug FROM categories ORDER BY name');
    res.json({ categories: rows });
});

app.get('/api/locations', async (req, res) => {
    const [rows] = await db.query(
        `SELECT DISTINCT p.location FROM produce p JOIN users u ON u.id = p.farmer_id WHERE ${VISIBLE} ORDER BY p.location`
    );
    res.json({ locations: rows.map((r) => r.location) });
});

app.get('/api/produce', async (req, res) => {
    const where = [VISIBLE];
    const args = [];

    const q = clean(req.query.search ?? req.query.q, 60);
    if (q) {
        const like = '%' + q.replace(/[\\%_]/g, '\\$&') + '%'; // a typed % or _ is searched for literally
        where.push('(p.name LIKE ? OR p.description LIKE ?)');
        args.push(like, like);
    }
    const cat = clean(req.query.category, 50);
    if (cat) { where.push('(c.name = ? OR c.slug = ?)'); args.push(cat, cat); }
    const loc = clean(req.query.location, 80);
    if (loc) { where.push('p.location = ?'); args.push(loc); }
    const min = toInt(req.query.min_price);
    if (!Number.isNaN(min)) { where.push('p.price_kes >= ?'); args.push(min); }
    const max = toInt(req.query.max_price);
    if (!Number.isNaN(max)) { where.push('p.price_kes <= ?'); args.push(max); }
    if (req.query.in_stock === '1') where.push('p.quantity > 0');
    const farmer = toInt(req.query.farmer);
    if (!Number.isNaN(farmer)) { where.push('p.farmer_id = ?'); args.push(farmer); }

    const order = SORTS[req.query.sort] || SORTS.newest; // only values from our own list reach the SQL
    const per = Math.min(Math.max(toInt(req.query.per_page) || 12, 1), 48);
    const page = Math.max(toInt(req.query.page) || 1, 1);
    const whereSql = ' WHERE ' + where.join(' AND ');

    const [[{ n }]] = await db.query(PRODUCE_COUNT + whereSql, args);
    const [rows] = await db.query(
        PRODUCE_SELECT + whereSql + ' ORDER BY ' + order + ' LIMIT ? OFFSET ?',
        [...args, per, (page - 1) * per]
    );
    res.json({ items: rows, total: n, page, pages: Math.max(1, Math.ceil(n / per)) });
});

app.get('/api/produce/:id', async (req, res) => {
    const id = toInt(req.params.id);
    if (Number.isNaN(id)) throw new HttpError(404, 'Produce not found.');
    const [rows] = await db.query(PRODUCE_SELECT + ' WHERE p.id = ?', [id]);
    const p = rows[0];
    const viewer = req.session.user;
    const approvedAndVisible = p && p.status === 'approved';
    let farmerApproved = false;
    if (p) {
        const [f] = await db.query('SELECT is_approved FROM users WHERE id = ?', [p.farmer_id]);
        farmerApproved = f.length > 0 && f[0].is_approved === 1;
    }
    const canSee = p && ((approvedAndVisible && farmerApproved) || (viewer && (viewer.role === 'admin' || viewer.id === p.farmer_id)));
    if (!canSee) throw new HttpError(404, 'Produce not found.');
    res.json(p);
});

app.get('/api/farmers', async (req, res) => {
    const [rows] = await db.query(
        `SELECT u.id, u.full_name, u.location, u.bio,
                (SELECT COUNT(*) FROM produce p WHERE p.farmer_id = u.id AND p.status = 'approved') AS listings
         FROM users u WHERE u.role = 'farmer' AND u.is_approved = 1 ORDER BY u.full_name`
    ); // email and phone are deliberately not included: they are private
    res.json({ farmers: rows });
});

app.post('/api/contact', contactLimiter, async (req, res) => {
    const b = req.body || {};
    const name = clean(b.name, 80), email = clean(b.email, 120), message = clean(b.message, 2000);
    const details = {};
    if (name.length < 2) details.name = 'Enter your name.';
    if (!EMAIL_RE.test(email)) details.email = 'Enter a valid email address.';
    if (message.length < 10) details.message = 'Write at least 10 characters.';
    if (Object.keys(details).length) throw new HttpError(422, 'Please fix the highlighted fields.', details);
    await db.query('INSERT INTO contact_messages (name, email, message) VALUES (?,?,?)', [name, email, message]);
    res.status(201).json({ message: 'Message sent. We reply within two working days.' });
});

// ------------------------------------------------------------------ cart & orders (buyer)
// The browser's prices are never trusted: the cart is priced here from the database.
app.post('/api/cart/price', async (req, res) => {
    let items;
    try { items = parseCartItems(req.body && req.body.items); } catch { return res.json({ lines: [], unavailable: [], subtotal: 0 }); }
    const ids = [...items.keys()];
    const [rows] = await db.query(PRODUCE_SELECT + ` WHERE p.id IN (?) AND ${VISIBLE}`, [ids]);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const lines = [];
    const unavailable = [];
    let subtotal = 0;
    for (const [id, wanted] of items) {
        const r = byId.get(id);
        if (!r) { unavailable.push(id); continue; }
        const qty = Math.min(wanted, r.quantity);
        const line = {
            id: r.id, name: r.name, price_kes: r.price_kes, unit: r.unit, stock: r.quantity, photo: r.photo,
            farmer_name: r.farmer_name, qty, line_total: qty * r.price_kes, clamped: wanted > r.quantity
        };
        subtotal += line.line_total;
        lines.push(line);
    }
    res.json({ lines, unavailable, subtotal });
});

app.post('/api/orders', requireRole('buyer'), async (req, res) => {
    const b = req.body || {};
    const items = parseCartItems(b.items);
    const address = clean(b.delivery_address, 300);
    const phone = clean(b.phone, 20);
    const details = {};
    if (address.length < 5) details.delivery_address = 'Enter a delivery address (at least 5 characters).';
    if (!PHONE_RE.test(phone)) details.phone = 'Enter a phone number with 9 to 15 digits.';
    if (Object.keys(details).length) throw new HttpError(422, 'Please fix the highlighted fields.', details);

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction(); // all steps below succeed together, or none of them happen
        let total = 0;
        const lines = [];
        for (const id of [...items.keys()].sort((a, c) => a - c)) {
            const qty = items.get(id);
            const [rows] = await conn.query(PRODUCE_SELECT + ` WHERE p.id = ? AND ${VISIBLE}`, [id]);
            const p = rows[0];
            if (!p) throw new HttpError(409, 'An item in your cart is no longer available.');
            if (p.quantity < qty) throw new HttpError(409, `Only ${p.quantity} ${p.unit} of ${p.name} left.`);
            // Reduce stock only if there is still enough and the price has not changed since we read it.
            const [upd] = await conn.query(
                `UPDATE produce SET quantity = quantity - ? WHERE id = ? AND quantity >= ? AND price_kes = ? AND status = 'approved'`,
                [qty, id, qty, p.price_kes]
            );
            if (upd.affectedRows !== 1) throw new HttpError(409, `${p.name} just changed or sold out. Please review your cart.`);
            total += qty * p.price_kes;
            lines.push([p, qty]);
        }
        const [ord] = await conn.query(
            'INSERT INTO orders (buyer_id, delivery_address, phone, total_kes) VALUES (?,?,?,?)',
            [req.session.user.id, address, phone, total]
        );
        const rowsToInsert = lines.map(([p, qty]) => [ord.insertId, p.id, p.farmer_id, p.name, p.unit, p.price_kes, qty, qty * p.price_kes]);
        await conn.query(
            'INSERT INTO order_items (order_id, produce_id, farmer_id, produce_name, unit, unit_price, quantity, line_total) VALUES ?',
            [rowsToInsert]
        );
        await conn.commit();
        res.status(201).json({ order_id: ord.insertId, total_kes: total });
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
});

app.get('/api/orders', requireRole('buyer'), async (req, res) => {
    const [rows] = await db.query(
        'SELECT id, status, total_kes, created_at FROM orders WHERE buyer_id = ? ORDER BY created_at DESC, id DESC',
        [req.session.user.id]
    );
    res.json({ orders: rows });
});

app.get('/api/orders/:id', requireRole('buyer', 'admin'), async (req, res) => {
    const id = toInt(req.params.id);
    if (Number.isNaN(id)) throw new HttpError(404, 'Order not found.');
    const [rows] = await db.query(
        'SELECT o.*, b.full_name AS buyer_name FROM orders o JOIN users b ON b.id = o.buyer_id WHERE o.id = ?', [id]
    );
    const order = rows[0];
    // A buyer can only open their own orders. Others get "not found", not "forbidden", so order numbers are not revealed.
    if (!order || (req.session.user.role !== 'admin' && order.buyer_id !== req.session.user.id)) throw new HttpError(404, 'Order not found.');
    const [items] = await db.query('SELECT produce_name, unit, unit_price, quantity, line_total FROM order_items WHERE order_id = ? ORDER BY id', [id]);
    res.json({ order, items });
});

// ------------------------------------------------------------------ farmer
async function validateProduce(body) {
    const errors = {};
    const v = {};
    v.name = clean(body.name, 80);
    if (v.name.length < 2) errors.name = 'Enter the produce name (at least 2 characters).';
    v.description = clean(body.description, 1000);
    v.location = clean(body.location, 80);
    if (v.location.length < 2) errors.location = 'Enter where the produce is collected from.';
    v.unit = UNITS.includes(body.unit) ? body.unit : null;
    if (!v.unit) errors.unit = 'Choose a unit.';

    const cid = toInt(body.category_id);
    if (Number.isNaN(cid)) {
        errors.category_id = 'Choose a category.';
    } else {
        const [r] = await db.query('SELECT id FROM categories WHERE id = ?', [cid]);
        if (r.length) v.category_id = cid; else errors.category_id = 'Choose a category.';
    }
    const price = toInt(body.price_kes);
    if (Number.isNaN(price) || price < 1 || price > 1000000) errors.price_kes = 'Enter a whole-number price above 0.';
    else v.price_kes = price;
    const qty = toInt(body.quantity);
    if (Number.isNaN(qty) || qty > 1000000) errors.quantity = 'Enter a whole-number quantity (0 or more).';
    else v.quantity = qty;
    return { v, errors };
}

app.get('/api/farmer/produce', requireRole('farmer'), async (req, res) => {
    const [rows] = await db.query(PRODUCE_SELECT + ' WHERE p.farmer_id = ? ORDER BY p.created_at DESC, p.id DESC', [req.session.user.id]);
    res.json({ items: rows });
});

app.post('/api/farmer/produce', requireRole('farmer'), uploadPhoto, async (req, res) => {
    const [[me]] = await db.query('SELECT is_approved FROM users WHERE id = ?', [req.session.user.id]);
    if (!me || me.is_approved !== 1) throw new HttpError(403, 'Your farmer account must be approved before you can list produce.');

    const { v, errors } = await validateProduce(req.body || {});
    let ext = null;
    if (req.file) {
        ext = sniffImage(req.file.buffer);
        if (!ext) errors.photo = 'Photo must be a JPG, PNG or WebP image.';
    }
    if (Object.keys(errors).length) throw new HttpError(422, 'Please fix the highlighted fields.', errors);

    const photo = ext ? saveImage(req.file.buffer, ext) : null;
    const [r] = await db.query(
        `INSERT INTO produce (farmer_id, category_id, name, description, price_kes, unit, quantity, photo, location)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [req.session.user.id, v.category_id, v.name, v.description, v.price_kes, v.unit, v.quantity, photo, v.location]
    );
    res.status(201).json({ id: r.insertId, message: 'Listing submitted. It goes live after admin approval.' });
});

app.put('/api/farmer/produce/:id', requireRole('farmer'), uploadPhoto, async (req, res) => {
    const id = toInt(req.params.id);
    const [rows] = Number.isNaN(id) ? [[]] : await db.query('SELECT id, photo, status FROM produce WHERE id = ? AND farmer_id = ?', [id, req.session.user.id]);
    const current = rows[0];
    if (!current) throw new HttpError(404, 'Listing not found.'); // also hides other farmers' listings

    const { v, errors } = await validateProduce(req.body || {});
    let ext = null;
    if (req.file) {
        ext = sniffImage(req.file.buffer);
        if (!ext) errors.photo = 'Photo must be a JPG, PNG or WebP image.';
    }
    if (Object.keys(errors).length) throw new HttpError(422, 'Please fix the highlighted fields.', errors);

    const newPhoto = ext ? saveImage(req.file.buffer, ext) : null;
    const status = current.status === 'rejected' ? 'pending' : current.status; // a rejected listing is resubmitted for review
    await db.query(
        `UPDATE produce SET category_id = ?, name = ?, description = ?, price_kes = ?, unit = ?, quantity = ?,
                photo = COALESCE(?, photo), location = ?, status = ?
         WHERE id = ? AND farmer_id = ?`,
        [v.category_id, v.name, v.description, v.price_kes, v.unit, v.quantity, newPhoto, v.location, status, id, req.session.user.id]
    );
    if (newPhoto) removeImage(current.photo);
    res.json({ message: status === 'pending' && current.status === 'rejected' ? 'Listing updated and resubmitted for approval.' : 'Listing updated.' });
});

app.delete('/api/farmer/produce/:id', requireRole('farmer'), async (req, res) => {
    const id = toInt(req.params.id);
    const [rows] = Number.isNaN(id) ? [[]] : await db.query('SELECT photo FROM produce WHERE id = ? AND farmer_id = ?', [id, req.session.user.id]);
    if (!rows.length) throw new HttpError(404, 'Listing not found.');
    await db.query('DELETE FROM produce WHERE id = ? AND farmer_id = ?', [id, req.session.user.id]);
    removeImage(rows[0].photo);
    res.json({ message: 'Listing removed.' });
});

app.get('/api/farmer/orders', requireRole('farmer'), async (req, res) => {
    const [rows] = await db.query(
        `SELECT oi.order_id, oi.produce_name, oi.unit, oi.quantity, oi.line_total,
                o.status, o.created_at, o.delivery_address, b.full_name AS buyer_name, o.phone AS buyer_phone
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         JOIN users b ON b.id = o.buyer_id
         WHERE oi.farmer_id = ? ORDER BY o.created_at DESC, oi.id DESC LIMIT 50`,
        [req.session.user.id]
    );
    res.json({ items: rows });
});

// ------------------------------------------------------------------ admin
app.get('/api/admin/stats', requireRole('admin'), async (req, res) => {
    const [[s]] = await db.query(
        `SELECT
            (SELECT COUNT(*) FROM users WHERE role = 'farmer' AND is_approved = 1) AS farmers,
            (SELECT COUNT(*) FROM users WHERE role = 'buyer') AS buyers,
            (SELECT COUNT(*) FROM produce WHERE status = 'approved') AS listings,
            (SELECT COUNT(*) FROM orders) AS orders,
            (SELECT COALESCE(SUM(total_kes), 0) FROM orders) AS order_value`
    );
    res.json(s);
});

// (these two routes keep the names from your original server.js)
app.get('/api/admin/pending-farmers', requireRole('admin'), async (req, res) => {
    const [rows] = await db.query(
        "SELECT id, full_name, email, location, phone, created_at FROM users WHERE role = 'farmer' AND is_approved = 0 ORDER BY created_at"
    );
    res.json(rows);
});

async function decideFarmer(req, res, value, word) {
    const id = toInt(req.params.id);
    const [r] = Number.isNaN(id) ? [{ affectedRows: 0 }] : await db.query("UPDATE users SET is_approved = ? WHERE id = ? AND role = 'farmer'", [value, id]);
    if (!r.affectedRows) throw new HttpError(404, 'Farmer not found.');
    res.json({ message: `Farmer ${word} successfully!` });
}
app.put('/api/admin/approve-farmer/:id', requireRole('admin'), (req, res) => decideFarmer(req, res, 1, 'approved'));
app.put('/api/admin/reject-farmer/:id', requireRole('admin'), (req, res) => decideFarmer(req, res, 2, 'rejected'));

app.get('/api/admin/pending-produce', requireRole('admin'), async (req, res) => {
    const [rows] = await db.query(PRODUCE_SELECT + " WHERE p.status = 'pending' ORDER BY p.created_at");
    res.json({ items: rows });
});

async function decideProduce(req, res, status, word) {
    const id = toInt(req.params.id);
    const [r] = Number.isNaN(id) ? [{ affectedRows: 0 }] : await db.query('UPDATE produce SET status = ? WHERE id = ?', [status, id]);
    if (!r.affectedRows) throw new HttpError(404, 'Listing not found.');
    res.json({ message: `Listing ${word}.` });
}
app.put('/api/admin/produce/:id/approve', requireRole('admin'), (req, res) => decideProduce(req, res, 'approved', 'approved'));
app.put('/api/admin/produce/:id/reject', requireRole('admin'), (req, res) => decideProduce(req, res, 'rejected', 'rejected'));

app.get('/api/admin/orders', requireRole('admin'), async (req, res) => {
    const args = [];
    let sql = 'SELECT o.id, o.status, o.total_kes, o.created_at, b.full_name AS buyer_name FROM orders o JOIN users b ON b.id = o.buyer_id';
    if (ORDER_FLOW.includes(req.query.status)) { sql += ' WHERE o.status = ?'; args.push(req.query.status); }
    sql += ' ORDER BY o.created_at DESC, o.id DESC LIMIT 200';
    const [rows] = await db.query(sql, args);
    res.json({ orders: rows });
});

// Moves an order one step: placed -> confirmed -> dispatched -> delivered (never backwards, never skipping).
app.put('/api/admin/orders/:id/advance', requireRole('admin'), async (req, res) => {
    const id = toInt(req.params.id);
    const [rows] = Number.isNaN(id) ? [[]] : await db.query('SELECT id, status FROM orders WHERE id = ?', [id]);
    const o = rows[0];
    if (!o) throw new HttpError(404, 'Order not found.');
    const i = ORDER_FLOW.indexOf(o.status);
    if (i === ORDER_FLOW.length - 1) throw new HttpError(409, 'This order is already delivered.');
    const next = ORDER_FLOW[i + 1];
    // "AND status = ?" means two admins clicking at once cannot skip a step
    const [r] = await db.query('UPDATE orders SET status = ? WHERE id = ? AND status = ?', [next, id, o.status]);
    if (!r.affectedRows) throw new HttpError(409, 'Someone else just updated this order. Refresh and try again.');
    res.json({ status: next });
});

// ------------------------------------------------------------------ static files, errors, start
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use(express.static(PUBLIC_DIR));

app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details || {} });
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'That request could not be read.' });
    if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'That request is too large.' });
    console.error(err); // the real error stays in your terminal; the browser only gets a generic message
    res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

(async () => {
    try {
        await db.query('SELECT 1');
    } catch (err) {
        console.error('Cannot connect to MySQL: ' + err.message);
        console.error('Check that MySQL is running (XAMPP) and that the database "green_agribusiness" exists (run schema.sql).');
        process.exit(1);
    }
    console.log('Database connected (' + (process.env.DB_HOST || 'localhost') + ')');
    console.log('Environment: ' + (process.env.NODE_ENV || 'development'));
    app.listen(PORT, () => console.log('Server running on http://localhost:' + PORT));
})();
