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
  completed: ['เสร็จสิ้น',   'badge-completed'],
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

async function loadReturns() {
  const { returns = [] } = await apiFetch('/api/admin/returns');
  const tbody = document.getElementById('returns-tbody');
  if (!returns.length) { tbody.innerHTML = emptyRow(6, 'ไม่มีข้อมูลการคืนห้อง'); return; }
  tbody.innerHTML = returns.map(r => `
    <tr>
      <td><code>${r.bookingCode}</code></td>
      <td>${fmtDate(r.returnDate)}</td>
      <td>${r.roomCondition || '-'}</td>
      <td>${r.equipmentNotes || '-'}</td>
      <td>${badge(r.status === 'completed' ? 'completed' : 'pending')}</td>
      <td>
        ${r.status !== 'completed' ? `<button class="action-btn approve" onclick="completeReturn(${r.id})">ยืนยันการคืน</button>` : ''}
        <button class="action-btn edit" onclick="openEdit(${r.id},'${esc(r.returnDate||'')}','${esc(r.roomCondition||'')}','${esc(r.equipmentNotes||'')}')">แก้ไข</button>
        <button class="action-btn delete" onclick="deleteReturn(${r.id})">ลบ</button>
      </td>
    </tr>`).join('');
}

function setEditDate(displayId, hiddenId, isoDate) {
  const clean = isoDate ? String(isoDate).split('T')[0] : '';
  const parts = clean.split('-');
  document.getElementById(displayId).value = (parts.length === 3 && parts[0]) ? `${parts[2]}/${parts[1]}/${parts[0]}` : '';
  document.getElementById(hiddenId).value = clean;
}

function openEdit(id, returnDate, roomCondition, equipmentNotes) {
  document.getElementById('edit-id').value = id;
  setEditDate('edit-returnDateDisplay', 'edit-returnDate', returnDate);
  document.getElementById('edit-roomCondition').value = roomCondition || 'ดี';
  document.getElementById('edit-equipmentNotes').value = equipmentNotes;
  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

async function saveReturn() {
  const id = document.getElementById('edit-id').value;
  const returnDate = document.getElementById('edit-returnDate').value;
  const roomCondition = document.getElementById('edit-roomCondition').value;
  const equipmentNotes = document.getElementById('edit-equipmentNotes').value.trim();
  await apiFetch('/api/admin/returns/update', 'POST', { id: Number(id), returnDate, roomCondition, equipmentNotes });
  closeModal();
  loadReturns();
}

async function completeReturn(id) {
  await apiFetch('/api/admin/returns/status', 'POST', { id, status: 'completed' });
  loadReturns();
}

async function deleteReturn(id) {
  if (!confirm('ต้องการลบรายการคืนห้องนี้ใช่หรือไม่?')) return;
  await apiFetch('/api/admin/returns/delete', 'POST', { id });
  loadReturns();
}

document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal')) closeModal();
});

document.getElementById('edit-returnDateDisplay').addEventListener('input', function() {
  let digits = this.value.replace(/\D/g, '').slice(0, 8);
  let v = digits;
  if (digits.length > 2) v = digits.slice(0,2) + '/' + digits.slice(2);
  if (digits.length > 4) v = digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4);
  this.value = v;
  document.getElementById('edit-returnDate').value = digits.length === 8
    ? `${digits.slice(4,8)}-${digits.slice(2,4)}-${digits.slice(0,2)}` : '';
});

loadReturns();
