# Green Agribusiness

A web application that connects smallholder farmers directly with buyers (households, hotels, schools and exporters). Farmers list produce, buyers search and order it online, and an administrator approves farmers and listings and moves each order through delivery.

## Features

**Public**
- Home, About Us, Produce Catalogue, Product Detail, Farmer Profiles and Contact Us pages
- Catalogue search and filters: keyword, category, location, price range, in-stock only, sorting, paging

**Buyer**
- Registration and login
- Shopping cart (kept in the browser, re-priced by the server)
- Checkout with delivery address and phone
- Order history, order status tracking and a printable receipt (save as PDF from the print dialog)

**Farmer**
- Registration, followed by administrator approval
- Add, edit and remove produce listings with name, category, price, quantity, location and photo
- View orders that include their produce

**Administrator**
- Approve or reject farmer accounts
- Approve or reject produce listings
- View all orders, filter by status and advance them: Placed → Confirmed → Dispatched → Delivered

## Technology

| Layer | Technology |
|---|---|
| Front end | HTML, CSS, JavaScript (no framework) |
| Back end | Node.js, Express 5 |
| Database | MySQL / MariaDB (`mysql2`) |
| Authentication | `express-session`, `bcryptjs` |
| File upload | `multer` |
| Rate limiting | `express-rate-limit` |

## Project structure

```
green-agribusiness/
├─ server.js        Express application and all API routes
├─ db.js            MySQL connection pool
├─ dbconfig.js      Database settings read from environment variables
├─ schema.sql       Database tables (local XAMPP)
├─ schema-cloud.sql Same tables for a cloud database
├─ setup-db.js      Creates the tables in a cloud database (npm run setup-db)
├─ seed.js          Demo data (npm run seed)
├─ package.json
├─ tools/
│  └─ make_images.py   Generates the illustrations in public/
└─ public/          Served to the browser
   ├─ style.css, script.js
   ├─ index.html, catalogue.html, product-details.html, farmers.html, about.html, contact.html
   ├─ login.html, register.html, cart.html, orders.html, order.html
   ├─ farmer.html   Farmer dashboard
   ├─ admin.html    Administrator dashboard
   ├─ images/       Hero image and site icon
   └─ uploads/      Produce pictures (demo illustrations and farmer uploads)
```

## Getting started

### Requirements
- Node.js 18 or later
- MySQL or MariaDB (for example through XAMPP)

### 1. Create the database
Start MySQL, then import `schema.sql` (phpMyAdmin → Import, or `mysql -u root < schema.sql`). This creates the `green_agribusiness` database and its tables.

### 2. Install and load demo data
```
npm install
npm run seed
```

### 3. Run
```
npm start
```
Open **http://localhost:3000**.

The pages must be loaded from the Node server so that login and the API work. For development they can also be opened with the VS Code Live Server extension (ports 5500 and 5501) while `npm start` is running; the server allows those origins outside production.

## Configuration

Settings are read from environment variables. Every one has a development default, so none is required locally. `.env.example` lists them.

| Variable | Default | Purpose |
|---|---|---|
| `DB_HOST` | `localhost` | Database host |
| `DB_PORT` | `3306` | Database port (cloud databases often use another port) |
| `DB_USER` | `root` | Database user |
| `DB_PASSWORD` | empty | Database password |
| `DB_NAME` | `green_agribusiness` | Database name |
| `DB_SSL` | unset | `true` encrypts the database connection (needed by most cloud databases) |
| `DB_SSL_CA` | unset | Optional CA certificate text (newlines written as `\n`) so the server's identity is also verified |
| `PORT` | `3000` | Server port |
| `SESSION_SECRET` | random per start | Signs the session cookie. Set it in production, otherwise users are logged out on every restart |
| `NODE_ENV` | unset | `production` enables secure cookies and disables the Live Server allowance |
| `ADMIN_PASSWORD`, `DEMO_PASSWORD` | see seed.js | Passwords used by `npm run seed` |

## Accounts

`npm run seed` creates demo accounts for development only.

| Role | Email | Password |
|---|---|---|
| Administrator | admin@greenagribusiness.test | Admin12345 |
| Farmer | grace@greenagribusiness.test | Demo12345 |
| Buyer | buyer@greenagribusiness.test | Demo12345 |

Passwords are stored as bcrypt hashes. To use a different administrator password, delete the administrator row from `users`, set `ADMIN_PASSWORD` in the terminal, and run `npm run seed` again. Remove the demo accounts before any real use.

## Order lifecycle

`Placed → Confirmed → Dispatched → Delivered`

Only an administrator can advance an order, one step at a time and never backwards. The update is guarded with `WHERE status = <current status>`, so two simultaneous clicks cannot skip a step.

## API

All routes are under `/api`. Responses are JSON. Errors have the form `{ "error": "message", "details": { "field": "message" } }`.

