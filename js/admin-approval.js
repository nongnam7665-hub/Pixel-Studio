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

function fmtDate(str) {
  if (!str) return '-';
  const [y, m, d] = String(str).split('T')[0].split('-');
  return (y && m && d) ? `${d}/${m}/${y}` : str;
}

function fmt(str) {
  if (!str) return '-';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function esc(s) { return String(s).replace(/'/g, "\\'"); }

async function loadApproval() {
  const [{ bookings = [] }, { payments = [] }] = await Promise.all([
    apiFetch('/api/admin/bookings'),
    apiFetch('/api/admin/payments'),
  ]);

  const paidCodes = new Set(payments.map(p => p.bookingCode));
  const pending = bookings.filter(b => b.status === 'pending' && paidCodes.has(b.bookingCode));
  const list = document.getElementById('approval-list');

  if (!pending.length) {
    list.innerHTML = '<p class="empty-cell" style="padding:32px;text-align:center;">ไม่มีรายการรอการอนุมัติ</p>';
    return;
  }

  list.innerHTML = pending.map(b => {
    const pays = payments.filter(p => p.bookingCode === b.bookingCode);
    const pay = pays.length ? pays[pays.length - 1] : null;

    const paySection = pay ? `
      <div class="approval-pay-row">
        <div class="approval-info-grid">
          <div class="approval-info-item"><span class="info-label">วิธีชำระ</span><span class="info-val">${pay.paymentMethod || '-'}</span></div>
          <div class="approval-info-item"><span class="info-label">จำนวนที่ชำระ</span><span class="info-val">${Number(pay.paidAmount).toLocaleString('th-TH')} บาท</span></div>
          <div class="approval-info-item"><span class="info-label">วันที่ชำระ</span><span class="info-val">${fmtDate(pay.paymentDate)}</span></div>
          <div class="approval-info-item"><span class="info-label">สถานะสลิป</span><span class="info-val">${{ pending_review:'รอตรวจสอบ', verified:'ยืนยันแล้ว', rejected:'ปฏิเสธ' }[pay.status] || pay.status}</span></div>
        </div>
        ${pay.slipPath ? `
        <div class="slip-preview-wrap">
          <img class="slip-preview-img" src="${getApiBase()}/api/payments/slip-image?id=${pay.id}" alt="สลิป"
            onclick="openSlip(${pay.id},'${esc(b.bookingCode)}','${esc(pay.payerName)}','${esc(pay.paymentDate||'')}',${pay.paidAmount})">
          <button class="btn-slip" onclick="openSlip(${pay.id},'${esc(b.bookingCode)}','${esc(pay.payerName)}','${esc(pay.paymentDate||'')}',${pay.paidAmount})">ดูสลิปเต็ม</button>
        </div>` : '<p style="color:#bbb;font-size:0.85rem;">ยังไม่มีสลิป</p>'}
      </div>` : `<p style="color:#bbb;font-size:0.85rem;padding:8px 0;">ยังไม่มีข้อมูลการชำระเงิน</p>`;

    return `
    <div class="approval-card">
      <div class="approval-card-header">
        <code class="booking-code">${b.bookingCode}</code>
        <span class="booking-date">เช่าเมื่อ ${fmt(b.createdAt)}</span>
      </div>

      <div class="approval-info-grid">
        <div class="approval-info-item"><span class="info-label">ชื่อผู้เช่า</span><span class="info-val">${b.customerName}</span></div>
        <div class="approval-info-item"><span class="info-label">ห้อง</span><span class="info-val">ห้อง ${b.room}</span></div>
        <div class="approval-info-item"><span class="info-label">วันที่ถ่าย</span><span class="info-val">${fmtDate(b.shootDate)}</span></div>
        <div class="approval-info-item"><span class="info-label">เวลา</span><span class="info-val">${b.bookingTime}</span></div>
        <div class="approval-info-item"><span class="info-label">จำนวนคน</span><span class="info-val">${b.persons || 1} ท่าน</span></div>
        <div class="approval-info-item"><span class="info-label">ธีม</span><span class="info-val">${b.themeName || '-'}</span></div>
        <div class="approval-info-item"><span class="info-label">ราคารวม</span><span class="info-val" style="color:#6a18d4;font-weight:700;">${Number(b.totalPrice).toLocaleString('th-TH')} บาท</span></div>
      </div>

      <div class="approval-pay-section">
        <h4 class="pay-section-title">ข้อมูลการชำระเงิน</h4>
        ${paySection}
      </div>

      <div class="approval-actions">
        <button class="btn-approve" onclick="updateBookingStatus('${b.bookingCode}','approved')">✓ อนุมัติ</button>
        <button class="btn-reject"  onclick="updateBookingStatus('${b.bookingCode}','cancelled')">✕ ปฏิเสธ</button>
      </div>
    </div>`;
  }).join('');
}

function openSlip(payId, bookingCode, payerName, paymentDate, paidAmount) {
  const url = `${getApiBase()}/api/payments/slip-image?id=${payId}`;
  const img = document.getElementById('slip-img');
  const noImg = document.getElementById('slip-no-img');
  document.getElementById('slip-modal-title').textContent = `สลิปการชำระเงิน — ${bookingCode}`;
  document.getElementById('slip-meta').innerHTML = `
    <strong>ผู้ชำระ:</strong> ${payerName}<br>
    <strong>วันที่ชำระ:</strong> ${fmtDate(paymentDate)}<br>
    <strong>จำนวน:</strong> ${Number(paidAmount).toLocaleString('th-TH')} บาท
  `;
  document.getElementById('slip-open-link').href = url;
  img.src = url;
  img.style.display = 'block';
  noImg.style.display = 'none';
  document.getElementById('slip-modal').classList.add('open');
}

function closeSlipModal() {
  document.getElementById('slip-modal').classList.remove('open');
  document.getElementById('slip-img').src = '';
}

function updateBookingStatus(bookingCode, status) {
  document.getElementById('msg-bookingCode').value = bookingCode;
  document.getElementById('msg-status').value = status;
  document.getElementById('msg-modal-title').textContent =
    status === 'approved' ? '✅ อนุมัติการเช่า' : '❌ ปฏิเสธการเช่า';
  document.getElementById('admin-message').value = '';
  document.getElementById('msg-modal').classList.add('open');
}

function closeMsgModal() {
  document.getElementById('msg-modal').classList.remove('open');
}

async function confirmStatus() {
  const bookingCode = document.getElementById('msg-bookingCode').value;
  const status = document.getElementById('msg-status').value;
  const adminMessage = document.getElementById('admin-message').value.trim();
  await apiFetch('/api/admin/bookings/status', 'POST', { bookingCode, status, adminMessage });
  closeMsgModal();
  loadApproval();
}

document.getElementById('msg-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('msg-modal')) closeMsgModal();
});
document.getElementById('slip-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('slip-modal')) closeSlipModal();
});

loadApproval();
