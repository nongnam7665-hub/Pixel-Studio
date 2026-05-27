const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { Pool } = require('pg');

const HOST = process.env.PORT ? '0.0.0.0' : '127.0.0.1';
const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.join(__dirname, '..');

// เชื่อมต่อ Supabase (PostgreSQL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

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

// สร้างตารางและข้อมูลเริ่มต้น (แยกทีละตาราง เพราะ pg ไม่รองรับ multi-statement)
async function initDB() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    password TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    capacity INTEGER DEFAULT 4,
    status TEXT NOT NULL DEFAULT 'available',
    image TEXT DEFAULT NULL
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    "bookingCode" TEXT NOT NULL UNIQUE,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "packageName" TEXT NOT NULL,
    "shootType" TEXT,
    "shootTypeName" TEXT,
    room TEXT NOT NULL,
    "shootDate" TEXT NOT NULL,
    "bookingTime" TEXT NOT NULL,
    duration TEXT,
    persons INTEGER DEFAULT 1,
    theme TEXT,
    "themeName" TEXT,
    services TEXT,
    notes TEXT,
    "totalPrice" NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    "bookingCode" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "payerName" TEXT NOT NULL,
    "payerPhone" TEXT,
    "paymentDate" TEXT,
    "paymentTime" TEXT,
    "paidAmount" NUMERIC NOT NULL DEFAULT 0,
    note TEXT,
    "slipName" TEXT,
    "slipPath" TEXT,
    status TEXT NOT NULL DEFAULT 'pending_review',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS returns (
    id SERIAL PRIMARY KEY,
    "bookingCode" TEXT NOT NULL,
    "returnDate" TEXT,
    "roomCondition" TEXT,
    "equipmentNotes" TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS packages (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    duration TEXT DEFAULT '3 ชั่วโมง',
    features TEXT DEFAULT '[]',
    old_price NUMERIC DEFAULT 0,
    new_price NUMERIC DEFAULT 0,
    badge TEXT,
    image TEXT,
    is_promo INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS themes (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price INTEGER DEFAULT 0,
    color1 TEXT DEFAULT '#ffffff',
    color2 TEXT DEFAULT '#f0f0f0',
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    image TEXT DEFAULT NULL
  )`);

  // เพิ่ม column adminMessage ถ้ายังไม่มี (safe migration)
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "adminMessage" TEXT`);

  // ข้อมูลเริ่มต้น
  await pool.query(`
    INSERT INTO admins (username, email, password)
    VALUES ('ผู้ดูแลระบบ', 'admin@studio.com', 'admin1234')
    ON CONFLICT (email) DO NOTHING
  `);
  await pool.query(`
    INSERT INTO rooms (id, name, description, capacity) VALUES
      ('A', 'ห้อง A', 'สตูดิโอขนาดเล็ก เหมาะสำหรับถ่ายภาพเดี่ยวหรือคู่', 2),
      ('B', 'ห้อง B', 'สตูดิโอขนาดกลาง เหมาะสำหรับกลุ่มเล็ก', 4),
      ('C', 'ห้อง C', 'สตูดิโอขนาดใหญ่ เหมาะสำหรับกลุ่มใหญ่', 6),
      ('D', 'ห้อง D', 'สตูดิโอพรีเมียม พร้อมอุปกรณ์ครบครัน', 4)
    ON CONFLICT (id) DO NOTHING
  `);
  await pool.query(`
    INSERT INTO packages (slug, name, description, duration, features, old_price, new_price, badge, is_promo, sort_order) VALUES
      ('profile', 'Package Profile', 'ถ่ายภาพโปรไฟล์โดยช่างภาพและทีมงาน', '3 ชั่วโมง', '["จำนวน 1 ท่าน","จำนวน 1 ฉาก (เลือกสีได้)","ถ่ายสูจิบัตรได้ 1 ชิ้น","จัดแต่งตัวพื้นฐาน"]', 3999, 2999, 'แนะนำ', 1, 1),
      ('hbd', 'Package HBD.', 'ถ่ายภาพวันเกิดโดยช่างภาพและทีมงาน', '3 ชั่วโมง', '["จำนวน 1 ท่าน","จำนวน 1 ฉาก (เลือกสีได้)","ถ่ายสูจิบัตรได้ 1 ชิ้น","ตกแต่งวันเกิด"]', 3999, 2999, NULL, 1, 2),
      ('lover', 'Package Lover', 'สำหรับคู่รัก ถ่ายภาพฝ่ายชายและหญิง', '3 ชั่วโมง', '["จำนวน 2 ท่าน","จำนวน 2 ฉาก (เลือกสีได้)","ถ่ายสูจิบัตรได้ 2 ชิ้น","โปรแกรมถ่ายคู่รัก"]', 8999, 5999, NULL, 1, 3),
      ('family', 'Package Family', 'สำหรับครอบครัว ถ่ายการณ์แบบฟิล์มแฟมิลี่', '3 ชั่วโมง', '["จำนวน 4 ท่าน","จำนวน 2 ฉาก (เลือกสีได้)","ถ่ายสูจิบัตรได้ 4 ชิ้น","โปรแกรมครอบครัว"]', 7999, 6999, NULL, 1, 4),
      ('group', 'Package Group', 'สำหรับกลุ่มหรือองค์กร ถ่ายหมู่แบบเป็นมิตร', '4 ชั่วโมง', '["จำนวน 6-10 ท่าน","จำนวน 3 ฉาก (เลือกสีได้)","ถ่ายสูจิบัตรได้ 1 ชิ้น/คน","โปรแกรมกิจกรรมกลุ่ม"]', 12999, 9999, NULL, 0, 5),
      ('premium', 'Package Premium', 'แพ็กเกจสุดพิเศษ สำหรับการถ่ายภาพแบบละเอียด', '5 ชั่วโมง', '["จำนวนท่าน: ไม่จำกัด","จำนวน 5 ฉาก (เลือกสีได้)","ถ่ายสูจิบัตรได้ไม่จำกัด","เสื้อผ้า + นักแต่ง + รถรับ-ส่ง"]', 15999, 12999, 'VIP', 0, 6)
    ON CONFLICT (slug) DO NOTHING
  `);
  await pool.query(`
    INSERT INTO themes (slug, name, description, price, color1, color2, sort_order, is_active) VALUES
      ('minimal',  'มินิมอล',   'เรียบ สะอาด โทนอ่อน',    0,   '#ffffff', '#edf0f5', 1, 1),
      ('classic',  'คลาสสิก',   'สุภาพ โทนเทา เข้มขึ้น',  200, '#2f3542', '#a4b0be', 2, 1),
      ('fresh',    'สดใส',      'โทนฟ้า สบายตา',           300, '#70d6ff', '#b8f7ff', 3, 1),
      ('sweet',    'หวาน',      'โทนชมพู นุ่มละมุน',       300, '#ff8fab', '#ffd6e0', 4, 1),
      ('nature',   'ธรรมชาติ',  'โทนเขียว ดูผ่อนคลาย',    400, '#2fbf71', '#b7efc5', 5, 1),
      ('premium',  'พรีเมียม',  'ฉากพิเศษ ดูหรูขึ้น',     500, '#1f1235', '#ffd166', 6, 1)
    ON CONFLICT (slug) DO NOTHING
  `);

  console.log('Database initialized');
}

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