| Method and path | Access | Purpose |
|---|---|---|
| `POST /register`, `POST /login`, `POST /logout`, `GET /me` | public | Accounts and session |
| `GET /categories`, `GET /locations` | public | Filter options |
| `GET /produce`, `GET /produce/:id` | public | Search and detail (approved listings only) |
| `GET /farmers` | public | Approved farmer profiles |
| `POST /contact` | public | Contact form |
| `POST /cart/price` | public | Prices the cart from the database |
| `POST /orders`, `GET /orders`, `GET /orders/:id` | buyer (detail also admin) | Place and view orders |
| `GET/POST /farmer/produce`, `PUT/DELETE /farmer/produce/:id`, `GET /farmer/orders` | farmer | Manage own listings and see orders |
| `GET /admin/stats`, `GET /admin/pending-farmers`, `GET /admin/pending-produce`, `GET /admin/orders` | admin | Dashboard data |
| `PUT /admin/approve-farmer/:id`, `PUT /admin/reject-farmer/:id` | admin | Farmer decisions |
| `PUT /admin/produce/:id/approve`, `PUT /admin/produce/:id/reject` | admin | Listing decisions |
| `PUT /admin/orders/:id/advance` | admin | Next order status |

`GET /produce` accepts `search`, `category`, `location`, `min_price`, `max_price`, `in_stock`, `farmer`, `sort` (`newest`, `price_asc`, `price_desc`, `name`), `page` and `per_page`.

## Database

Tables: `users`, `categories`, `produce`, `orders`, `order_items`, and `contact_messages`.

- `users.role` is `farmer`, `buyer` or `admin`; `users.is_approved` is `0` pending, `1` approved, `2` rejected.
- `order_items` copies the produce name, unit and price at order time, so receipts do not change if a listing is later edited or deleted.
- Foreign keys: deleting a farmer removes their listings; deleting a listing sets `order_items.produce_id` to `NULL`.

## Deployment

The application is deployed as a Node.js web service connected to a GitHub repository, with a managed MySQL database.

| Part | Choice |
|---|---|
| Web service | Render (free web service, automatic HTTPS, deploys on every push to GitHub) |
| Database | Aiven for MySQL (free plan) |

**Render settings**

| Setting | Value |
|---|---|
| Runtime | Node |
| Build command | `npm install` |
| Start command | `npm start` |
| Health check path | `/api/health` |

**Environment variables (set in the Render dashboard, never in Git)**

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | a long random string |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | from the Aiven service page |
| `DB_SSL` | `true` |

**First-time database setup (run once from a computer with the same variables set)**

```
npm run setup-db
npm run seed
```

`setup-db` creates the tables from `schema-cloud.sql`. `seed` loads the categories and demo accounts; set `ADMIN_PASSWORD` and `DEMO_PASSWORD` to strong values first, because the site is public.

**Checks after each deploy:** open `/api/health` (it returns `{"status":"ok"}` when the server and database are working), then the home page, registration, login, the catalogue and an order.

**Free tier behaviour**
- A free web service goes to sleep after 15 minutes without traffic, and the next request takes up to about a minute.
- The file system is temporary: photos uploaded by farmers are lost when the service restarts or redeploys. The demo pictures are part of the repository and are not affected. A production system would store uploads in object storage.
- Sessions are kept in memory, so users must log in again after a restart.

## Security

| Risk | Measure |
|---|---|
| SQL injection | All queries use bound parameters; sort order is chosen from a fixed list |
| Weak authentication | bcrypt (cost 12), password rules, login rate limiting, identical error for unknown email and wrong password, new session id on login |
| Broken access control | Role checks on every protected route; farmers can only change their own listings; buyers can only open their own orders |
| Cross-site scripting | Database text is escaped before it is inserted into a page |
| Cross-site request forgery | Session cookie is `HttpOnly` and `SameSite=Lax`; the API only accepts JSON or multipart bodies |
| Price and stock tampering | The cart is re-priced on the server; stock is checked and reduced inside a transaction |
| File upload | 2 MB limit, JPG/PNG/WebP detected from the file signature, saved under a random name |
| Information leakage | Generic 500 message to the browser, details logged on the server; farmer email and phone are not public |

For deployment: set `SESSION_SECRET`, set `NODE_ENV=production`, serve over HTTPS, use a database user other than `root`, and remove the demo accounts.

## Images

The Home page picture, the site icon and the demo produce pictures are vector illustrations created for the project (`tools/make_images.py`). Farmers can upload JPG, PNG or WebP photos, which replace the illustration for that product.

## Known limitations

- No online payment; receipts state payment on delivery.
- Sessions are held in memory, so they end when the server restarts.
- No password reset or email notifications.
- Order status is managed by the administrator only.
