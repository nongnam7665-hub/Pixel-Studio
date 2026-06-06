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

let pendingImageData = null;

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

function addFeatureRow(value) {
  const list = document.getElementById('features-list');
  const row = document.createElement('div');
  row.className = 'feature-row';
  row.innerHTML = `
    <input type="text" placeholder="รายการ เช่น ✓ จำนวน 1 ท่าน" value="${esc(value)}">
    <button type="button" class="btn-remove-feature" onclick="this.parentElement.remove()">✕</button>
  `;
  list.appendChild(row);
}

function getFeatures() {
  return Array.from(document.querySelectorAll('#features-list .feature-row input'))
    .map(i => i.value.trim())
    .filter(v => v);
}

async function loadPackages() {
  const { packages = [] } = await apiFetch('/api/admin/packages');
  const grid = document.getElementById('packages-grid');
  if (!packages.length) { grid.innerHTML = '<p class="empty-cell">ไม่มีข้อมูลแพ็กเกจ</p>'; return; }
  grid.innerHTML = packages.map(p => {
    const features = safeParseFeatures(p.features);
    return `
      <div class="pkg-card">
        <div class="pkg-img-wrap">
          ${p.image
            ? `<img src="${getApiBase()}/${p.image}" alt="${esc(p.name)}">`
            : `<div class="pkg-img-placeholder">🎞️</div>`
          }
          ${p.badge ? `<div class="pkg-badge-wrap"><span class="room-badge">${esc(p.badge)}</span></div>` : ''}
        </div>
        <div class="pkg-card-body">
          <h3>${esc(p.name)}</h3>
          <p class="pkg-duration">ระยะเวลา: ${esc(p.duration || '-')}</p>
          <p>${esc(p.description || '-')}</p>
          <ul style="padding-left:16px; color:#7d3fab; font-size:0.83rem; line-height:1.8;">
            ${features.map(f => `<li>${esc(f)}</li>`).join('')}
          </ul>
          <div class="pkg-price-row">
            <span class="pkg-old-price">${Number(p.old_price).toLocaleString('th-TH')} บาท</span>
            <span class="pkg-new-price">${Number(p.new_price).toLocaleString('th-TH')} บาท</span>
          </div>
          <div class="pkg-card-footer">
            <span class="promo-tag ${p.is_promo ? 'active' : ''}">${p.is_promo ? 'โปรโมชั่น' : 'ไม่แสดงโปรโมชั่น'}</span>
            <button class="action-btn edit" onclick="openEdit(${p.id}, ${JSON.stringify(p).replace(/</g,'&lt;').replace(/"/g,'&quot;')})">แก้ไข</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function safeParseFeatures(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function openAddPackage() {
  document.getElementById('pkg-modal-title').textContent = 'เพิ่มแพ็กเกจใหม่';
  document.getElementById('edit-id').value = '';
  document.getElementById('edit-name').value = '';
  document.getElementById('edit-description').value = '';
  document.getElementById('edit-duration').value = '3 ชั่วโมง';
  document.getElementById('edit-old-price').value = '0';
  document.getElementById('edit-new-price').value = '0';
  document.getElementById('edit-badge').value = '';
  document.getElementById('edit-is-promo').checked = false;
  document.getElementById('edit-sort-order').value = '0';
  document.getElementById('file-input').value = '';
  document.getElementById('features-list').innerHTML = '';
  pendingImageData = null;
  document.getElementById('img-preview').src = '';
  document.getElementById('img-preview').classList.remove('visible');
  document.getElementById('upload-placeholder').style.display = 'block';
  document.getElementById('modal').classList.add('open');
}

function openEdit(id, pkg) {
  document.getElementById('pkg-modal-title').textContent = 'แก้ไขแพ็กเกจ';
  document.getElementById('edit-id').value = id;
  document.getElementById('edit-name').value = pkg.name || '';
  document.getElementById('edit-description').value = pkg.description || '';
  document.getElementById('edit-duration').value = pkg.duration || '3 ชั่วโมง';
  document.getElementById('edit-old-price').value = pkg.old_price || 0;
  document.getElementById('edit-new-price').value = pkg.new_price || 0;
  document.getElementById('edit-badge').value = pkg.badge || '';
  document.getElementById('edit-is-promo').checked = !!pkg.is_promo;
  document.getElementById('edit-sort-order').value = pkg.sort_order || 0;
  document.getElementById('file-input').value = '';
  pendingImageData = null;

  const preview = document.getElementById('img-preview');
  const placeholder = document.getElementById('upload-placeholder');
  if (pkg.image) {
    preview.src = `${getApiBase()}/${pkg.image}`;
    preview.classList.add('visible');
    placeholder.style.display = 'none';
  } else {
    preview.src = '';
    preview.classList.remove('visible');
    placeholder.style.display = 'block';
  }

  const list = document.getElementById('features-list');
  list.innerHTML = '';
  const features = safeParseFeatures(pkg.features);
  features.forEach(f => addFeatureRow(f));

  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  pendingImageData = null;
}

async function savePackage() {
  const id = document.getElementById('edit-id').value;
  const isAdd = !id;
  const name = document.getElementById('edit-name').value.trim();
  if (!name) { alert('กรุณากรอกชื่อแพ็กเกจ'); return; }

  const payload = {
    name,
    description: document.getElementById('edit-description').value.trim(),
    duration: document.getElementById('edit-duration').value.trim(),
    old_price: Number(document.getElementById('edit-old-price').value),
    new_price: Number(document.getElementById('edit-new-price').value),
    badge: document.getElementById('edit-badge').value.trim(),
    is_promo: document.getElementById('edit-is-promo').checked,
    sort_order: Number(document.getElementById('edit-sort-order').value),
    features: getFeatures(),
  };

  let savedId;
  if (isAdd) {
    const result = await apiFetch('/api/admin/packages/add', 'POST', payload);
    savedId = result.id;
  } else {
    savedId = Number(id);
    await apiFetch('/api/admin/packages/update', 'POST', { id: savedId, ...payload });
  }

  if (pendingImageData && savedId) {
    await apiFetch('/api/admin/packages/image', 'POST', { id: savedId, imageData: pendingImageData });
  }

  closeModal();
  loadPackages();
}

document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal')) closeModal();
});

loadPackages();
