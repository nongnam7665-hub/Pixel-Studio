const booking = JSON.parse(localStorage.getItem('currentBooking') || 'null');
const summary = document.getElementById('bookingSummary');
const fullTotal = document.getElementById('fullTotal');
const depositAmount = document.getElementById('depositAmount');
const editBookingLink = document.getElementById('editBookingLink');
const paidAmount = document.getElementById('paidAmount');
const paymentDate = document.getElementById('paymentDate');
const payerName = document.getElementById('payerName');
const logoutLink = document.getElementById('logoutLink');
let latestReceiptFile = '';
let latestReceiptName = '';

const addonNames = {
    extra_scene: 'เพิ่มฉากการถ่ายภาพ',
    extra_person: 'เพิ่มจำนวนคน',
    makeup: 'บริการแต่งหน้าพิเศษ',
    extra_outfit: 'ชุดเสื้อผ้าเพิ่มเติม',
    backdrop: 'เปลี่ยนฉากหลัง',
    extended_time: 'ขยายเวลา',
    printing: 'พิมพ์ภาพถ่าย',
    album: 'อัลบั้มภาพ',
    usb: 'USB พร้อมกล่อง'
};

const serviceNames = {
    makeup: 'แต่งหน้าพิเศษ',
    outfit: 'จัดเสื้อผ้าพิเศษ',
    editing: 'ปรับแต่งภาพพิเศษ',
    printing: 'พิมพ์ภาพ 10 รูป',
    album: 'อัลบั้มภาพ',
    usb: 'USB พร้อมกล่อง'
};

if (!booking) {
    window.location.href = 'package.html';
} else {
    const totalText = booking.totalPrice || `${Number(booking.packagePrice || 0).toLocaleString('th-TH')} บาท`;
    const numericTotal = Number(String(totalText).replace(/[^\d]/g, ''));
    const depositValue = Math.round(numericTotal * 0.3);
    const depositText = `${depositValue.toLocaleString('th-TH')} บาท`;
    const packageId = booking.package || 'profile';
    const itemText = getAddonText();

    summary.innerHTML = `
        <p><span>แพ็กเกจ</span><strong>${booking.packageName || 'Studio Custom Package'}</strong></p>
        <p><span>ผู้จอง</span><strong>${booking.customerName || '-'}</strong></p>
        <p><span>วันที่ถ่าย</span><strong>${formatDate(booking.shootDate)}</strong></p>
        <p><span>เวลา</span><strong>${booking.bookingTime || '-'}</strong></p>
        ${booking.type === 'custom' ? `<p><span>ห้อง</span><strong>${booking.roomName || '-'}</strong></p>` : ''}
        ${booking.type === 'custom' ? `<p><span>ธีม</span><strong>${booking.themeName || '-'}</strong></p>` : ''}
        <p><span>รายการเสริม</span><strong>${itemText}</strong></p>
    `;
    fullTotal.textContent = totalText;
    depositAmount.textContent = depositText;
    paidAmount.value = depositValue || '';
    const _today = new Date();
    const _dd = String(_today.getDate()).padStart(2,'0');
    const _mm = String(_today.getMonth()+1).padStart(2,'0');
    const _yyyy = _today.getFullYear();
    document.getElementById('paymentDateDisplay').value = `${_dd}/${_mm}/${_yyyy}`;
    paymentDate.value = `${_yyyy}-${_mm}-${_dd}`;
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    payerName.value = currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() : (booking.customerName || '');
    const payerPhoneEl = document.getElementById('payerPhone');
    if (payerPhoneEl && currentUser && currentUser.phone) payerPhoneEl.value = currentUser.phone;
    editBookingLink.href = booking.type === 'custom' ? 'studio.html' : `checkout.html?package=${packageId}`;
}

document.querySelectorAll('input[name="paymentMethod"]').forEach((input) => {
    input.addEventListener('change', () => {
        document.body.dataset.method = input.value;
    });
});

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDateTime(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d)) return value;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function formatDate(value) {
    if (!value) return '-';
    const [y, m, d] = String(value).split('T')[0].split('-');
    if (!y || !m || !d) return value;
    return `${d}/${m}/${y}`;
}

function getReceiptNumber(receipt) {
    const rawId = receipt.submittedAt || new Date().toISOString();
    return `RC-${rawId.replace(/\D/g, '').slice(0, 14)}`;
}

function getAddonText() {
    if (booking.addons && booking.addons.length > 0) {
        return booking.addons.map(item => addonNames[item] || item).join(', ');
    }
    if (booking.services && booking.services.length > 0) {
        return booking.services.map(item => serviceNames[item] || item).join(', ');
    }
    return 'ไม่มี';
}

