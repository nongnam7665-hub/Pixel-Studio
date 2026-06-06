const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
if (!currentUser || currentUser.role !== 'admin') {
  window.location.href = 'index.html';
} else {
  document.getElementById('adminName').textContent = currentUser.username || 'ผู้ดูแลระบบ';
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('currentUser');
  window.location.href = 'index.html';
});

function getApiBase() {
  const { protocol, hostname, port, origin } = window.location;
  if (protocol === 'file:') return 'http://127.0.0.1:3000';
  if ((hostname === '127.0.0.1' || hostname === 'localhost') && port && port !== '3000')
    return `${protocol}//${hostname}:3000`;
  return origin;
}

async function apiFetch(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(getApiBase() + path, opts);
  return res.json();
}

const STATUS_MAP = {
  pending:   ['รอดำเนินการ', 'badge-pending'],
  approved:  ['อนุมัติแล้ว',  'badge-approved'],
  active:    ['กำลังใช้งาน', 'badge-active'],
  completed: ['เสร็จสิ้น',    'badge-completed'],
  cancelled: ['ยกเลิก',       'badge-cancelled'],
};

function badge(status) {
  const [label, cls] = STATUS_MAP[status] || [status, 'badge-pending'];
  return `<span class="badge ${cls}">${label}</span>`;
}

function emptyRow(cols, msg) {
  return `<tr><td colspan="${cols}" class="empty-cell">${msg}</td></tr>`;
}

function fmtDate(str) {
  if (!str) return '-';
  const [y, m, d] = String(str).split('T')[0].split('-');
  return (y && m && d) ? `${d}/${m}/${y}` : str;
}

