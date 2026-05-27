const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
const welcomeText = document.getElementById('welcomeText');
const logoutLink = document.getElementById('logoutLink');

const indexPage = (logoutLink && logoutLink.getAttribute('href')) || '../index.html';

if (!currentUser) {
    window.location.href = indexPage;
} else if (welcomeText) {
    welcomeText.textContent = `ยินดีต้อนรับ, ${currentUser.username}`;
}

if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentBooking');
        window.location.href = indexPage;
    });
}

function getApiBase() {
    const { protocol, hostname, port, origin } = window.location;
    if (protocol === 'file:') return 'http://127.0.0.1:3000';
    if ((hostname === '127.0.0.1' || hostname === 'localhost') && port && port !== '3000')
        return `${protocol}//${hostname}:3000`;
    return origin;
}

function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function loadPromos() {
    const list = document.getElementById('promo-list');
    let packages = [];
    try {
        const data = await fetch(getApiBase() + '/api/packages').then(r => r.json());
        packages = (data.packages || []).filter(p => p.is_promo);
    } catch {}

    if (!packages.length) {
        list.innerHTML = '<p style="color:#7d3fab;padding:24px;">ไม่มีโปรโมชั่นในขณะนี้</p>';
        return;
    }

    list.innerHTML = packages.map((p, i) => {
        const imgSrc = p.image ? `${getApiBase()}/${p.image}` : 'pic/Logo.png';
        return `
        <article class="promo-card">
            <div class="promo-thumb">
                <img src="${escHtml(imgSrc)}" alt="${escHtml(p.name)}">
            </div>
            <div class="promo-content">
                <h2>${i + 1}. ${escHtml(p.name)} ${escHtml(p.duration)}</h2>
                <p>${escHtml(p.description)}</p>
                <div class="promo-price">
                    <span class="old-price">${Number(p.old_price).toLocaleString('th-TH')}</span>
                    <span class="new-price">${Number(p.new_price).toLocaleString('th-TH')}</span>
                </div>
                <div class="promo-actions">
                    <a href="checkout.html?package=${escHtml(p.slug)}" class="promo-btn">ดูโปรโมชั่น</a>
                </div>
            </div>
        </article>`;
    }).join('');
}

async function loadAdminMessages() {
    if (!currentUser || !currentUser.email) return;
    try {
        const data = await fetch(`${getApiBase()}/api/user/bookings?email=${encodeURIComponent(currentUser.email)}`).then(r => r.json());
        const bookings = (data.bookings || []).filter(b => b.adminMessage);
        if (!bookings.length) return;
        const statusLabel = { approved: '✅ อนุมัติแล้ว', cancelled: '❌ ปฏิเสธ', pending: '⏳ รอดำเนินการ', active: '🟢 กำลังใช้งาน', completed: '🏁 เสร็จสิ้น' };
        const statusColor = { approved: '#28a745', cancelled: '#dc3545', pending: '#e6a817', active: '#17a2b8', completed: '#6c757d' };
        document.getElementById('admin-msg-list').innerHTML = bookings.map(b => `
            <div style="background:#fff;border-radius:12px;padding:14px 16px;margin-bottom:10px;border-left:4px solid ${statusColor[b.status] || '#6a18d4'};">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span style="font-weight:700;color:#5d22b2;font-size:0.9rem;">รหัสจอง: ${escHtml(b.bookingCode)}</span>
                    <span style="font-size:0.85rem;font-weight:600;color:${statusColor[b.status] || '#6a18d4'};">${statusLabel[b.status] || b.status}</span>
                </div>
                <p style="margin:0;color:#444;font-size:0.95rem;">${escHtml(b.adminMessage)}</p>
            </div>
        `).join('');
        document.getElementById('admin-msg-section').style.display = 'block';
    } catch {}
}

loadPromos();
loadAdminMessages();