async function handleAdminGet(response, pathname) {
  if (pathname === '/api/admin/users') {
    const { rows: users } = await pool.query(
      'SELECT id, "firstName", "lastName", email, phone, "createdAt" FROM users ORDER BY "createdAt" DESC'
    );
    sendJson(response, 200, { users });
    return true;
  }
  if (pathname === '/api/admin/rooms') {
    const { rows: rooms } = await pool.query('SELECT * FROM rooms ORDER BY id');
    const { rows: bookings } = await pool.query('SELECT room, status FROM bookings');
    const roomsWithStats = rooms.map(room => ({
      ...room,
      totalBookings: bookings.filter(b => b.room === room.id).length,
      activeBookings: bookings.filter(b => b.room === room.id && ['approved', 'active'].includes(b.status)).length,
    }));
    sendJson(response, 200, { rooms: roomsWithStats });
    return true;
  }
  if (pathname === '/api/admin/bookings') {
    const { rows: bookings } = await pool.query('SELECT * FROM bookings ORDER BY "createdAt" DESC');
    sendJson(response, 200, { bookings });
    return true;
  }
  if (pathname === '/api/admin/payments') {
    const { rows: payments } = await pool.query('SELECT * FROM payments ORDER BY "createdAt" DESC');
    sendJson(response, 200, { payments });
    return true;
  }
  if (pathname === '/api/admin/returns') {
    const { rows: returns_ } = await pool.query('SELECT * FROM returns ORDER BY "createdAt" DESC');
    sendJson(response, 200, { returns: returns_ });
    return true;
  }
  if (pathname === '/api/packages' || pathname === '/api/admin/packages') {
    const { rows: packages } = await pool.query('SELECT * FROM packages ORDER BY sort_order ASC');
    sendJson(response, 200, { packages });
    return true;
  }
  if (pathname === '/api/themes') {
    const { rows: themes } = await pool.query('SELECT * FROM themes WHERE is_active = 1 ORDER BY sort_order ASC');
    sendJson(response, 200, { themes });
    return true;
  }
  if (pathname === '/api/admin/themes') {
    const { rows: themes } = await pool.query('SELECT * FROM themes ORDER BY sort_order ASC');
    sendJson(response, 200, { themes });
    return true;
  }
  return false;
}