function esc(s) { return String(s).replace(/'/g, "\\'"); }

function buildEndTime(shootDate, bookingTime, durationHours) {
  const match = String(bookingTime).match(/(\d{1,2}):(\d{2})/);
  if (!match || !shootDate) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const dateStr = String(shootDate).split('T')[0];
  const start = new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
  const dur = parseInt(durationHours, 10);
  if (isNaN(dur) || dur <= 0) return null;
  return new Date(start.getTime() + dur * 3600_000);
}

function fmtCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

function fmtTime12(date) {
  if (!date) return '';
  const h = date.getHours(), m = date.getMinutes();
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} น.`;
}

const _intervals = {};
const _autoReturned = new Set();

function clearAllIntervals() {
  Object.values(_intervals).forEach(clearInterval);
  for (const k in _intervals) delete _intervals[k];
}

function startCountdown(b, endTime) {
  const code = b.bookingCode;
  const durMs = (parseInt(b.duration, 10) || 1) * 3600_000;

  function tick() {
    const now = Date.now();
    const remaining = endTime.getTime() - now;
    const elapsed = durMs - remaining;

    const timerEl = document.getElementById('cd-' + code);
    const barEl   = document.getElementById('bar-' + code);

    if (!timerEl) { clearInterval(_intervals[code]); return; }

    if (remaining <= 0) {
      timerEl.textContent = 'หมดเวลา';
      timerEl.className = 'cd-timer cd-done';
      if (barEl) { barEl.style.width = '100%'; barEl.style.background = '#dc3545'; }
      clearInterval(_intervals[code]);
      autoTriggerReturn(b);
      return;
    }

    timerEl.textContent = fmtCountdown(remaining);

    const fraction = remaining / durMs;
    if (fraction > 0.5)       timerEl.className = 'cd-timer cd-green';
    else if (fraction > 0.2)  timerEl.className = 'cd-timer cd-yellow';
    else                       timerEl.className = 'cd-timer cd-red';

    if (barEl) {
      const pct = Math.min(100, Math.round((elapsed / durMs) * 100));
      barEl.style.width = pct + '%';
      if (fraction > 0.5)      barEl.style.background = '#27b35c';
      else if (fraction > 0.2) barEl.style.background = '#f0ad4e';
      else                      barEl.style.background = '#dc3545';
    }
  }

  tick();
  _intervals[code] = setInterval(tick, 1000);
}

async function autoTriggerReturn(b) {
  if (_autoReturned.has(b.bookingCode)) return;
  _autoReturned.add(b.bookingCode);

  await apiFetch('/api/admin/bookings/status', 'POST', { bookingCode: b.bookingCode, status: 'completed' });

  const today = new Date();
  const returnDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  await apiFetch('/api/returns', 'POST', {
    bookingCode: b.bookingCode,
    returnDate,
    roomCondition: 'ดี',
    equipmentNotes: 'คืนห้องอัตโนมัติเมื่อครบกำหนด',
  });

  const rowEl = document.getElementById('row-' + b.bookingCode);
  if (rowEl) rowEl.classList.add('auto-returned-row');
  setTimeout(() => loadStatus(), 2000);
}

async function loadStatus() {
  clearAllIntervals();
  const { bookings = [] } = await apiFetch('/api/admin/bookings');
  const count = (s) => bookings.filter(b => b.status === s).length;

  document.getElementById('stat-cards').innerHTML = `
    <div class="stat-card s-pending"><div class="stat-num">${count('pending')}</div><div>รอดำเนินการ</div></div>
    <div class="stat-card s-approved"><div class="stat-num">${count('approved')}</div><div>อนุมัติแล้ว</div></div>
    <div class="stat-card s-active"><div class="stat-num">${count('active')}</div><div>กำลังใช้งาน</div></div>
    <div class="stat-card s-completed"><div class="stat-num">${count('completed')}</div><div>เสร็จสิ้น</div></div>
    <div class="stat-card s-cancelled"><div class="stat-num">${count('cancelled')}</div><div>ยกเลิก</div></div>`;

  const tbody = document.getElementById('status-tbody');
  if (!bookings.length) { tbody.innerHTML = emptyRow(9, 'ไม่มีข้อมูล'); return; }

  tbody.innerHTML = bookings.map(b => {
    const endTime = buildEndTime(b.shootDate, b.bookingTime, b.duration);
    const isActive = b.status === 'active';
    const dur = parseInt(b.duration, 10);
    const durLabel = dur > 0 ? `${dur} ชม.` : '-';

    let cdCell = '';
    if (isActive && endTime) {
      cdCell = `
        <td class="countdown-cell">
          <span class="cd-timer cd-green" id="cd-${b.bookingCode}">--:--:--</span>
          <span class="end-time-label">คืนห้อง ${fmtTime12(endTime)}</span>
          <div class="cd-bar-wrap">
            <div class="cd-bar" id="bar-${b.bookingCode}" style="width:0%;background:#27b35c"></div>
          </div>
        </td>`;
    } else if (isActive) {
      cdCell = `<td class="countdown-cell"><span class="cd-na">ไม่มีข้อมูลเวลา</span></td>`;
    } else {
      cdCell = `<td class="countdown-cell"><span class="cd-na">-</span></td>`;
    }

    return `
    <tr id="row-${b.bookingCode}">
      <td><code>${b.bookingCode}</code></td>
      <td>${b.customerName}</td>
      <td>ห้อง ${b.room}</td>
      <td>${fmtDate(b.shootDate)}</td>
      <td>${b.bookingTime}<br><small style="color:#9b6bc5;">${durLabel}</small></td>
      ${cdCell}
      <td>${isActive && endTime && Date.now() > endTime.getTime() ? '<span class="badge badge-cancelled">หมดเวลา</span>' : badge(b.status)}</td>
      <td>
        <button class="action-btn approve" onclick="updateBookingStatus('${b.bookingCode}','active')">กำลังใช้งาน</button>
        <button class="action-btn edit" onclick="completeAndReturn('${b.bookingCode}')">หมดเวลา</button>
      </td>
      <td>
        <button class="action-btn edit" onclick="openEdit(${b.id},'${esc(b.customerName)}','${b.room}','${b.shootDate}','${esc(b.bookingTime)}',${b.persons||1},'${esc(b.themeName||'')}',${b.totalPrice})">แก้ไข</button>
        <button class="action-btn delete" onclick="deleteBooking(${b.id},'${esc(b.bookingCode)}')">ลบ</button>
      </td>
    </tr>`;
  }).join('');

  bookings.forEach(b => {
    if (b.status !== 'active') return;
    const endTime = buildEndTime(b.shootDate, b.bookingTime, b.duration);
    if (endTime) startCountdown(b, endTime);
  });
}

function setEditDate(displayId, hiddenId, isoDate) {
  const clean = isoDate ? String(isoDate).split('T')[0] : '';
  document.getElementById(hiddenId).value = clean;
  if (clean) {
    const [y, m, d] = clean.split('-');
    document.getElementById(displayId).value = `${d}/${m}/${y}`;
  } else {
    document.getElementById(displayId).value = '';
  }
}

function openEdit(id, customerName, room, shootDate, bookingTime, persons, themeName, totalPrice) {
  document.getElementById('edit-id').value = id;
  document.getElementById('edit-customerName').value = customerName;
  document.getElementById('edit-room').value = room;
  setEditDate('edit-shootDateDisplay', 'edit-shootDate', shootDate);
  document.getElementById('edit-bookingTime').value = bookingTime;
  document.getElementById('edit-persons').value = persons;
  document.getElementById('edit-themeName').value = themeName;
  document.getElementById('edit-totalPrice').value = totalPrice;
  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

async function saveBooking() {
  const id = document.getElementById('edit-id').value;
  const customerName = document.getElementById('edit-customerName').value.trim();
  const room = document.getElementById('edit-room').value;
  const shootDate = document.getElementById('edit-shootDate').value;
  const bookingTime = document.getElementById('edit-bookingTime').value.trim();
  const persons = Number(document.getElementById('edit-persons').value);
  const themeName = document.getElementById('edit-themeName').value.trim();
  const totalPrice = Number(document.getElementById('edit-totalPrice').value);
  if (!customerName || !shootDate || !bookingTime) { alert('กรุณากรอกข้อมูลให้ครบ'); return; }
  await apiFetch('/api/admin/bookings/update', 'POST', { id: Number(id), customerName, room, shootDate, bookingTime, persons, themeName, totalPrice });
  closeModal();
  loadStatus();
}

async function updateBookingStatus(bookingCode, status) {
  await apiFetch('/api/admin/bookings/status', 'POST', { bookingCode, status });
  loadStatus();
}

async function completeAndReturn(bookingCode) {
  if (!confirm(`ยืนยันคืนห้อง ${bookingCode} และเปลี่ยนสถานะเป็นเสร็จสิ้น?`)) return;
  await apiFetch('/api/admin/bookings/status', 'POST', { bookingCode, status: 'completed' });
  const today = new Date();
  const returnDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  await apiFetch('/api/returns', 'POST', {
    bookingCode,
    returnDate,
    roomCondition: 'ดี',
    equipmentNotes: 'คืนห้องโดยผู้ดูแลระบบ',
  });
  loadStatus();
}

async function deleteBooking(id, bookingCode) {
  if (!confirm(`ต้องการลบประวัติการจอง ${bookingCode} ใช่หรือไม่?\nการลบจะไม่สามารถกู้คืนได้`)) return;
  await apiFetch('/api/admin/bookings/delete', 'POST', { id });
  loadStatus();
}

document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal')) closeModal();
});

document.getElementById('edit-shootDateDisplay').addEventListener('input', function() {
  let digits = this.value.replace(/\D/g, '').slice(0, 8);
  let v = digits;
  if (digits.length > 2) v = digits.slice(0,2) + '/' + digits.slice(2);
  if (digits.length > 4) v = digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4);
  this.value = v;
  if (digits.length === 8) {
    document.getElementById('edit-shootDate').value = `${digits.slice(4,8)}-${digits.slice(2,4)}-${digits.slice(0,2)}`;
  } else {
    document.getElementById('edit-shootDate').value = '';
  }
});

loadStatus();
