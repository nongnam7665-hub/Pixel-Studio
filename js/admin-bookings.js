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

async function loadBookings() {
  const { bookings = [] } = await apiFetch('/api/admin/bookings');
  const tbody = document.getElementById('bookings-tbody');
  if (!bookings.length) { tbody.innerHTML = emptyRow(10, 'ไม่มีข้อมูลการเช่า'); return; }
  tbody.innerHTML = bookings.map(b => `
    <tr>
      <td><code>${b.bookingCode}</code></td>
      <td>${b.customerName}</td>
      <td>ห้อง ${b.room}</td>
      <td>${fmtDate(b.shootDate)}</td>
      <td>${b.bookingTime}</td>
      <td>${b.themeName || '-'}</td>
      <td>${b.persons || 1}</td>
      <td>${Number(b.totalPrice).toLocaleString('th-TH')}</td>
      <td>${badge(b.status)}</td>
      <td>
        <button class="action-btn edit" onclick="openEdit(${b.id},'${esc(b.customerName)}','${b.room}','${b.shootDate}','${esc(b.bookingTime)}',${b.persons||1},'${esc(b.themeName||'')}',${b.totalPrice})">แก้ไข</button>
        <button class="action-btn delete" onclick="deleteBooking(${b.id})">ลบ</button>
      </td>
    </tr>`).join('');
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
  loadBookings();
}

async function deleteBooking(id) {
  if (!confirm('ต้องการลบรายการเช่านี้ใช่หรือไม่?')) return;
  await apiFetch('/api/admin/bookings/delete', 'POST', { id });
  loadBookings();
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

loadBookings();
