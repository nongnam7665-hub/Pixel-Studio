const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');

const HOST = process.env.PORT ? '0.0.0.0' : '127.0.0.1'; // 0.0.0.0 สำหรับ Render, 127.0.0.1 สำหรับ local
const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.join(__dirname, '..'); // project root (one level above SRC/)
const DB_PATH = path.join(__dirname, 'database.db'); // database stays in SRC/

const CONTENT_TYPES = {
  '.css':  'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.pdf':  'application/pdf',
};

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    password TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  INSERT OR IGNORE INTO admins (username, email, password)
  VALUES ('à¸œà¸¹à¹‰à¸”à¸¹à¹à¸¥à¸£à¸°à¸šà¸š', 'admin@studio.com', 'admin1234');
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    capacity INTEGER DEFAULT 4,
    status TEXT NOT NULL DEFAULT 'available'
  );
  INSERT OR IGNORE INTO rooms (id, name, description, capacity) VALUES
    ('A', 'à¸«à¹‰à¸­à¸‡ A', 'à¸ªà¸•à¸¹à¸”à¸´à¹‚à¸­à¸‚à¸™à¸²à¸”à¹€à¸¥à¹‡à¸ à¹€à¸«à¸¡à¸²à¸°à¸ªà¸³à¸«à¸£à¸±à¸šà¸–à¹ˆà¸²à¸¢à¸ à¸²à¸žà¹€à¸”à¸µà¹ˆà¸¢à¸§à¸«à¸£à¸·à¸­à¸„à¸¹à¹ˆ', 2),
    ('B', 'à¸«à¹‰à¸­à¸‡ B', 'à¸ªà¸•à¸¹à¸”à¸´à¹‚à¸­à¸‚à¸™à¸²à¸”à¸à¸¥à¸²à¸‡ à¹€à¸«à¸¡à¸²à¸°à¸ªà¸³à¸«à¸£à¸±à¸šà¸à¸¥à¸¸à¹ˆà¸¡à¹€à¸¥à¹‡à¸', 4),
    ('C', 'à¸«à¹‰à¸­à¸‡ C', 'à¸ªà¸•à¸¹à¸”à¸´à¹‚à¸­à¸‚à¸™à¸²à¸”à¹ƒà¸«à¸à¹ˆ à¹€à¸«à¸¡à¸²à¸°à¸ªà¸³à¸«à¸£à¸±à¸šà¸à¸¥à¸¸à¹ˆà¸¡à¹ƒà¸«à¸à¹ˆ', 6),
    ('D', 'à¸«à¹‰à¸­à¸‡ D', 'à¸ªà¸•à¸¹à¸”à¸´à¹‚à¸­à¸žà¸£à¸µà¹€à¸¡à¸µà¸¢à¸¡ à¸žà¸£à¹‰à¸­à¸¡à¸­à¸¸à¸›à¸à¸£à¸“à¹Œà¸„à¸£à¸šà¸„à¸£à¸±à¸™', 4);
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bookingCode TEXT NOT NULL UNIQUE,
    customerName TEXT NOT NULL,
    customerEmail TEXT,
    packageName TEXT NOT NULL,
    shootType TEXT,
    shootTypeName TEXT,
    room TEXT NOT NULL,
    shootDate TEXT NOT NULL,
    bookingTime TEXT NOT NULL,
    duration TEXT,
    persons INTEGER DEFAULT 1,
    theme TEXT,
    themeName TEXT,
    services TEXT,
    notes TEXT,
    totalPrice REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bookingCode TEXT NOT NULL,
    paymentMethod TEXT NOT NULL,
    payerName TEXT NOT NULL,
    payerPhone TEXT,
    paymentDate TEXT,
    paymentTime TEXT,
    paidAmount REAL NOT NULL DEFAULT 0,
    note TEXT,
    slipName TEXT,
    status TEXT NOT NULL DEFAULT 'pending_review',
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bookingCode TEXT NOT NULL,
    returnDate TEXT,
    roomCondition TEXT,
    equipmentNotes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

// User statements
const findUserByEmailStmt = db.prepare(
  'SELECT id, firstName, lastName, email, phone, password FROM users WHERE lower(email) = lower(?)'
);
const findUserByUsernameStmt = db.prepare(
  "SELECT id, firstName, lastName, email, phone, password FROM users WHERE lower(firstName || ' ' || lastName) = lower(?)"
);
const insertUserStmt = db.prepare(
  'INSERT INTO users (firstName, lastName, email, phone, password) VALUES (?, ?, ?, ?, ?)'
);
const getAllUsersStmt = db.prepare(
  'SELECT id, firstName, lastName, email, phone, createdAt FROM users ORDER BY createdAt DESC'
);

// Admin statements
const findAdminByEmailStmt = db.prepare(
  'SELECT id, username, email, password FROM admins WHERE lower(email) = lower(?)'
);

// Room statements
const getAllRoomsStmt = db.prepare('SELECT * FROM rooms ORDER BY id');

