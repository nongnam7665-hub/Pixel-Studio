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

function fmt(str) {
  if (!str) return '-';
  const d = new Date(str);
  if (isNaN(d)) return str;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function emptyRow(cols, msg) {
  return `<tr><td colspan="${cols}" class="empty-cell">${msg}</td></tr>`;
}

async function loadUsers() {
  const { users = [] } = await apiFetch('/api/admin/users');
  const tbody = document.getElementById('users-tbody');
  if (!users.length) { tbody.innerHTML = emptyRow(7, 'ไม่มีข้อมูลสมาชิก'); return; }
  tbody.innerHTML = users.map((u, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${u.firstName}</td>
      <td>${u.lastName}</td>
      <td>${u.email}</td>
      <td>${u.phone}</td>
      <td>${fmt(u.createdAt)}</td>
      <td>
        <button class="action-btn edit" onclick="openEdit(${u.id},'${esc(u.firstName)}','${esc(u.lastName)}','${esc(u.email)}','${esc(u.phone)}')">แก้ไข</button>
        <button class="action-btn delete" onclick="deleteUser(${u.id})">ลบ</button>
      </td>
    </tr>`).join('');
}

function esc(s) { return String(s).replace(/'/g, "\\'"); }

function openEdit(id, firstName, lastName, email, phone) {
  document.getElementById('edit-id').value = id;
  document.getElementById('edit-firstName').value = firstName;
  document.getElementById('edit-lastName').value = lastName;
  document.getElementById('edit-email').value = email;
  document.getElementById('edit-phone').value = phone;
  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

async function saveUser() {
  const id = document.getElementById('edit-id').value;
  const firstName = document.getElementById('edit-firstName').value.trim();
  const lastName = document.getElementById('edit-lastName').value.trim();
  const email = document.getElementById('edit-email').value.trim();
  const phone = document.getElementById('edit-phone').value.trim();
  if (!firstName || !lastName || !email || !phone) { alert('กรุณากรอกข้อมูลให้ครบ'); return; }
  await apiFetch('/api/admin/users/update', 'POST', { id: Number(id), firstName, lastName, email, phone });
  closeModal();
  loadUsers();
}

async function deleteUser(id) {
  if (!confirm('ต้องการลบสมาชิกนี้ใช่หรือไม่?')) return;
  await apiFetch('/api/admin/users/delete', 'POST', { id });
  loadUsers();
}

document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal')) closeModal();
});

loadUsers();
