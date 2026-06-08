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
  pending_review: ['รอตรวจสอบ', 'badge-pending'],
  verified:       ['ยืนยันแล้ว', 'badge-approved'],
  rejected:       ['ปฏิเสธ',     'badge-cancelled'],
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

async function loadPayments() {
  const { payments = [] } = await apiFetch('/api/admin/payments');
  const tbody = document.getElementById('payments-tbody');
  if (!payments.length) { tbody.innerHTML = emptyRow(9, 'ไม่มีข้อมูลการชำระเงิน'); return; }
  tbody.innerHTML = payments.map(p => {
    const slipCell = p.slipPath
      ? `<td><img class="slip-thumb" src="${getApiBase()}/${p.slipPath}" alt="สลิป"
             onclick="openSlip(${p.id},'${esc(p.slipPath)}','${esc(p.bookingCode)}','${esc(p.payerName)}','${esc(p.paymentDate||'')}',${p.paidAmount})"></td>`
      : `<td><span style="color:#bbb;font-size:0.8rem;">ไม่มีสลิป</span></td>`;
    return `
    <tr>
      <td><code>${p.bookingCode}</code></td>
      <td>${p.payerName}</td>
      <td>${p.payerPhone || '-'}</td>
      <td>${p.paymentMethod}</td>
      <td>${Number(p.paidAmount).toLocaleString('th-TH')}</td>
      <td>${fmtDate(p.paymentDate)}</td>
      ${slipCell}
      <td>${badge(p.status)}</td>
      <td>
        ${p.slipPath ? `<button class="btn-slip" onclick="openSlip(${p.id},'${esc(p.slipPath)}','${esc(p.bookingCode)}','${esc(p.payerName)}','${esc(p.paymentDate||'')}',${p.paidAmount})">ดูสลิป</button>` : ''}
        ${p.status === 'pending_review' ? `
          <button class="action-btn approve" onclick="updatePaymentStatus(${p.id},'verified')">ยืนยัน</button>
          <button class="action-btn reject"  onclick="updatePaymentStatus(${p.id},'rejected')">ปฏิเสธ</button>` : ''}
        <button class="action-btn edit" onclick="openEdit(${p.id},'${esc(p.payerName)}','${esc(p.payerPhone||'')}','${esc(p.paymentMethod)}',${p.paidAmount})">แก้ไข</button>
        <button class="action-btn delete" onclick="deletePayment(${p.id})">ลบ</button>
      </td>
    </tr>`;
  }).join('');
}

function openSlip(id, slipPath, bookingCode, payerName, paymentDate, paidAmount) {
  const url = `${getApiBase()}/${slipPath}`;
  const isPdf = slipPath.toLowerCase().endsWith('.pdf');
  const img = document.getElementById('slip-img');
  const noImg = document.getElementById('slip-no-img');
  document.getElementById('slip-modal-title').textContent = `สลิปการชำระเงิน — ${bookingCode}`;
  document.getElementById('slip-meta').innerHTML = `
    <strong>ผู้ชำระ:</strong> ${payerName}<br>
    <strong>วันที่ชำระ:</strong> ${fmtDate(paymentDate)}<br>
    <strong>จำนวน:</strong> ${Number(paidAmount).toLocaleString('th-TH')} บาท
  `;
  document.getElementById('slip-open-link').href = url;
  if (isPdf) {
    img.style.display = 'none';
    noImg.style.display = 'block';
    noImg.textContent = 'ไฟล์ PDF — กดปุ่ม "เปิดในแท็บใหม่" เพื่อดู';
  } else {
    img.src = url;
    img.style.display = 'block';
    noImg.style.display = 'none';
  }
  document.getElementById('slip-modal').classList.add('open');
}

function closeSlipModal() {
  document.getElementById('slip-modal').classList.remove('open');
  document.getElementById('slip-img').src = '';
}

function openEdit(id, payerName, payerPhone, paymentMethod, paidAmount) {
  document.getElementById('edit-id').value = id;
  document.getElementById('edit-payerName').value = payerName;
  document.getElementById('edit-payerPhone').value = payerPhone;
  document.getElementById('edit-paymentMethod').value = paymentMethod;
  document.getElementById('edit-paidAmount').value = paidAmount;
  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

async function savePayment() {
  const id = document.getElementById('edit-id').value;
  const payerName = document.getElementById('edit-payerName').value.trim();
  const payerPhone = document.getElementById('edit-payerPhone').value.trim();
  const paymentMethod = document.getElementById('edit-paymentMethod').value;
  const paidAmount = Number(document.getElementById('edit-paidAmount').value);
  if (!payerName) { alert('กรุณากรอกชื่อผู้ชำระ'); return; }
  await apiFetch('/api/admin/payments/update', 'POST', { id: Number(id), payerName, payerPhone, paymentMethod, paidAmount });
  closeModal();
  loadPayments();
}

async function updatePaymentStatus(id, status) {
  await apiFetch('/api/admin/payments/status', 'POST', { id, status });
  loadPayments();
}

async function deletePayment(id) {
  if (!confirm('ต้องการลบรายการชำระเงินนี้ใช่หรือไม่?')) return;
  await apiFetch('/api/admin/payments/delete', 'POST', { id });
  loadPayments();
}

document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal')) closeModal();
});
document.getElementById('slip-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('slip-modal')) closeSlipModal();
});

document.getElementById('btn-close-slip').addEventListener('click', closeSlipModal);
document.getElementById('btn-cancel').addEventListener('click', closeModal);
document.getElementById('btn-save').addEventListener('click', savePayment);

loadPayments();