// Booking statements
const insertBookingStmt = db.prepare(`
  INSERT INTO bookings
    (bookingCode, customerName, customerEmail, packageName, shootType, shootTypeName,
     room, shootDate, bookingTime, duration, persons, theme, themeName, services, notes, totalPrice)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const getAllBookingsStmt = db.prepare('SELECT * FROM bookings ORDER BY createdAt DESC');
const updateBookingStatusStmt = db.prepare('UPDATE bookings SET status = ? WHERE bookingCode = ?');

// Payment statements
const insertPaymentStmt = db.prepare(`
  INSERT INTO payments
    (bookingCode, paymentMethod, payerName, payerPhone, paymentDate, paymentTime, paidAmount, note, slipName)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const getAllPaymentsStmt = db.prepare('SELECT * FROM payments ORDER BY createdAt DESC');
const updatePaymentStatusStmt = db.prepare('UPDATE payments SET status = ? WHERE id = ?');

// Return statements
const insertReturnStmt = db.prepare(`
  INSERT INTO returns (bookingCode, returnDate, roomCondition, equipmentNotes)
  VALUES (?, ?, ?, ?)
`);
const getAllReturnsStmt = db.prepare('SELECT * FROM returns ORDER BY createdAt DESC');
const updateReturnStatusStmt = db.prepare('UPDATE returns SET status = ? WHERE id = ?');

// Add image column to rooms if not exists
try { db.exec('ALTER TABLE rooms ADD COLUMN image TEXT DEFAULT NULL'); } catch {}
// Add slipPath column to payments if not exists
try { db.exec('ALTER TABLE payments ADD COLUMN slipPath TEXT DEFAULT NULL'); } catch {}

// Packages table
db.exec(`
  CREATE TABLE IF NOT EXISTS packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    duration TEXT DEFAULT '3 à¸Šà¸±à¹ˆà¸§à¹‚à¸¡à¸‡',
    features TEXT DEFAULT '[]',
    old_price REAL DEFAULT 0,
    new_price REAL DEFAULT 0,
    badge TEXT,
    image TEXT,
    is_promo INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0
  );
  INSERT OR IGNORE INTO packages (slug, name, description, duration, features, old_price, new_price, badge, is_promo, sort_order) VALUES
    ('profile', 'Package Profile', 'à¸–à¹ˆà¸²à¸¢à¸ à¸²à¸žà¹‚à¸›à¸£à¹„à¸Ÿà¸¥à¹Œà¹‚à¸”à¸¢à¸Šà¹ˆà¸²à¸‡à¸ à¸²à¸žà¹à¸¥à¸°à¸—à¸µà¸¡à¸‡à¸²à¸™', '3 à¸Šà¸±à¹ˆà¸§à¹‚à¸¡à¸‡', '["à¸ˆà¸³à¸™à¸§à¸™ 1 à¸—à¹ˆà¸²à¸™","à¸ˆà¸³à¸™à¸§à¸™ 1 à¸‰à¸²à¸ (à¹€à¸¥à¸·à¸­à¸à¸ªà¸µà¹„à¸”à¹‰)","à¸–à¹ˆà¸²à¸¢à¸ªà¸¹à¸ˆà¸´à¸šà¸±à¸•à¸£à¹„à¸”à¹‰ 1 à¸Šà¸´à¹‰à¸™","à¸ˆà¸±à¸”à¹à¸•à¹ˆà¸‡à¸•à¸±à¸§à¸žà¸·à¹‰à¸™à¸à¸²à¸™"]', 3999, 2999, 'à¹à¸™à¸°à¸™à¸³', 1, 1),
    ('hbd', 'Package HBD.', 'à¸–à¹ˆà¸²à¸¢à¸ à¸²à¸žà¸§à¸±à¸™à¹€à¸à¸´à¸”à¹‚à¸”à¸¢à¸Šà¹ˆà¸²à¸‡à¸ à¸²à¸žà¹à¸¥à¸°à¸—à¸µà¸¡à¸‡à¸²à¸™', '3 à¸Šà¸±à¹ˆà¸§à¹‚à¸¡à¸‡', '["à¸ˆà¸³à¸™à¸§à¸™ 1 à¸—à¹ˆà¸²à¸™","à¸ˆà¸³à¸™à¸§à¸™ 1 à¸‰à¸²à¸ (à¹€à¸¥à¸·à¸­à¸à¸ªà¸µà¹„à¸”à¹‰)","à¸–à¹ˆà¸²à¸¢à¸ªà¸¹à¸ˆà¸´à¸šà¸±à¸•à¸£à¹„à¸”à¹‰ 1 à¸Šà¸´à¹‰à¸™","à¸•à¸à¹à¸•à¹ˆà¸‡à¸§à¸±à¸™à¹€à¸à¸´à¸”"]', 3999, 2999, NULL, 1, 2),
    ('lover', 'Package Lover', 'à¸ªà¸³à¸«à¸£à¸±à¸šà¸„à¸¹à¹ˆà¸£à¸±à¸ à¸–à¹ˆà¸²à¸¢à¸ à¸²à¸žà¸à¹ˆà¸²à¸¢à¸Šà¸²à¸¢à¹à¸¥à¸°à¸«à¸à¸´à¸‡', '3 à¸Šà¸±à¹ˆà¸§à¹‚à¸¡à¸‡', '["à¸ˆà¸³à¸™à¸§à¸™ 2 à¸—à¹ˆà¸²à¸™","à¸ˆà¸³à¸™à¸§à¸™ 2 à¸‰à¸²à¸ (à¹€à¸¥à¸·à¸­à¸à¸ªà¸µà¹„à¸”à¹‰)","à¸–à¹ˆà¸²à¸¢à¸ªà¸¹à¸ˆà¸´à¸šà¸±à¸•à¸£à¹„à¸”à¹‰ 2 à¸Šà¸´à¹‰à¸™","à¹‚à¸›à¸£à¹à¸à¸£à¸¡à¸–à¹ˆà¸²à¸¢à¸„à¸¹à¹ˆà¸£à¸±à¸"]', 8999, 5999, NULL, 1, 3),
    ('family', 'Package Family', 'à¸ªà¸³à¸«à¸£à¸±à¸šà¸„à¸£à¸­à¸šà¸„à¸£à¸±à¸§ à¸–à¹ˆà¸²à¸¢à¸à¸²à¸£à¸“à¹Œà¹à¸šà¸šà¸Ÿà¸´à¸¥à¹Œà¸¡à¹à¸Ÿà¸¡à¸´à¸¥à¸µà¹ˆ', '3 à¸Šà¸±à¹ˆà¸§à¹‚à¸¡à¸‡', '["à¸ˆà¸³à¸™à¸§à¸™ 4 à¸—à¹ˆà¸²à¸™","à¸ˆà¸³à¸™à¸§à¸™ 2 à¸‰à¸²à¸ (à¹€à¸¥à¸·à¸­à¸à¸ªà¸µà¹„à¸”à¹‰)","à¸–à¹ˆà¸²à¸¢à¸ªà¸¹à¸ˆà¸´à¸šà¸±à¸•à¸£à¹„à¸”à¹‰ 4 à¸Šà¸´à¹‰à¸™","à¹‚à¸›à¸£à¹à¸à¸£à¸¡à¸„à¸£à¸­à¸šà¸„à¸£à¸±à¸§"]', 7999, 6999, NULL, 1, 4),
    ('group', 'Package Group', 'à¸ªà¸³à¸«à¸£à¸±à¸šà¸à¸¥à¸¸à¹ˆà¸¡à¸«à¸£à¸·à¸­à¸­à¸‡à¸„à¹Œà¸à¸£ à¸–à¹ˆà¸²à¸¢à¸«à¸¡à¸¹à¹ˆà¹à¸šà¸šà¹€à¸›à¹‡à¸™à¸¡à¸´à¸•à¸£', '4 à¸Šà¸±à¹ˆà¸§à¹‚à¸¡à¸‡', '["à¸ˆà¸³à¸™à¸§à¸™ 6-10 à¸—à¹ˆà¸²à¸™","à¸ˆà¸³à¸™à¸§à¸™ 3 à¸‰à¸²à¸ (à¹€à¸¥à¸·à¸­à¸à¸ªà¸µà¹„à¸”à¹‰)","à¸–à¹ˆà¸²à¸¢à¸ªà¸¹à¸ˆà¸´à¸šà¸±à¸•à¸£à¹„à¸”à¹‰ 1 à¸Šà¸´à¹‰à¸™/à¸„à¸™","à¹‚à¸›à¸£à¹à¸à¸£à¸¡à¸à¸´à¸ˆà¸à¸£à¸£à¸¡à¸à¸¥à¸¸à¹ˆà¸¡"]', 12999, 9999, NULL, 0, 5),
    ('premium', 'Package Premium', 'à¹à¸žà¹‡à¸à¹€à¸à¸ˆà¸ªà¸¸à¸”à¸žà¸´à¹€à¸¨à¸© à¸ªà¸³à¸«à¸£à¸±à¸šà¸à¸²à¸£à¸–à¹ˆà¸²à¸¢à¸ à¸²à¸žà¹à¸šà¸šà¸¥à¸°à¹€à¸­à¸µà¸¢à¸”', '5 à¸Šà¸±à¹ˆà¸§à¹‚à¸¡à¸‡', '["à¸ˆà¸³à¸™à¸§à¸™à¸—à¹ˆà¸²à¸™: à¹„à¸¡à¹ˆà¸ˆà¸³à¸à¸±à¸”","à¸ˆà¸³à¸™à¸§à¸™ 5 à¸‰à¸²à¸ (à¹€à¸¥à¸·à¸­à¸à¸ªà¸µà¹„à¸”à¹‰)","à¸–à¹ˆà¸²à¸¢à¸ªà¸¹à¸ˆà¸´à¸šà¸±à¸•à¸£à¹„à¸”à¹‰à¹„à¸¡à¹ˆà¸ˆà¸³à¸à¸±à¸”","à¹€à¸ªà¸·à¹‰à¸­à¸œà¹‰à¸² + à¸™à¸±à¸à¹à¸•à¹ˆà¸‡ + à¸£à¸–à¸£à¸±à¸š-à¸ªà¹ˆà¸‡"]', 15999, 12999, 'VIP', 0, 6);
`);

// Themes table
db.exec(`
  CREATE TABLE IF NOT EXISTS themes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price INTEGER DEFAULT 0,
    color1 TEXT DEFAULT '#ffffff',
    color2 TEXT DEFAULT '#f0f0f0',
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    image TEXT DEFAULT NULL
  );
  INSERT OR IGNORE INTO themes (slug, name, description, price, color1, color2, sort_order, is_active) VALUES
    ('minimal',  'à¸¡à¸´à¸™à¸´à¸¡à¸­à¸¥',   'à¹€à¸£à¸µà¸¢à¸š à¸ªà¸°à¸­à¸²à¸” à¹‚à¸—à¸™à¸­à¹ˆà¸­à¸™',    0,   '#ffffff', '#edf0f5', 1, 1),
    ('classic',  'à¸„à¸¥à¸²à¸ªà¸ªà¸´à¸',   'à¸ªà¸¸à¸ à¸²à¸ž à¹‚à¸—à¸™à¹€à¸—à¸² à¹€à¸‚à¹‰à¸¡à¸‚à¸¶à¹‰à¸™',  200, '#2f3542', '#a4b0be', 2, 1),
    ('fresh',    'à¸ªà¸”à¹ƒà¸ª',      'à¹‚à¸—à¸™à¸Ÿà¹‰à¸² à¸ªà¸šà¸²à¸¢à¸•à¸²',           300, '#70d6ff', '#b8f7ff', 3, 1),
    ('sweet',    'à¸«à¸§à¸²à¸™',      'à¹‚à¸—à¸™à¸Šà¸¡à¸žà¸¹ à¸™à¸¸à¹ˆà¸¡à¸¥à¸°à¸¡à¸¸à¸™',       300, '#ff8fab', '#ffd6e0', 4, 1),
    ('nature',   'à¸˜à¸£à¸£à¸¡à¸Šà¸²à¸•à¸´',  'à¹‚à¸—à¸™à¹€à¸‚à¸µà¸¢à¸§ à¸”à¸¹à¸œà¹ˆà¸­à¸™à¸„à¸¥à¸²à¸¢',    400, '#2fbf71', '#b7efc5', 5, 1),
    ('premium',  'à¸žà¸£à¸µà¹€à¸¡à¸µà¸¢à¸¡',  'à¸‰à¸²à¸à¸žà¸´à¹€à¸¨à¸© à¸”à¸¹à¸«à¸£à¸¹à¸‚à¸¶à¹‰à¸™',     500, '#1f1235', '#ffd166', 6, 1);
`);
try { db.exec('ALTER TABLE themes ADD COLUMN image TEXT DEFAULT NULL'); } catch {}

// Admin CRUD statements
const updateUserStmt = db.prepare('UPDATE users SET firstName=?, lastName=?, email=?, phone=? WHERE id=?');
const deleteUserStmt = db.prepare('DELETE FROM users WHERE id=?');
const updateRoomStmt = db.prepare('UPDATE rooms SET name=?, description=?, capacity=?, status=? WHERE id=?');
const updateBookingStmt = db.prepare('UPDATE bookings SET customerName=?, room=?, shootDate=?, bookingTime=?, persons=?, themeName=?, totalPrice=? WHERE id=?');
const deleteBookingStmt = db.prepare('DELETE FROM bookings WHERE id=?');
const updatePaymentStmt = db.prepare('UPDATE payments SET payerName=?, payerPhone=?, paymentMethod=?, paidAmount=? WHERE id=?');
const deletePaymentStmt = db.prepare('DELETE FROM payments WHERE id=?');
const updateReturnStmt = db.prepare('UPDATE returns SET returnDate=?, roomCondition=?, equipmentNotes=? WHERE id=?');
const deleteReturnStmt = db.prepare('DELETE FROM returns WHERE id=?');

// Theme statements
const getAllThemesStmt = db.prepare('SELECT * FROM themes ORDER BY sort_order ASC');
const getActiveThemesStmt = db.prepare('SELECT * FROM themes WHERE is_active = 1 ORDER BY sort_order ASC');
const insertThemeStmt = db.prepare('INSERT INTO themes (slug, name, description, price, color1, color2, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
const updateThemeStmt = db.prepare('UPDATE themes SET name=?, description=?, price=?, color1=?, color2=?, sort_order=?, is_active=? WHERE id=?');
const deleteThemeStmt = db.prepare('DELETE FROM themes WHERE id=?');

// Package statements
const getAllPackagesStmt = db.prepare('SELECT * FROM packages ORDER BY sort_order ASC');
const updatePackageStmt = db.prepare('UPDATE packages SET name=?, description=?, duration=?, features=?, old_price=?, new_price=?, badge=?, is_promo=?, sort_order=? WHERE id=?');
const deletePackageStmt = db.prepare('DELETE FROM packages WHERE id=?');

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': CONTENT_TYPES['.json'] });
  response.end(JSON.stringify(payload));
}

function sanitizeUser(row) {
  if (!row) return null;
  return { id: row.id, username: `${row.firstName} ${row.lastName}`.trim(), email: row.email, phone: row.phone };
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      if (!body) { resolve({}); return; }
      try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Invalid JSON body')); }
    });
    request.on('error', reject);
  });
}