function getCustomDetailText() {
    if (booking.type !== 'custom') {
        return 'ไม่มี';
    }
    return [
        booking.shootTypeName ? `ประเภท: ${booking.shootTypeName}` : '',
        booking.persons ? `จำนวนคน: ${booking.persons} ท่าน` : '',
        booking.backdropName ? `ฉากหลัง: ${booking.backdropName}` : '',
        booking.scenes ? `จำนวนฉาก: ${booking.scenes} ฉาก` : '',
        booking.duration ? `ระยะเวลา: ${booking.duration} ชั่วโมง` : ''
    ].filter(Boolean).join(', ');
}

function buildReceiptHtml(receipt) {
    const receiptNumber = getReceiptNumber(receipt);
    const totalAmount = Number(booking.totalPriceValue || booking.packagePrice || 0);
    const depositAmountValue = Math.round(totalAmount * 0.3);
    const totalText = booking.totalPrice || `${totalAmount.toLocaleString('th-TH')} บาท`;
    const packagePrice = Number(booking.packagePrice || 0).toLocaleString('th-TH');
    const bookingCreatedAt = booking.timestamp ? formatDateTime(booking.timestamp) : '-';
    const receiptCreatedAt = formatDateTime(receipt.submittedAt);

    return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>สลิปบิล ${receiptNumber}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 30px; font-family: Arial, sans-serif; color: #2f174f; background: #f6f1ff; }
    .receipt { max-width: 760px; margin: 0 auto; padding: 30px; border-radius: 18px; background: #fff; border: 1px solid #ded0ff; }
    .top { display: flex; justify-content: space-between; gap: 20px; padding-bottom: 18px; border-bottom: 2px solid #eadfff; }
    h1 { margin: 0 0 6px; color: #5d22b2; font-size: 28px; }
    .status { display: inline-block; padding: 8px 12px; border-radius: 999px; color: #1b7a3a; background: #e6f8ed; font-weight: 700; }
    .meta { text-align: right; line-height: 1.6; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 22px; }
    .box { padding: 18px; border-radius: 14px; background: #fbf9ff; border: 1px solid #eadfff; }
    .box.full { grid-column: 1 / -1; }
    h2 { margin: 0 0 12px; color: #5d22b2; font-size: 18px; }
    p { display: flex; justify-content: space-between; gap: 18px; margin: 0; padding: 9px 0; border-bottom: 1px solid #eee6ff; }
    p:last-child { border-bottom: 0; }
    span { color: #7d3fab; font-weight: 700; }
    strong { color: #32114d; text-align: right; }
    .total { margin-top: 22px; padding: 18px; border-radius: 14px; background: #5d22b2; color: #fff; display: flex; justify-content: space-between; align-items: center; }
    .total span, .total strong { color: #fff; font-size: 22px; }
    .note { margin-top: 18px; color: #7d3fab; line-height: 1.6; }
    @media print { body { background: #fff; padding: 0; } .receipt { border: 0; } }
    @media (max-width: 680px) { body { padding: 12px; } .top, .grid { display: block; } .meta { text-align: left; margin-top: 14px; } .box { margin-top: 14px; } p, .total { flex-direction: column; align-items: flex-start; } strong { text-align: left; } }
  </style>
</head>
<body>
  <main class="receipt">
    <div class="top">
      <div>
        <h1>สลิปบิลการชำระเงิน</h1>
        <div>Studio Booking</div>
      </div>
      <div class="meta">
        <div><strong>${escapeHtml(receiptNumber)}</strong></div>
        <div>วันที่ออกบิล: ${escapeHtml(receiptCreatedAt)}</div>
        <div class="status">รอตรวจสอบการชำระเงิน</div>
      </div>
    </div>
    <section class="grid">
      <div class="box">
        <h2>ข้อมูลการจอง</h2>
        <p><span>แพ็กเกจ</span><strong>${escapeHtml(booking.packageName || 'Studio Custom Package')}</strong></p>
        <p><span>รหัสแพ็กเกจ</span><strong>${escapeHtml(booking.package || '-')}</strong></p>
        <p><span>ระยะเวลาแพ็กเกจ</span><strong>${escapeHtml(booking.packageDuration || '-')}</strong></p>
        <p><span>ธีมการถ่าย</span><strong>${escapeHtml(booking.themeName || '-')}</strong></p>
        <p><span>ผู้จอง</span><strong>${escapeHtml(booking.customerName || '-')}</strong></p>
        <p><span>วันที่ทำรายการจอง</span><strong>${escapeHtml(bookingCreatedAt)}</strong></p>
        <p><span>วันที่ถ่าย</span><strong>${escapeHtml(formatDate(booking.shootDate))}</strong></p>
        <p><span>เวลาถ่าย</span><strong>${escapeHtml(booking.bookingTime)}</strong></p>
      </div>
      <div class="box">
        <h2>ข้อมูลชำระเงิน</h2>
        <p><span>วิธีชำระ</span><strong>${escapeHtml(receipt.method)}</strong></p>
        <p><span>ชื่อผู้โอน</span><strong>${escapeHtml(receipt.payerName)}</strong></p>
        <p><span>วันที่โอน</span><strong>${escapeHtml(formatDate(receipt.paymentDate))}</strong></p>
        <p><span>เวลาโอน</span><strong>${escapeHtml(receipt.paymentTime)}</strong></p>
        <p><span>วันที่ส่งข้อมูล</span><strong>${escapeHtml(receiptCreatedAt)}</strong></p>
        <p><span>ไฟล์สลิป</span><strong>${escapeHtml(receipt.slipName || '-')}</strong></p>
      </div>
      <div class="box full">
        <h2>รายละเอียดที่เลือก</h2>
        <p><span>รายละเอียดแพ็กเกจ</span><strong>${escapeHtml(booking.packageDescription || '-')}</strong></p>
        <p><span>รายละเอียดสตูดิโอ</span><strong>${escapeHtml(getCustomDetailText())}</strong></p>
        <p><span>ราคาแพ็กเกจ</span><strong>${escapeHtml(packagePrice)} บาท</strong></p>
        <p><span>ยอดรวมทั้งหมด</span><strong>${escapeHtml(totalAmount.toLocaleString('th-TH'))} บาท</strong></p>
        <p><span>มัดจำ 30%</span><strong>${escapeHtml(depositAmountValue.toLocaleString('th-TH'))} บาท</strong></p>
        <p><span>ธีมที่เลือก</span><strong>${escapeHtml(booking.themeName || '-')}</strong></p>
        <p><span>รายการเสริมที่เลือก</span><strong>${escapeHtml(getAddonText())}</strong></p>
        <p><span>หมายเหตุการจอง</span><strong>${escapeHtml(booking.notes || 'ไม่มี')}</strong></p>
        <p><span>หมายเหตุการชำระเงิน</span><strong>${escapeHtml(receipt.note || 'ไม่มี')}</strong></p>
      </div>
    </section>
    <div class="total">
      <span>ยอดชำระ</span>
      <strong>${escapeHtml(Number(receipt.paidAmount).toLocaleString('th-TH'))} บาท</strong>
    </div>
  </main>
</body>
</html>`;
}

function showReceipt(receipt) {
    const receiptNumber = getReceiptNumber(receipt);
    const receiptPreview = document.getElementById('receiptPreview');
    latestReceiptFile = buildReceiptHtml(receipt);
    latestReceiptName = `receipt-${receiptNumber}.html`;

    const totalAmount = Number(booking.totalPriceValue || booking.packagePrice || 0);
    const depositValue = Math.round(totalAmount * 0.3);
    receiptPreview.innerHTML = `
        <p><span>เลขที่บิล</span><strong>${receiptNumber}</strong></p>
        <p><span>ผู้จอง</span><strong>${escapeHtml(booking.customerName || '-')}</strong></p>
        <p><span>แพ็กเกจ</span><strong>${escapeHtml(booking.packageName || 'Studio Custom Package')}</strong></p>
        <p><span>วันที่ถ่าย</span><strong>${escapeHtml(formatDate(booking.shootDate))}</strong></p>
        <p><span>เวลา</span><strong>${escapeHtml(booking.bookingTime)}</strong></p>
        <p><span>ยอดรวมทั้งหมด</span><strong>${totalAmount.toLocaleString('th-TH')} บาท</strong></p>
        <p><span>มัดจำ 30%</span><strong>${depositValue.toLocaleString('th-TH')} บาท</strong></p>
        <p><span>วันที่โอน</span><strong>${escapeHtml(formatDate(receipt.paymentDate))}</strong></p>
        <p><span>เวลาโอน</span><strong>${escapeHtml(receipt.paymentTime)}</strong></p>
        <p><span>ยอดชำระ</span><strong>${Number(receipt.paidAmount).toLocaleString('th-TH')} บาท</strong></p>
    `;

    document.getElementById('successModal').hidden = false;
}

document.getElementById('downloadReceiptBtn').addEventListener('click', () => {
    if (!latestReceiptFile) return;
    const blob = new Blob([latestReceiptFile], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = latestReceiptName || 'receipt.html';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
});

function getApiBase() {
    const { protocol, hostname, port, origin } = window.location;
    if (protocol === 'file:') return 'http://127.0.0.1:3000';
    if ((hostname === '127.0.0.1' || hostname === 'localhost') && port && port !== '3000')
        return `${protocol}//${hostname}:3000`;
    return origin;
}

document.getElementById('paymentDateDisplay').addEventListener('input', function() {
    let digits = this.value.replace(/\D/g, '').slice(0, 8);
    let v = digits;
    if (digits.length > 2) v = digits.slice(0,2) + '/' + digits.slice(2);
    if (digits.length > 4) v = digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4);
    this.value = v;
    if (digits.length === 8) {
        paymentDate.value = `${digits.slice(4,8)}-${digits.slice(2,4)}-${digits.slice(0,2)}`;
    } else {
        paymentDate.value = '';
    }
});

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function uploadSlip(paymentId, file) {
    try {
        const imageData = await readFileAsBase64(file);
        await fetch(getApiBase() + '/api/payments/slip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: paymentId, imageData }),
        });
    } catch (err) {
        console.error('Failed to upload slip:', err);
    }
}

document.getElementById('paymentForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!booking) {
        window.location.href = 'package.html';
        return;
    }

    const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    const receipt = {
        bookingId: booking.timestamp,
        bookingCode: booking.bookingCode || '',
        method: selectedMethod,
        payerName: payerName.value.trim(),
        payerPhone: document.getElementById('payerPhone').value.trim(),
        paymentDate: paymentDate.value,
        paymentTime: document.getElementById('paymentTime').value,
        paidAmount: Number(paidAmount.value),
        note: document.getElementById('paymentNote').value.trim(),
        slipName: document.getElementById('paymentSlip').files[0]?.name || '',
        status: 'pending_review',
        submittedAt: new Date().toISOString()
    };

    localStorage.setItem('paymentReceipt', JSON.stringify(receipt));

    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

        // Step 1: save booking to DB (only once — skip if already has a bookingCode)
        let finalBookingCode = booking.bookingCode || '';
        if (!finalBookingCode) {
            const customerName = (currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() : '') || booking.customerName || '';
            if (!customerName || !booking.room || !booking.shootDate || !booking.bookingTime) {
                alert('ข้อมูลการจองไม่ครบ กรุณาเริ่มจองใหม่');
                return;
            }
            const bookRes = await fetch(getApiBase() + '/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName,
                    customerEmail: currentUser?.email || '',
                    packageName: booking.packageName,
                    shootType: booking.shootType || '',
                    shootTypeName: booking.shootTypeName || '',
                    room: booking.room,
                    shootDate: booking.shootDate,
                    bookingTime: booking.bookingTime,
                    duration: booking.duration || String(booking.packageDuration || '').replace(/[^\d]/g, ''),
                    persons: booking.persons || booking.personCount || 1,
                    theme: booking.theme || '',
                    themeName: booking.themeName || booking.theme || '',
                    services: booking.services || booking.addons || [],
                    notes: booking.notes || '',
                    totalPrice: booking.totalPriceValue || booking.packagePrice || 0,
                })
            });
            const bookData = await bookRes.json();
            if (!bookData.bookingCode) {
                alert('ไม่สามารถบันทึกการจองได้: ' + (bookData.error || 'เกิดข้อผิดพลาด'));
                return;
            }
            finalBookingCode = bookData.bookingCode;
            booking.bookingCode = finalBookingCode;
            localStorage.setItem('currentBooking', JSON.stringify(booking));
        }
        receipt.bookingCode = finalBookingCode;

        // Step 2: save payment to DB
        const payRes = await fetch(getApiBase() + '/api/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bookingCode: finalBookingCode,
                paymentMethod: receipt.method,
                payerName: receipt.payerName,
                payerPhone: receipt.payerPhone,
                paymentDate: receipt.paymentDate,
                paymentTime: receipt.paymentTime,
                paidAmount: receipt.paidAmount,
                note: receipt.note,
                slipName: receipt.slipName,
            })
        });
        const payData = await payRes.json();
        if (!payData.id) {
            alert('ไม่สามารถบันทึกการชำระเงินได้: ' + (payData.error || 'เกิดข้อผิดพลาด'));
            return;
        }

        // Step 3: upload slip
        const slipFile = document.getElementById('paymentSlip').files[0];
        if (slipFile && payData.id) {
            await uploadSlip(payData.id, slipFile);
        }

        // Step 4: mark room as taken in localStorage (for same-browser availability display)
        if (booking.type === 'custom') {
            const studioBookings = JSON.parse(localStorage.getItem('studioBookings') || '[]');
            studioBookings.push(booking);
            localStorage.setItem('studioBookings', JSON.stringify(studioBookings));
        }
    } catch (err) {
        console.error('Failed to save data:', err);
    }

    showReceipt(receipt);
});

if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentBooking');
        window.location.href = logoutLink.getAttribute('href') || '../index.html';
    });
}
