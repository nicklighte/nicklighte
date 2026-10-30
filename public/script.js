/* ==========================================================================
   Green Agribusiness: shared script, loaded on every page.
   Gives each page: api(), esc(), kes(), Cart, getMe(), requireRole(), toast(),
   form-error helpers, and builds the header + footer.
   ========================================================================== */

/* ---------- where the API lives ---------- */
// Normal case: the page came from the Node server (http://localhost:3000), so "/api" is enough.
// Live Server case: the page came from another port (e.g. 5500), so we call the Node server on port 3000
// of the same host name. Keeping the same host name (localhost or 127.0.0.1) keeps the login cookie working.
const API_ORIGIN = (location.port === '3000' || location.port === '') ? '' : `${location.protocol === 'https:' ? 'https:' : 'http:'}//${location.hostname || 'localhost'}:3000`;

/* ---------- talking to the back end ---------- */
class ApiError extends Error {
    constructor(message, status, details) {
        super(message);
        this.status = status;
        this.details = details || {};
    }
}

async function api(path, options = {}) {
    const opts = { credentials: 'include', ...options, headers: { ...(options.headers || {}) } };
    if (opts.body && !(opts.body instanceof FormData)) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(opts.body);
    }
    let res;
    try {
        res = await fetch(API_ORIGIN + '/api' + path, opts);
    } catch (e) {
        throw new ApiError('Cannot reach the server. Start it with "npm start" and open the site at http://localhost:3000.', 0);
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty or non-JSON body */ }
    if (!res.ok) throw new ApiError((data && data.error) || 'Something went wrong. Please try again.', res.status, data && data.details);
    return data;
}

/* ---------- small helpers ---------- */
// Always escape text from the database before putting it into HTML (stops script injection / XSS).
function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function kes(n) {
    return 'KES ' + Number(n || 0).toLocaleString('en-KE');
}

function orderNo(id) {
    return '#' + String(id).padStart(5, '0');
}

function dateOnly(s) {
    return String(s || '').slice(0, 10);
}