async function handleApi(request, response, pathname, searchParams) {
  if (request.method === 'GET') {
    if (pathname === '/api/user/bookings') {
      const email = searchParams.get('email') || '';
      if (!email) { sendJson(response, 400, { error: 'email required' }); return true; }
      const { rows } = await pool.query(
        `SELECT "bookingCode", "packageName", "customerName", room, "shootDate", "bookingTime", "totalPrice", status, "adminMessage", "createdAt"
         FROM bookings WHERE "customerEmail" = $1 ORDER BY "createdAt" DESC`,
        [email]
      );
      sendJson(response, 200, { bookings: rows });
      return true;
    }
    if (pathname === '/api/rooms/availability') {
      const date = searchParams.get('date') || '';
      const { rows } = await pool.query(
        `SELECT room, "bookingTime", duration FROM bookings WHERE "shootDate" = $1 AND status NOT IN ('cancelled', 'rejected')`,
        [date]
      );
      sendJson(response, 200, { bookings: rows });
      return true;
    }
    const handled = await handleAdminGet(response, pathname);
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
    const { rows } = await pool.query(
      'SELECT id, "firstName", "lastName", email, phone, password FROM users WHERE lower(email) = lower($1)',
      [email]
    );
    sendJson(response, 200, { user: sanitizeUser(rows[0] || null) });
    return true;
  }

  if (pathname === '/api/users/by-username') {
    const username = String(body.username || '').trim();
    if (!username) { sendJson(response, 400, { error: 'Username is required' }); return true; }
    const { rows } = await pool.query(
      `SELECT id, "firstName", "lastName", email, phone, password FROM users WHERE lower("firstName" || ' ' || "lastName") = lower($1)`,
      [username]
    );
    sendJson(response, 200, { user: sanitizeUser(rows[0] || null) });
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

    const { rows: existEmail } = await pool.query('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
    if (existEmail.length) { sendJson(response, 409, { error: 'Email already exists' }); return true; }

    const { rows: existName } = await pool.query(
      `SELECT id FROM users WHERE lower("firstName" || ' ' || "lastName") = lower($1)`, [username]
    );
    if (existName.length) { sendJson(response, 409, { error: 'Username already exists' }); return true; }

    try {
      const { rows } = await pool.query(
        'INSERT INTO users ("firstName", "lastName", email, phone, password) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [firstName, lastName, email, phone, password]
      );
      sendJson(response, 201, { id: rows[0].id });
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
    const { rows } = await pool.query(
      'SELECT id, "firstName", "lastName", email, phone, password FROM users WHERE lower(email) = lower($1)',
      [email]
    );
    const userRow = rows[0];
    if (!userRow || userRow.password !== password) { sendJson(response, 200, { user: null }); return true; }
    sendJson(response, 200, { user: sanitizeUser(userRow) });
    return true;
  }

  if (pathname === '/api/admin/login') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '').trim();
    if (!email || !password) { sendJson(response, 400, { error: 'Email and password are required' }); return true; }
    const { rows } = await pool.query(
      'SELECT id, username, email, password FROM admins WHERE lower(email) = lower($1)',
      [email]
    );
    const adminRow = rows[0];
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
      await pool.query(
        `INSERT INTO bookings ("bookingCode","customerName","customerEmail","packageName","shootType","shootTypeName",room,"shootDate","bookingTime",duration,persons,theme,"themeName",services,notes,"totalPrice")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
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
        ]
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
      const { rows } = await pool.query(
        `INSERT INTO payments ("bookingCode","paymentMethod","payerName","payerPhone","paymentDate","paymentTime","paidAmount",note,"slipName")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          String(bookingCode || ''),
          String(paymentMethod || ''),
          String(payerName || ''),
          String(payerPhone || ''),
          String(paymentDate || ''),
          String(paymentTime || ''),
          Number(paidAmount || 0),
          String(note || ''),
          String(slipName || '')
        ]
      );
      sendJson(response, 201, { ok: true, id: rows[0].id });
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
      await pool.query(
        `INSERT INTO returns ("bookingCode","returnDate","roomCondition","equipmentNotes") VALUES ($1,$2,$3,$4)`,
        [String(bookingCode || ''), String(returnDate || ''), String(roomCondition || ''), String(equipmentNotes || '')]
      );
      sendJson(response, 201, { ok: true });
    } catch (error) {
      console.error('Return error:', error);
      sendJson(response, 500, { error: 'Could not save return record' });
    }
    return true;
  }

  if (pathname === '/api/admin/bookings/status') {
    const { bookingCode, status, adminMessage } = body;
    const allowed = ['pending', 'approved', 'active', 'completed', 'cancelled'];
    if (!bookingCode || !allowed.includes(status)) {
      sendJson(response, 400, { error: 'Invalid bookingCode or status' }); return true;
    }
    await pool.query(
      'UPDATE bookings SET status = $1, "adminMessage" = $2 WHERE "bookingCode" = $3',
      [status, adminMessage || null, bookingCode]
    );
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/payments/status') {
    const { id, status } = body;
    const allowed = ['pending_review', 'verified', 'rejected'];
    if (!id || !allowed.includes(status)) {
      sendJson(response, 400, { error: 'Invalid id or status' }); return true;
    }
    await pool.query('UPDATE payments SET status = $1 WHERE id = $2', [status, Number(id)]);
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/returns/status') {
    const { id, status } = body;
    const allowed = ['pending', 'completed'];
    if (!id || !allowed.includes(status)) {
      sendJson(response, 400, { error: 'Invalid id or status' }); return true;
    }
    await pool.query('UPDATE returns SET status = $1 WHERE id = $2', [status, Number(id)]);
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/users/update') {
    const { id, firstName, lastName, email, phone } = body;
    if (!id || !firstName || !lastName || !email || !phone) {
      sendJson(response, 400, { error: 'Missing fields' }); return true;
    }
    await pool.query(
      'UPDATE users SET "firstName"=$1,"lastName"=$2,email=$3,phone=$4 WHERE id=$5',
      [String(firstName), String(lastName), String(email).toLowerCase(), String(phone), Number(id)]
    );
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/users/delete') {
    const { id } = body;
    if (!id) { sendJson(response, 400, { error: 'id required' }); return true; }
    await pool.query('DELETE FROM users WHERE id = $1', [Number(id)]);
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/rooms/update') {
    const { id, name, description, capacity, status } = body;
    if (!id || !name) { sendJson(response, 400, { error: 'Missing fields' }); return true; }
    await pool.query(
      'UPDATE rooms SET name=$1,description=$2,capacity=$3,status=$4 WHERE id=$5',
      [String(name), String(description || ''), Number(capacity || 4), String(status || 'available'), String(id)]
    );
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/bookings/update') {
    const { id, customerName, room, shootDate, bookingTime, persons, themeName, totalPrice } = body;
    if (!id || !customerName || !room || !shootDate || !bookingTime) {
      sendJson(response, 400, { error: 'Missing fields' }); return true;
    }
    await pool.query(
      `UPDATE bookings SET "customerName"=$1,room=$2,"shootDate"=$3,"bookingTime"=$4,persons=$5,"themeName"=$6,"totalPrice"=$7 WHERE id=$8`,
      [String(customerName), String(room), String(shootDate), String(bookingTime), Number(persons || 1), String(themeName || ''), Number(totalPrice || 0), Number(id)]
    );
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/bookings/delete') {
    const { id } = body;
    if (!id) { sendJson(response, 400, { error: 'id required' }); return true; }
    await pool.query('DELETE FROM bookings WHERE id = $1', [Number(id)]);
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/payments/update') {
    const { id, payerName, payerPhone, paymentMethod, paidAmount } = body;
    if (!id || !payerName || !paymentMethod) { sendJson(response, 400, { error: 'Missing fields' }); return true; }
    await pool.query(
      `UPDATE payments SET "payerName"=$1,"payerPhone"=$2,"paymentMethod"=$3,"paidAmount"=$4 WHERE id=$5`,
      [String(payerName), String(payerPhone || ''), String(paymentMethod), Number(paidAmount || 0), Number(id)]
    );
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/payments/delete') {
    const { id } = body;
    if (!id) { sendJson(response, 400, { error: 'id required' }); return true; }
    await pool.query('DELETE FROM payments WHERE id = $1', [Number(id)]);
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/returns/update') {
    const { id, returnDate, roomCondition, equipmentNotes } = body;
    if (!id) { sendJson(response, 400, { error: 'id required' }); return true; }
    await pool.query(
      `UPDATE returns SET "returnDate"=$1,"roomCondition"=$2,"equipmentNotes"=$3 WHERE id=$4`,
      [String(returnDate || ''), String(roomCondition || ''), String(equipmentNotes || ''), Number(id)]
    );
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/returns/delete') {
    const { id } = body;
    if (!id) { sendJson(response, 400, { error: 'id required' }); return true; }
    await pool.query('DELETE FROM returns WHERE id = $1', [Number(id)]);
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
    await pool.query('UPDATE payments SET "slipPath" = $1 WHERE id = $2', [slipPath, Number(id)]);
    sendJson(response, 200, { ok: true, slipPath });
    return true;
  }

  if (pathname === '/api/admin/packages/update') {
    const { id, name, description, duration, features, old_price, new_price, badge, is_promo, sort_order } = body;
    if (!id || !name) { sendJson(response, 400, { error: 'Missing fields' }); return true; }
    await pool.query(
      'UPDATE packages SET name=$1,description=$2,duration=$3,features=$4,old_price=$5,new_price=$6,badge=$7,is_promo=$8,sort_order=$9 WHERE id=$10',
      [
        String(name), String(description || ''), String(duration || '3 ชั่วโมง'),
        JSON.stringify(Array.isArray(features) ? features : []),
        Number(old_price || 0), Number(new_price || 0),
        badge ? String(badge) : null, is_promo ? 1 : 0, Number(sort_order || 0), Number(id)
      ]
    );
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/packages/delete') {
    const { id } = body;
    if (!id) { sendJson(response, 400, { error: 'id required' }); return true; }
    await pool.query('DELETE FROM packages WHERE id = $1', [Number(id)]);
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
    await pool.query('UPDATE packages SET image = $1 WHERE id = $2', [imagePath, Number(id)]);
    sendJson(response, 200, { ok: true, image: imagePath });
    return true;
  }

  if (pathname === '/api/admin/themes/add') {
    const { slug, name, description, price, color1, color2, sort_order } = body;
    if (!slug || !name) { sendJson(response, 400, { error: 'Missing fields' }); return true; }
    try {
      const { rows } = await pool.query(
        'INSERT INTO themes (slug, name, description, price, color1, color2, sort_order, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,1) RETURNING id',
        [String(slug), String(name), String(description || ''), Number(price || 0), String(color1 || '#ffffff'), String(color2 || '#f0f0f0'), Number(sort_order || 0)]
      );
      sendJson(response, 201, { id: rows[0].id });
    } catch (e) {
      sendJson(response, 400, { error: 'Slug already exists' });
    }
    return true;
  }

  if (pathname === '/api/admin/themes/update') {
    const { id, name, description, price, color1, color2, sort_order, is_active } = body;
    if (!id || !name) { sendJson(response, 400, { error: 'Missing fields' }); return true; }
    await pool.query(
      'UPDATE themes SET name=$1,description=$2,price=$3,color1=$4,color2=$5,sort_order=$6,is_active=$7 WHERE id=$8',
      [String(name), String(description || ''), Number(price || 0), String(color1 || '#ffffff'), String(color2 || '#f0f0f0'), Number(sort_order || 0), is_active ? 1 : 0, Number(id)]
    );
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/admin/themes/delete') {
    const { id } = body;
    if (!id) { sendJson(response, 400, { error: 'id required' }); return true; }
    await pool.query('DELETE FROM themes WHERE id = $1', [Number(id)]);
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
    await pool.query('UPDATE themes SET image = $1 WHERE id = $2', [imagePath, Number(id)]);
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
    await pool.query('UPDATE rooms SET image = $1 WHERE id = $2', [imagePath, String(id)]);
    sendJson(response, 200, { ok: true, image: imagePath });
    return true;
  }

  return false;
}

function resolveFilePath(pathname) {
  let relativePath = pathname;
  const lowerPath = pathname.toLowerCase();
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
        const handled = await handleApi(request, response, url.pathname, url.searchParams);
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
  const listenHost = process.env.PORT ? '0.0.0.0' : HOST;
  initDB()
    .then(() => {
      const server = createServer();
      server.listen(PORT, listenHost, () => {
        console.log(`Server running at http://${listenHost}:${PORT}`);
      });
    })
    .catch(err => {
      console.error('Failed to initialize database:', err);
      process.exit(1);
    });
}
