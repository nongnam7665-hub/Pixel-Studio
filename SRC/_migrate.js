const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('database.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  INSERT OR IGNORE INTO admins (username, email, password)
  VALUES ('ผู้ดูแลระบบ', 'admin@studio.com', 'admin1234');
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    capacity INTEGER DEFAULT 4,
    status TEXT NOT NULL DEFAULT 'available'
  );
  INSERT OR IGNORE INTO rooms (id, name, description, capacity) VALUES
    ('A', 'ห้อง A', 'สตูดิโอขนาดเล็ก เหมาะสำหรับถ่ายภาพเดี่ยวหรือคู่', 2),
    ('B', 'ห้อง B', 'สตูดิโอขนาดกลาง เหมาะสำหรับกลุ่มเล็ก', 4),
    ('C', 'ห้อง C', 'สตูดิโอขนาดใหญ่ เหมาะสำหรับกลุ่มใหญ่', 6),
    ('D', 'ห้อง D', 'สตูดิโอพรีเมียม พร้อมอุปกรณ์ครบครัน', 4);
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

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name).join(', '));
console.log('Done.');