function cap(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function badge(status) {
    return `<span class="badge badge-${esc(status)}">${esc(cap(status))}</span>`;
}

function photoHtml(p, cls) {
    return p.photo
        ? `<img class="${cls || 'thumb'}" src="${API_ORIGIN}/uploads/${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy">`
        : `<div class="${cls ? cls + '-empty' : 'thumb-empty'}" role="img" aria-label="No photo for ${esc(p.name)}">No photo</div>`;
}

let toastTimer;
function toast(message, type) {
    let el = document.getElementById('toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'toast';
        el.setAttribute('role', 'status');
        document.body.appendChild(el);
    }
    el.className = 'toast' + (type === 'error' ? ' error' : '');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

/* ---------- form error display ---------- */
function clearFormErrors(form) {
    form.querySelectorAll('.has-error').forEach((f) => f.classList.remove('has-error'));
    form.querySelectorAll('.error-text').forEach((e) => e.remove());
    const banner = form.querySelector('.form-banner');
    if (banner) banner.remove();
}

// details = { fieldName: 'message' } from the server, or built by the browser's own checks
function showFormErrors(form, message, details) {
    clearFormErrors(form);
    let first = null;
    Object.entries(details || {}).forEach(([name, text]) => {
        const input = form.querySelector(`[name="${name}"]`);
        const field = input && input.closest('.field');
        if (!field) return;
        field.classList.add('has-error');
        const p = document.createElement('p');
        p.className = 'error-text';
        p.textContent = text;
        field.appendChild(p);
        if (!first) first = input;
    });
    if (message) {
        const div = document.createElement('div');
        div.className = 'alert alert-error form-banner';
        div.setAttribute('role', 'alert');
        div.textContent = message;
        form.prepend(div);
    }
    if (first) first.focus();
}

/* ---------- the cart (kept in the browser; prices always come from the server) ---------- */
const Cart = {
    KEY: 'greenCart',
    get() {
        try {
            const raw = JSON.parse(localStorage.getItem(this.KEY) || '[]');
            if (!Array.isArray(raw)) return [];
            return raw
                .map((i) => ({ id: parseInt(i.id, 10), quantity: Math.min(parseInt(i.quantity, 10) || 0, 9999) }))
                .filter((i) => i.id > 0 && i.quantity > 0);
        } catch (e) {
            return [];
        }
    },
    save(items) {
        try { localStorage.setItem(this.KEY, JSON.stringify(items)); } catch (e) { /* storage blocked: cart will not persist */ }
        updateCartBadge();
    },
    add(id, qty) {
        const items = this.get();
        const found = items.find((i) => i.id === id);
        if (found) found.quantity = Math.min(found.quantity + qty, 9999);
        else items.push({ id, quantity: qty });
        this.save(items);
    },
    setQty(id, qty) {
        const items = this.get().map((i) => (i.id === id ? { id, quantity: Math.max(1, Math.min(qty, 9999)) } : i));
        this.save(items);
    },
    remove(id) {
        this.save(this.get().filter((i) => i.id !== id));
    },
    clear() {
        this.save([]);
    },
    count() {
        return this.get().reduce((sum, i) => sum + i.quantity, 0);
    }
};

function updateCartBadge() {
    document.querySelectorAll('.btn-cart').forEach((el) => { el.textContent = `Cart (${Cart.count()})`; });
}

/* ---------- who is logged in ---------- */
let mePromise = null;
function getMe(force) {
    if (!mePromise || force) mePromise = api('/me').then((d) => d.user).catch(() => null);
    return mePromise;
}

// Use at the top of a protected page. Redirects to login, or shows a message for the wrong account type.
async function requireRole(...roles) {
    const me = await getMe();
    if (!me) {
        const next = location.pathname.split('/').pop() + location.search;   // just the file name, e.g. cart.html
        location.href = 'login.html?next=' + encodeURIComponent(next);
        return null;
    }
    if (roles.length && !roles.includes(me.role)) {
        const main = document.querySelector('main');
        main.innerHTML = '<div class="alert alert-error">Your account type cannot open this page.</div>';
        return null;
    }
    return me;
}

// Only allow redirecting to our own pages, e.g. "cart.html" (blocks open-redirect tricks via ?next=)
function safeNext(value) {
    return /^[a-z0-9-]+\.html(\?[A-Za-z0-9=&%_.-]*)?$/.test(value || '') ? value : null;
}

/* ---------- header and footer ---------- */
async function renderChrome() {
    const header = document.getElementById('site-header');
    const footer = document.getElementById('site-footer');
    const page = document.body.dataset.page || '';
    const link = (href, label, key) => `<a href="${href}"${page === key ? ' class="active" aria-current="page"' : ''}>${label}</a>`;

    if (footer) {
        footer.innerHTML = '<p>&copy; Green Agribusiness &nbsp;&middot;&nbsp; <a href="about.html">About us</a> &nbsp;&middot;&nbsp; <a href="contact.html">Contact us</a></p>';
    }
    if (!header) return;

    const me = await getMe();
    let html = link('index.html', 'Home', 'home') + link('catalogue.html', 'Catalogue', 'catalogue') +
        link('farmers.html', 'Farmers', 'farmers') + link('about.html', 'About us', 'about') + link('contact.html', 'Contact us', 'contact');

    if (!me) {
        html += `<a href="login.html" class="btn-login-nav">Log in</a><a href="register.html" class="btn-register">Register</a>`;
    } else {
        if (me.role === 'farmer') html += link('farmer.html', 'My listings', 'farmer');
        if (me.role === 'buyer') html += link('orders.html', 'My orders', 'orders');
        if (me.role === 'admin') html += link('admin.html', 'Admin', 'admin');
        html += `<span class="nav-user">Hi, ${esc(me.full_name.split(' ')[0])}</span><button type="button" class="linklike" id="logoutBtn">Log out</button>`;
    }
    if (!me || me.role === 'buyer') html += `<a href="cart.html" class="btn-cart">Cart (0)</a>`;

    header.innerHTML = `<a class="logo" href="index.html">🌱 Green Agribusiness</a>
        <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="main-nav">Menu</button>
        <nav class="nav-links" id="main-nav" aria-label="Main">${html}</nav>`;

    const toggle = header.querySelector('.nav-toggle');
    toggle.addEventListener('click', () => {
        const open = header.querySelector('.nav-links').classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
    });
    const logout = document.getElementById('logoutBtn');
    if (logout) {
        logout.addEventListener('click', async () => {
            try { await api('/logout', { method: 'POST' }); } catch (e) { /* already logged out */ }
            location.href = 'index.html';
        });
    }
    updateCartBadge();
}

document.addEventListener('DOMContentLoaded', renderChrome);
