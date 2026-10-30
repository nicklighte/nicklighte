/**
 * Loads demo data so you can try the site straight away.   Run:  npm run seed
 * Safe to run more than once. For DEVELOPMENT only: it uses well-known demo passwords.
 * Before a real launch, delete the demo accounts and change the admin password.
 */
const bcrypt = require('bcryptjs');
const db = require('./db');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin12345';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo12345';

const CATEGORIES = [
    ['Vegetables', 'vegetables'], ['Fruits', 'fruits'], ['Grains', 'grains'],
    ['Dairy & eggs', 'dairy-eggs'], ['Herbs', 'herbs'], ['Tubers', 'tubers']
];

// role, name, email, phone, location, bio, is_approved, password
const USERS = [
    ['admin', 'Site Administrator', 'admin@greenagribusiness.test', '0700000001', 'Ruiru', null, 1, ADMIN_PASSWORD],
    ['farmer', 'Grace Wanjiru', 'grace@greenagribusiness.test', '0712345678', 'Kiambu', 'Specializes in fresh vegetables, tomatoes, and leafy greens.', 1, DEMO_PASSWORD],
    ['farmer', 'Peter Ouma', 'peter@greenagribusiness.test', '0723456789', 'Kisumu', 'Specializes in high-quality cereals and white maize.', 1, DEMO_PASSWORD],
    ['farmer', 'Amina Hassan', 'amina@greenagribusiness.test', '0734567890', 'Meru', 'Specializes in organic fruits and fresh dairy produce.', 1, DEMO_PASSWORD],
    ['farmer', 'Joseph Kiprop', 'joseph@greenagribusiness.test', '0745678901', 'Nakuru', 'Potatoes, carrots and onions from Rift Valley soil.', 1, DEMO_PASSWORD],
    ['farmer', 'Mary Achieng', 'mary@greenagribusiness.test', '0756789012', 'Kakamega', 'New to the platform: sweet potatoes and arrowroot.', 0, DEMO_PASSWORD],
    ['buyer', 'Sunrise Primary School', 'buyer@greenagribusiness.test', '0767890123', 'Nairobi', null, 1, DEMO_PASSWORD]
];

// farmer email, category, name, description, price, unit, quantity, location, status, photo (file in public/uploads)
const PRODUCE = [
    ['grace@greenagribusiness.test', 'Vegetables', 'Tomatoes', 'Firm, red Roma tomatoes. Good for sauces and salads.', 80, 'kg', 120, 'Kiambu', 'approved', 'seed-tomatoes.svg'],
    ['grace@greenagribusiness.test', 'Vegetables', 'Kale', 'Tender kale (sukuma wiki), bunched and washed.', 20, 'bunch', 300, 'Kiambu', 'approved', 'seed-kale.svg'],
    ['grace@greenagribusiness.test', 'Vegetables', 'Spinach', 'Dark green spinach, cut this morning.', 25, 'bunch', 150, 'Kiambu', 'approved', 'seed-spinach.svg'],
    ['peter@greenagribusiness.test', 'Grains', 'White maize', 'Dry, sorted white maize.', 55, 'kg', 2000, 'Kisumu', 'approved', 'seed-white-maize.svg'],
    ['peter@greenagribusiness.test', 'Grains', 'Sorghum', 'Red sorghum for ugali and porridge.', 70, 'kg', 600, 'Kisumu', 'approved', 'seed-sorghum.svg'],
    ['amina@greenagribusiness.test', 'Dairy & eggs', 'Fresh milk', 'Chilled milk, collected daily.', 60, 'litre', 200, 'Meru', 'approved', 'seed-fresh-milk.svg'],
    ['amina@greenagribusiness.test', 'Dairy & eggs', 'Free-range eggs', 'Tray of 30 eggs.', 450, 'tray', 40, 'Meru', 'approved', 'seed-free-range-eggs.svg'],
    ['amina@greenagribusiness.test', 'Fruits', 'Bananas', 'Sweet cooking and eating bananas.', 40, 'kg', 250, 'Meru', 'approved', 'seed-bananas.svg'],
    ['joseph@greenagribusiness.test', 'Tubers', 'Irish potatoes', 'Washed potatoes, graded.', 45, 'kg', 900, 'Nakuru', 'approved', 'seed-irish-potatoes.svg'],
    ['joseph@greenagribusiness.test', 'Vegetables', 'Carrots', 'Crisp carrots, tops removed.', 60, 'kg', 300, 'Nakuru', 'approved', 'seed-carrots.svg'],
    ['joseph@greenagribusiness.test', 'Vegetables', 'Red onions', 'Dry red onions, cured.', 90, 'kg', 400, 'Nakuru', 'approved', 'seed-red-onions.svg'],
    ['joseph@greenagribusiness.test', 'Herbs', 'Coriander', 'Fresh dhania by the bunch (waiting for admin approval).', 15, 'bunch', 200, 'Nakuru', 'pending', null]
];

(async () => {
    try {
        for (const [name, slug] of CATEGORIES) {
            await db.query('INSERT IGNORE INTO categories (name, slug) VALUES (?, ?)', [name, slug]);
        }
        for (const [role, name, email, phone, location, bio, approved, pw] of USERS) {
            const [exists] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
            if (exists.length) continue;
            const hash = await bcrypt.hash(pw, 12);
            await db.query(
                'INSERT INTO users (role, full_name, email, phone, password_hash, location, bio, is_approved) VALUES (?,?,?,?,?,?,?,?)',
                [role, name, email, phone, hash, location, bio, approved]
            );
        }
        for (const [femail, cat, name, desc, price, unit, qty, loc, status, photo] of PRODUCE) {
            const [[farmer]] = await db.query('SELECT id FROM users WHERE email = ?', [femail]);
            const [[category]] = await db.query('SELECT id FROM categories WHERE name = ?', [cat]);
            const [dupe] = await db.query('SELECT id FROM produce WHERE farmer_id = ? AND name = ?', [farmer.id, name]);
            if (dupe.length) {
                // already seeded earlier: just add the picture if it has none yet
                await db.query('UPDATE produce SET photo = ? WHERE id = ? AND photo IS NULL', [photo, dupe[0].id]);
                continue;
            }
            await db.query(
                `INSERT INTO produce (farmer_id, category_id, name, description, price_kes, unit, quantity, location, status, photo)
                 VALUES (?,?,?,?,?,?,?,?,?,?)`,
                [farmer.id, category.id, name, desc, price, unit, qty, loc, status, photo]
            );
        }
        console.log('Demo data loaded.\n');
        console.log('Log in with:');
        console.log('  Admin   admin@greenagribusiness.test   /  ' + ADMIN_PASSWORD);
        console.log('  Farmer  grace@greenagribusiness.test   /  ' + DEMO_PASSWORD);
        console.log('  Buyer   buyer@greenagribusiness.test   /  ' + DEMO_PASSWORD);
    } catch (err) {
        console.error('Seeding failed: ' + err.message);
        console.error('Did you run schema.sql first?');
        process.exitCode = 1;
    } finally {
        await db.end();
    }
})();
