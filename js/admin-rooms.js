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
  approved:  ['พร้อมใช้งาน', 'badge-approved'],
  cancelled: ['ปิดใช้งาน',   'badge-cancelled'],
};

function badge(status) {
  const [label, cls] = STATUS_MAP[status] || [status, 'badge-pending'];
  return `<span class="badge ${cls}">${label}</span>`;
}

let pendingImageData = null;
let roomsData = [];

function onFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    pendingImageData = e.target.result;
    const preview = document.getElementById('img-preview');
    const placeholder = document.getElementById('upload-placeholder');
    preview.src = pendingImageData;
    preview.classList.add('visible');
    placeholder.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

async function loadRooms() {
  const { rooms = [] } = await apiFetch('/api/admin/rooms');
  roomsData = rooms;
  const grid = document.getElementById('rooms-grid');
  if (!rooms.length) { grid.innerHTML = '<p class="empty-cell">ไม่มีข้อมูลห้อง</p>'; return; }
  grid.innerHTML = rooms.map(r => `
    <div class="room-card-admin">
      <div class="room-img-wrap">
        ${r.image
          ? `<img src="${getApiBase()}/${r.image}" alt="ห้อง ${r.id}">`
          : `<div class="room-img-placeholder">📷</div>`
        }
      </div>
      <div style="padding:16px; display:flex; flex-direction:column; gap:10px; flex:1;">
        <div class="room-badge">ห้อง ${r.id}</div>
        <h3>${escHtml(r.name)}</h3>
        <p>${escHtml(r.description || '-')}</p>
        <div class="room-stats">
          <span>ความจุ ${r.capacity} คน</span>
          <span>จองทั้งหมด ${r.totalBookings} ครั้ง</span>
          <span>กำลังใช้ ${r.activeBookings} ครั้ง</span>
        </div>
        <div class="room-card-footer">
          <div>${badge(r.status === 'available' ? 'approved' : 'cancelled')}</div>
          <button class="action-btn edit" onclick="openEdit('${r.id}')">แก้ไข</button>
        </div>
      </div>
    </div>`).join('');
}

function openEdit(id) {
  const r = roomsData.find(x => x.id === id);
  if (!r) return;

  document.getElementById('edit-id').value = r.id;
  document.getElementById('edit-name').value = r.name;
  document.getElementById('edit-description').value = r.description || '';
  document.getElementById('edit-capacity').value = r.capacity;
  document.getElementById('edit-status').value = r.status;
  document.getElementById('file-input').value = '';
  pendingImageData = null;

  const preview = document.getElementById('img-preview');
  const placeholder = document.getElementById('upload-placeholder');

  if (r.image) {
    preview.src = `${getApiBase()}/${r.image}`;
    preview.classList.add('visible');
    placeholder.style.display = 'none';
  } else {
    preview.src = '';
    preview.classList.remove('visible');
    placeholder.style.display = 'block';
  }

  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  pendingImageData = null;
}

async function saveRoom() {
  const id = document.getElementById('edit-id').value;
  const name = document.getElementById('edit-name').value.trim();
  const description = document.getElementById('edit-description').value.trim();
  const capacity = Number(document.getElementById('edit-capacity').value);
  const status = document.getElementById('edit-status').value;
  if (!name) { alert('กรุณากรอกชื่อห้อง'); return; }

  await apiFetch('/api/admin/rooms/update', 'POST', { id, name, description, capacity, status });

  if (pendingImageData) {
    await apiFetch('/api/admin/rooms/image', 'POST', { id, imageData: pendingImageData });
  }

  closeModal();
  loadRooms();
}

document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal')) closeModal();
});

document.getElementById('theme-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('theme-modal')) closeThemeModal();
});

// ── Themes management ─────────────────────────────────────────────

let themesData = [];
let pendingThemeImageData = null;

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function onThemeFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    pendingThemeImageData = e.target.result;
    const preview = document.getElementById('theme-img-preview');
    const placeholder = document.getElementById('theme-upload-placeholder');
    preview.src = pendingThemeImageData;
    preview.classList.add('visible');
    placeholder.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

