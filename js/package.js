const logoutLink = document.getElementById('logoutLink');
if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentBooking');
        window.location.href = logoutLink.getAttribute('href') || '../index.html';
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

function safeParseFeatures(raw) {
    try { return JSON.parse(raw || '[]'); } catch { return []; }
}

async function loadPackages() {
    const grid = document.getElementById('packages-grid');
    let packages = [];
    try {
        const data = await fetch(getApiBase() + '/api/packages').then(r => r.json());
        packages = data.packages || [];
    } catch {}

    if (!packages.length) {
        grid.innerHTML = '<p style="color:#7d3fab;padding:24px;">ไม่มีแพ็กเกจในขณะนี้</p>';
        return;
    }

    grid.innerHTML = packages.map(p => {
        const features = safeParseFeatures(p.features);
        const imgSrc = p.image ? `${getApiBase()}/${p.image}` : 'pic/Logo.png';
        const isPremium = p.badge === 'VIP';
        return `
        <article class="package-card${isPremium ? ' premium' : ''}">
            ${p.badge ? `<div class="package-badge${isPremium ? ' premium-badge' : ''}">${escHtml(p.badge)}</div>` : ''}
            <div class="package-thumb">
                <img src="${escHtml(imgSrc)}" alt="${escHtml(p.name)}">
            </div>
            <div class="package-content">
                <h2>${escHtml(p.name)}</h2>
                <p class="package-duration">ระยะเวลา: ${escHtml(p.duration)}</p>
                <p class="package-description">${escHtml(p.description)}</p>
                <ul class="package-features">
                    ${features.map(f => `<li>${escHtml(f)}</li>`).join('')}
                </ul>
                <div class="package-price">
                    <span class="old-price">${Number(p.old_price).toLocaleString('th-TH')}</span>
                    <span class="new-price">${Number(p.new_price).toLocaleString('th-TH')}</span>
                    <span class="price-unit">บาท</span>
                </div>
                <a href="checkout.html?package=${escHtml(p.slug)}" class="package-btn${isPremium ? ' premium-btn' : ''}">เลือกแพ็กเกจ</a>
            </div>
        </article>`;
    }).join('');
}

loadPackages();