function generateBookingCode() {
  const n = new Date();
  const ts = String(n.getFullYear()).slice(-2)
    + String(n.getMonth() + 1).padStart(2, '0')
    + String(n.getDate()).padStart(2, '0')
    + String(n.getHours()).padStart(2, '0')
    + String(n.getMinutes()).padStart(2, '0')
    + String(n.getSeconds()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `BK${ts}${rand}`;
}

function handleAdminGet(response, pathname) {
  if (pathname === '/api/admin/users') {
    const users = getAllUsersStmt.all();
    sendJson(response, 200, { users });
    return true;
  }
  if (pathname === '/api/admin/rooms') {
    const rooms = getAllRoomsStmt.all();
    const bookings = getAllBookingsStmt.all();
    const roomsWithStats = rooms.map(room => ({
      ...room,
      totalBookings: bookings.filter(b => b.room === room.id).length,
      activeBookings: bookings.filter(b => b.room === room.id && ['approved', 'active'].includes(b.status)).length,
    }));
    sendJson(response, 200, { rooms: roomsWithStats });
    return true;
  }
  if (pathname === '/api/admin/bookings') {
    sendJson(response, 200, { bookings: getAllBookingsStmt.all() });
    return true;
  }
  if (pathname === '/api/admin/payments') {
    sendJson(response, 200, { payments: getAllPaymentsStmt.all() });
    return true;
  }
  if (pathname === '/api/admin/returns') {
    sendJson(response, 200, { returns: getAllReturnsStmt.all() });
    return true;
  }
  if (pathname === '/api/packages' || pathname === '/api/admin/packages') {
    sendJson(response, 200, { packages: getAllPackagesStmt.all() });
    return true;
  }
  if (pathname === '/api/themes') {
    sendJson(response, 200, { themes: getActiveThemesStmt.all() });
    return true;
  }
  if (pathname === '/api/admin/themes') {
    sendJson(response, 200, { themes: getAllThemesStmt.all() });
    return true;
  }
  return false;
}

async function handleApi(request, response, pathname) {
  if (request.method === 'GET') {
    const handled = handleAdminGet(response, pathname);
    if (!handled) sendJson(response, 404, { error: 'API route not found' });
    return true;
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed' });
    return true;
  }

  const body = await readJsonBody(request);

  if (pathname === '/api/users/by-email') {
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) { sendJson(response, 400, { error: 'Email is required' }); return true; }
    sendJson(response, 200, { user: sanitizeUser(findUserByEmailStmt.get(email)) });
    return true;
  }

  if (pathname === '/api/users/by-username') {
    const username = String(body.username || '').trim();
    if (!username) { sendJson(response, 400, { error: 'Username is required' }); return true; }
    sendJson(response, 200, { user: sanitizeUser(findUserByUsernameStmt.get(username)) });
    return true;
  }

  if (pathname === '/api/users') {
    const firstName = String(body.firstName || '').trim();
    const lastName = String(body.lastName || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    const password = String(body.password || '').trim();
    const username = `${firstName} ${lastName}`.trim();

    if (!firstName || !lastName || !email || !phone || !password) {
      sendJson(response, 400, { error: 'First name, last name, email, phone, and password are required' });
      return true;
    }
    if (findUserByEmailStmt.get(email)) { sendJson(response, 409, { error: 'Email already exists' }); return true; }
    if (findUserByUsernameStmt.get(username)) { sendJson(response, 409, { error: 'Username already exists' }); return true; }

    try {
      const result = insertUserStmt.run(firstName, lastName, email, phone, password);
      sendJson(response, 201, { id: Number(result.lastInsertRowid) });
    } catch (error) {
      if (error.message && error.message.toLowerCase().includes('unique')) {
        sendJson(response, 409, { error: 'Email already exists' });
        return true;
      }
      console.error('Registration error:', error);
      sendJson(response, 500, { error: 'Could not create account' });
    }
    return true;
  }

  if (pathname === '/api/login') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '').trim();
    if (!email || !password) { sendJson(response, 400, { error: 'Email and password are required' }); return true; }
    const userRow = findUserByEmailStmt.get(email);
    if (!userRow || userRow.password !== password) { sendJson(response, 200, { user: null }); return true; }
    sendJson(response, 200, { user: sanitizeUser(userRow) });
    return true;
  }

  if (pathname === '/api/admin/login') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '').trim();
    if (!email || !password) { sendJson(response, 400, { error: 'Email and password are required' }); return true; }
    const adminRow = findAdminByEmailStmt.get(email);
    if (!adminRow || adminRow.password !== password) { sendJson(response, 200, { admin: null }); return true; }
    sendJson(response, 200, {
      admin: { id: adminRow.id, username: adminRow.username, email: adminRow.email, role: 'admin' },
    });
    return true;
  }

  if (pathname === '/api/bookings') {
    const { customerName, customerEmail, packageName, shootType, shootTypeName,
      room, shootDate, bookingTime, duration, persons, theme, themeName,
      services, notes, totalPrice } = body;

    if (!customerName || !room || !shootDate || !bookingTime) {
      sendJson(response, 400, { error: 'Missing required booking fields' });
      return true;
    }
    const bookingCode = generateBookingCode();
    try {
      insertBookingStmt.run(
        bookingCode,
        String(customerName || ''),
        String(customerEmail || ''),
        String(packageName || 'Studio Custom Package'),
        String(shootType || ''),
        String(shootTypeName || ''),
        String(room || ''),
        String(shootDate || ''),
        String(bookingTime || ''),
        String(duration || ''),
        Number(persons || 1),
        String(theme || ''),
        String(themeName || ''),
        JSON.stringify(services || []),
        String(notes || ''),
        Number(totalPrice || 0)
      );
      sendJson(response, 201, { bookingCode });
    } catch (error) {
      console.error('Booking error:', error);
      sendJson(response, 500, { error: 'Could not create booking' });
    }
    return true;
  }

  if (pathname === '/api/payments') {
    const { bookingCode, paymentMethod, payerName, payerPhone,
      paymentDate, paymentTime, paidAmount, note, slipName } = body;
    if (!bookingCode || !paymentMethod || !payerName) {
      sendJson(response, 400, { error: 'Missing required payment fields' });
      return true;
    }
    try {
      const paymentResult = insertPaymentStmt.run(
        String(bookingCode || ''),
        String(paymentMethod || ''),
        String(payerName || ''),
        String(payerPhone || ''),
        String(paymentDate || ''),
        String(paymentTime || ''),
        Number(paidAmount || 0),
        String(note || ''),
        String(slipName || '')
      );
      sendJson(response, 201, { ok: true, id: Number(paymentResult.lastInsertRowid) });
    } catch (error) {
      console.error('Payment error:', error);
      sendJson(response, 500, { error: 'Could not save payment' });
    }
    return true;
  }

  if (pathname === '/api/returns') {
    const { bookingCode, returnDate, roomCondition, equipmentNotes } = body;
    if (!bookingCode) { sendJson(response, 400, { error: 'bookingCode is required' }); return true; }
    try {
      insertReturnStmt.run(
        String(bookingCode || ''),
        String(returnDate || ''),
        String(roomCondition || ''),
        String(equipmentNotes || '')
      );
      sendJson(response, 201, { ok: true });
    } catch (error) {
      console.error('Return error:', error);
      sendJson(response, 500, { error: 'Could not save return record' });
    }
    return true;
  }

  if (pathname === '/api/admin/bookings/status') {
    const { bookingCode, status } = body;
    const allowed = ['pending', 'approved', 'active', 'completed', 'cancelled'];
    if (!bookingCode || !allowed.includes(status)) {
      sendJson(response, 400, { error: 'Invalid bookingCode or status' });
      return true;
    }
    updateBookingStatusStmt.run(status, bookingCode);
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/payments/status') {
    const { id, status } = body;
    const allowed = ['pending_review', 'verified', 'rejected'];
    if (!id || !allowed.includes(status)) {
      sendJson(response, 400, { error: 'Invalid id or status' });
      return true;
    }
    updatePaymentStatusStmt.run(status, Number(id));
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/returns/status') {
    const { id, status } = body;
    const allowed = ['pending', 'completed'];
    if (!id || !allowed.includes(status)) {
      sendJson(response, 400, { error: 'Invalid id or status' });
      return true;
    }
    updateReturnStatusStmt.run(status, Number(id));
    sendJson(response, 200, { ok: true });
    return true;
  }



  if (pathname === '/api/admin/users/update') {
    const { id, firstName, lastName, email, phone } = body;
    if (!id || !firstName || !lastName || !email || !phone) {
      sendJson(response, 400, { error: 'Missing fields' }); return true;
    }
    updateUserStmt.run(String(firstName), String(lastName), String(email).toLowerCase(), String(phone), Number(id));
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/users/delete') {
    const { id } = body;
    if (!id) { sendJson(response, 400, { error: 'id required' }); return true; }
    deleteUserStmt.run(Number(id));
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/rooms/update') {
    const { id, name, description, capacity, status } = body;
    if (!id || !name) { sendJson(response, 400, { error: 'Missing fields' }); return true; }
    updateRoomStmt.run(String(name), String(description || ''), Number(capacity || 4), String(status || 'available'), String(id));
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/bookings/update') {
    const { id, customerName, room, shootDate, bookingTime, persons, themeName, totalPrice } = body;
    if (!id || !customerName || !room || !shootDate || !bookingTime) {
      sendJson(response, 400, { error: 'Missing fields' }); return true;
    }
    updateBookingStmt.run(String(customerName), String(room), String(shootDate), String(bookingTime), Number(persons || 1), String(themeName || ''), Number(totalPrice || 0), Number(id));
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/bookings/delete') {
    const { id } = body;
    if (!id) { sendJson(response, 400, { error: 'id required' }); return true; }
    deleteBookingStmt.run(Number(id));
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/payments/update') {
    const { id, payerName, payerPhone, paymentMethod, paidAmount } = body;
    if (!id || !payerName || !paymentMethod) { sendJson(response, 400, { error: 'Missing fields' }); return true; }
    updatePaymentStmt.run(String(payerName), String(payerPhone || ''), String(paymentMethod), Number(paidAmount || 0), Number(id));
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/payments/delete') {
    const { id } = body;
    if (!id) { sendJson(response, 400, { error: 'id required' }); return true; }
    deletePaymentStmt.run(Number(id));
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/returns/update') {
    const { id, returnDate, roomCondition, equipmentNotes } = body;
    if (!id) { sendJson(response, 400, { error: 'id required' }); return true; }
    updateReturnStmt.run(String(returnDate || ''), String(roomCondition || ''), String(equipmentNotes || ''), Number(id));
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/returns/delete') {
    const { id } = body;
    if (!id) { sendJson(response, 400, { error: 'id required' }); return true; }
    deleteReturnStmt.run(Number(id));
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/payments/slip') {
    const { id, imageData } = body;
    if (!id || !imageData) { sendJson(response, 400, { error: 'Missing fields' }); return true; }
    const matches = imageData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches) { sendJson(response, 400, { error: 'Invalid image data' }); return true; }
    const mimeToExt = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf' };
    const ext = mimeToExt[matches[1]] || 'jpg';
    const buffer = Buffer.from(matches[2], 'base64');
    const slipsDir = path.join(ROOT_DIR, 'pic', 'slips');
    if (!fs.existsSync(slipsDir)) fs.mkdirSync(slipsDir, { recursive: true });
    const filename = `slip-${id}.${ext}`;
    fs.writeFileSync(path.join(slipsDir, filename), buffer);
    const slipPath = `pic/slips/${filename}`;
    db.prepare('UPDATE payments SET slipPath = ? WHERE id = ?').run(slipPath, Number(id));
    sendJson(response, 200, { ok: true, slipPath });
    return true;
  }

  if (pathname === '/api/admin/packages/update') {
    const { id, name, description, duration, features, old_price, new_price, badge, is_promo, sort_order } = body;
    if (!id || !name) { sendJson(response, 400, { error: 'Missing fields' }); return true; }
    updatePackageStmt.run(
      String(name), String(description || ''), String(duration || '3 à¸Šà¸±à¹ˆà¸§à¹‚à¸¡à¸‡'),
      JSON.stringify(Array.isArray(features) ? features : []),
      Number(old_price || 0), Number(new_price || 0),
      badge ? String(badge) : null, is_promo ? 1 : 0, Number(sort_order || 0), Number(id)
    );
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/packages/delete') {
    const { id } = body;
    if (!id) { sendJson(response, 400, { error: 'id required' }); return true; }
    deletePackageStmt.run(Number(id));
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/packages/image') {
    const { id, imageData } = body;
    if (!id || !imageData) { sendJson(response, 400, { error: 'Missing fields' }); return true; }
    const matches = imageData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches) { sendJson(response, 400, { error: 'Invalid image data' }); return true; }
    const mimeToExt = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
    const ext = mimeToExt[matches[1]] || 'jpg';
    const buffer = Buffer.from(matches[2], 'base64');
    const pkgDir = path.join(ROOT_DIR, 'pic', 'packages');
    if (!fs.existsSync(pkgDir)) fs.mkdirSync(pkgDir, { recursive: true });
    const filename = `package-${id}.${ext}`;
    fs.writeFileSync(path.join(pkgDir, filename), buffer);
    const imagePath = `pic/packages/${filename}`;
    db.prepare('UPDATE packages SET image = ? WHERE id = ?').run(imagePath, Number(id));
    sendJson(response, 200, { ok: true, image: imagePath });
    return true;
  }

  if (pathname === '/api/admin/themes/add') {
    const { slug, name, description, price, color1, color2, sort_order } = body;
    if (!slug || !name) { sendJson(response, 400, { error: 'Missing fields' }); return true; }
    try {
      const result = insertThemeStmt.run(
        String(slug), String(name), String(description || ''),
        Number(price || 0), String(color1 || '#ffffff'), String(color2 || '#f0f0f0'),
        Number(sort_order || 0), 1
      );
      sendJson(response, 201, { id: Number(result.lastInsertRowid) });
    } catch (e) {
      sendJson(response, 400, { error: 'Slug already exists' });
    }
    return true;
  }

  if (pathname === '/api/admin/themes/update') {
    const { id, name, description, price, color1, color2, sort_order, is_active } = body;
    if (!id || !name) { sendJson(response, 400, { error: 'Missing fields' }); return true; }
    updateThemeStmt.run(
      String(name), String(description || ''), Number(price || 0),
      String(color1 || '#ffffff'), String(color2 || '#f0f0f0'),
      Number(sort_order || 0), is_active ? 1 : 0, Number(id)
    );
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/themes/delete') {
    const { id } = body;
    if (!id) { sendJson(response, 400, { error: 'id required' }); return true; }
    deleteThemeStmt.run(Number(id));
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/themes/image') {
    const { id, imageData } = body;
    if (!id || !imageData) { sendJson(response, 400, { error: 'Missing fields' }); return true; }
    const matches = imageData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches) { sendJson(response, 400, { error: 'Invalid image data' }); return true; }
    const mimeToExt = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
    const ext = mimeToExt[matches[1]] || 'jpg';
    const buffer = Buffer.from(matches[2], 'base64');
    const themesDir = path.join(ROOT_DIR, 'pic', 'themes');
    if (!fs.existsSync(themesDir)) fs.mkdirSync(themesDir, { recursive: true });
    const filename = `theme-${id}.${ext}`;
    fs.writeFileSync(path.join(themesDir, filename), buffer);
    const imagePath = `pic/themes/${filename}`;
    db.prepare('UPDATE themes SET image = ? WHERE id = ?').run(imagePath, Number(id));
    sendJson(response, 200, { ok: true, image: imagePath });
    return true;
  }

  if (pathname === '/api/admin/rooms/image') {
    const { id, imageData } = body;
    if (!id || !imageData) { sendJson(response, 400, { error: 'Missing fields' }); return true; }
    const matches = imageData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches) { sendJson(response, 400, { error: 'Invalid image data' }); return true; }
    const mimeToExt = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
    const ext = mimeToExt[matches[1]] || 'jpg';
    const buffer = Buffer.from(matches[2], 'base64');
    const roomsDir = path.join(ROOT_DIR, 'pic', 'rooms');
    if (!fs.existsSync(roomsDir)) fs.mkdirSync(roomsDir, { recursive: true });
    const filename = `room-${id}.${ext}`;
    fs.writeFileSync(path.join(roomsDir, filename), buffer);
    const imagePath = `pic/rooms/${filename}`;
    db.prepare('UPDATE rooms SET image = ? WHERE id = ?').run(imagePath, String(id));
    sendJson(response, 200, { ok: true, image: imagePath });
    return true;
  }

  return false;
}