async function loadThemes() {
  const { themes = [] } = await apiFetch('/api/admin/themes');
  themesData = themes;
  const grid = document.getElementById('themes-grid');
  if (!themes.length) { grid.innerHTML = '<p class="empty-cell">ไม่มีธีม</p>'; return; }
  grid.innerHTML = themes.map(t => {
    const preview = t.image
      ? `<div class="theme-card-preview" style="background-image:url(${getApiBase()}/${t.image});background-size:cover;background-position:center;"></div>`
      : `<div class="theme-card-preview" style="background:linear-gradient(135deg,${t.color1} 0%,${t.color2} 100%);"></div>`;
    const statusBadge = t.is_active
      ? `<span class="badge badge-approved">ใช้งาน</span>`
      : `<span class="badge badge-cancelled">ปิด</span>`;
    const price = Number(t.price) > 0 ? `+${Number(t.price).toLocaleString('th-TH')} บาท` : 'ฟรี';
    return `
      <div class="theme-card-admin">
        ${preview}
        <div class="theme-card-body">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <strong style="color:#5d22b2;">${escHtml(t.name)}</strong>${statusBadge}
          </div>
          <p>${escHtml(t.description || '')}</p>
          <span class="theme-price-tag">${price}</span>
          <div class="theme-card-actions">
            <button class="action-btn edit" onclick="openEditTheme(${t.id})">แก้ไข</button>
            <button class="action-btn delete" onclick="deleteTheme(${t.id},'${String(t.name).replace(/'/g,"\\'")}')">ลบ</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function setThemeColors(c1, c2) {
  document.getElementById('theme-color1-picker').value = c1;
  document.getElementById('theme-color1-text').value = c1;
  document.getElementById('theme-color2-picker').value = c2;
  document.getElementById('theme-color2-text').value = c2;
  updateThemePreview();
}

function updateThemePreview() {
  const c1 = document.getElementById('theme-color1-text').value || '#ffffff';
  const c2 = document.getElementById('theme-color2-text').value || '#f0f0f0';
  document.getElementById('theme-gradient-preview').style.background = `linear-gradient(135deg,${c1} 0%,${c2} 100%)`;
}

function openAddTheme() {
  document.getElementById('theme-modal-title').textContent = 'เพิ่มธีมใหม่';
  document.getElementById('theme-edit-id').value = '';
  document.getElementById('theme-slug-group').style.display = 'block';
  document.getElementById('theme-edit-slug').value = '';
  document.getElementById('theme-edit-name').value = '';
  document.getElementById('theme-edit-description').value = '';
  document.getElementById('theme-edit-price').value = '0';
  document.getElementById('theme-edit-sort').value = '0';
  document.getElementById('theme-edit-active').checked = true;
  setThemeColors('#ffffff', '#edf0f5');
  pendingThemeImageData = null;
  document.getElementById('theme-file-input').value = '';
  document.getElementById('theme-img-preview').src = '';
  document.getElementById('theme-img-preview').classList.remove('visible');
  document.getElementById('theme-upload-placeholder').style.display = 'block';
  document.getElementById('theme-modal').classList.add('open');
}

function openEditTheme(id) {
  const t = themesData.find(x => x.id === id);
  if (!t) return;
  document.getElementById('theme-modal-title').textContent = 'แก้ไขธีม';
  document.getElementById('theme-edit-id').value = t.id;
  document.getElementById('theme-slug-group').style.display = 'none';
  document.getElementById('theme-edit-name').value = t.name;
  document.getElementById('theme-edit-description').value = t.description || '';
  document.getElementById('theme-edit-price').value = t.price || 0;
  document.getElementById('theme-edit-sort').value = t.sort_order || 0;
  document.getElementById('theme-edit-active').checked = !!t.is_active;
  setThemeColors(t.color1 || '#ffffff', t.color2 || '#f0f0f0');
  pendingThemeImageData = null;
  document.getElementById('theme-file-input').value = '';
  const prev = document.getElementById('theme-img-preview');
  const plc = document.getElementById('theme-upload-placeholder');
  if (t.image) {
    prev.src = `${getApiBase()}/${t.image}`;
    prev.classList.add('visible');
    plc.style.display = 'none';
  } else {
    prev.src = '';
    prev.classList.remove('visible');
    plc.style.display = 'block';
  }
  document.getElementById('theme-modal').classList.add('open');
}

function closeThemeModal() {
  document.getElementById('theme-modal').classList.remove('open');
  pendingThemeImageData = null;
}

async function saveTheme() {
  const id = document.getElementById('theme-edit-id').value;
  const isAdd = !id;
  const name = document.getElementById('theme-edit-name').value.trim();
  const description = document.getElementById('theme-edit-description').value.trim();
  const price = Number(document.getElementById('theme-edit-price').value) || 0;
  const color1 = document.getElementById('theme-color1-text').value || '#ffffff';
  const color2 = document.getElementById('theme-color2-text').value || '#f0f0f0';
  const sort_order = Number(document.getElementById('theme-edit-sort').value) || 0;
  const is_active = document.getElementById('theme-edit-active').checked;
  if (!name) { alert('กรุณากรอกชื่อธีม'); return; }

  let savedId = id ? Number(id) : null;

  if (isAdd) {
    const slug = document.getElementById('theme-edit-slug').value.trim().toLowerCase().replace(/\s+/g,'-');
    if (!slug) { alert('กรุณากรอก Slug'); return; }
    if (!/^[a-z0-9-]+$/.test(slug)) { alert('Slug ต้องเป็น a-z, 0-9 และขีด - เท่านั้น'); return; }
    const result = await apiFetch('/api/admin/themes/add', 'POST', { slug, name, description, price, color1, color2, sort_order });
    if (result.error) { alert(result.error); return; }
    savedId = result.id;
  } else {
    await apiFetch('/api/admin/themes/update', 'POST', { id: Number(id), name, description, price, color1, color2, sort_order, is_active });
  }

  if (pendingThemeImageData && savedId) {
    await apiFetch('/api/admin/themes/image', 'POST', { id: savedId, imageData: pendingThemeImageData });
  }

  closeThemeModal();
  loadThemes();
}

async function deleteTheme(id, name) {
  if (!confirm(`ลบธีม "${name}" ออก?`)) return;
  await apiFetch('/api/admin/themes/delete', 'POST', { id });
  loadThemes();
}

loadRooms();
loadThemes();
