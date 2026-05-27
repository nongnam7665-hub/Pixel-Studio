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

function fmtDate(str) {
  if (!str) return '-';
  const [y, m, d] = String(str).split('T')[0].split('-');
  return (y && m && d) ? `${d}/${m}/${y}` : str;
}

function esc(s) { return String(s).replace(/'/g, "\\'"); }

async function loadApproval() {
  const [{ bookings = [] }, { payments = [] }] = await Promise.all([
    apiFetch('/api/admin/bookings'),
    apiFetch('/api/admin/payments'),
  ]);

  const pending = bookings.filter(b => b.status === 'pending');
  const tbody = document.getElementById('approval-tbody');
  if (!pending.length) { tbody.innerHTML = emptyRow(9, 'ไม่มีรายการรอการอนุมัติ'); return; }

  tbody.innerHTML = pending.map(b => {
    const pays = payments.filter(p => p.bookingCode === b.bookingCode);
    const latestPay = pays.length ? pays[pays.length - 1] : null;

    let payCell = `<td><span class="payment-pill pay-none">ยังไม่ชำระ</span></td>`;
    if (latestPay) {
      const statusLabel = { pending_review: 'รอตรวจสอบ', verified: 'ยืนยันแล้ว', rejected: 'ปฏิเสธ' };
      const statusClass = { pending_review: 'pay-pending', verified: 'pay-verified', rejected: 'pay-rejected' };
      const pill = `<span class="payment-pill ${statusClass[latestPay.status] || 'pay-pending'}">${statusLabel[latestPay.status] || latestPay.status}</span>`;
      const slipUrl = latestPay.id ? `${getApiBase()}/api/payments/slip-image?id=${latestPay.id}` : '';
      const slipBtn = latestPay.slipPath
        ? `<button class="btn-slip" style="margin-top:4px;" onclick="openSlip('${latestPay.id}','${esc(b.bookingCode)}','${esc(latestPay.payerName)}','${esc(latestPay.paymentDate||'')}',${latestPay.paidAmount})">ดูสลิป</button>`
        : `<span style="font-size:0.75rem;color:#bbb;display:block;margin-top:2px;">ไม่มีสลิป</span>`;
      payCell = `<td style="vertical-align:top;">
        ${pill}<br>
        <small style="color:#9b6bc5;">${Number(latestPay.paidAmount).toLocaleString('th-TH')} บาท</small><br>
        ${slipBtn}
        ${slipUrl ? `<img class="slip-thumb" style="margin-top:6px;" src="${slipUrl}" alt="สลิป"
          onclick="openSlip('${latestPay.id}','${esc(b.bookingCode)}','${esc(latestPay.payerName)}','${esc(latestPay.paymentDate||'')}',${latestPay.paidAmount})">` : ''}
      </td>`;
    }

    return `
    <tr>
      <td><code>${b.bookingCode}</code></td>
      <td>${b.customerName}</td>
      <td>ห้อง ${b.room}</td>
      <td>${fmtDate(b.shootDate)}</td>
      <td>${b.bookingTime}</td>
      <td>${Number(b.totalPrice).toLocaleString('th-TH')}</td>
      ${payCell}
      <td>${fmt(b.createdAt)}</td>
      <td>
        <button class="action-btn approve" onclick="updateBookingStatus('${b.bookingCode}','approved')">อนุมัติ</button>
        <button class="action-btn reject"  onclick="updateBookingStatus('${b.bookingCode}','cancelled')">ปฏิเสธ</button>
        <button class="action-btn edit" onclick="openEdit(${b.id},'${esc(b.customerName)}','${b.room}','${b.shootDate}','${esc(b.bookingTime)}',${b.persons||1},'${esc(b.themeName||'')}',${b.totalPrice})">แก้ไข</button>
      </td>
    </tr>`;
  }).join('');
}

function openSlip(paymentId, bookingCode, payerName, paymentDate, paidAmount) {
  const url = `${getApiBase()}/api/payments/slip-image?id=${paymentId}`;
  const isPdf = false; // ตรวจสอบจาก response header แทน
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
  loadApproval();
}

function updateBookingStatus(bookingCode, status) {
  document.getElementById('msg-bookingCode').value = bookingCode;
  document.getElementById('msg-status').value = status;
  document.getElementById('msg-modal-title').textContent =
    status === 'approved' ? '✅ อนุมัติการจอง' : '❌ ปฏิเสธการจอง';
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

document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal')) closeModal();
});
document.getElementById('msg-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('msg-modal')) closeMsgModal();
});
document.getElementById('slip-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('slip-modal')) closeSlipModal();
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

loadApproval();