function resolveFilePath(pathname) {
  let relativePath = pathname;
  const lowerPath = pathname.toLowerCase();

  // root â†’ à¸«à¸™à¹‰à¸² login
  if (pathname === '/' || lowerPath === '/index.html') {
    relativePath = '/index.html';
  }

  const normalizedPath = path.normalize(relativePath).replace(/^([\.\.][/\\])+/, '');
  const safePath = normalizedPath.replace(/^[/\\]+/, '');
  return path.join(ROOT_DIR, safePath);
}

function serveStaticFile(response, filePath) {
  if (!filePath.startsWith(ROOT_DIR)) {
    sendJson(response, 403, { error: 'Forbidden' });
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') { sendJson(response, 404, { error: 'Not found' }); return; }
      sendJson(response, 500, { error: 'Failed to read file' });
      return;
    }
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, { 'Content-Type': CONTENT_TYPES[extension] || 'application/octet-stream' });
    response.end(content);
  });
}

function createServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
      if (url.pathname.startsWith('/api/')) {
        const handled = await handleApi(request, response, url.pathname);
        if (!handled) sendJson(response, 404, { error: 'API route not found' });
        return;
      }
      serveStaticFile(response, resolveFilePath(url.pathname));
    } catch (error) {
      sendJson(response, 500, { error: error.message || 'Unexpected server error' });
    }
  });
}

if (require.main === module) {
    const server = createServer();
    
  
    const listenHost = process.env.PORT ? '0.0.0.0' : HOST;

    server.listen(PORT, listenHost, () => {
        console.log(`Server running at http://${listenHost}:${PORT}`);
    });
}

module.exports = { createServer };
