const packagesData = {
    'profile': {
        name: 'Package Profile',
        duration: '3 ชั่วโมง',
        price: 2999,
        description: 'ถ่ายภาพโปรไฟล์โดยช่างภาพและทีมงาน'
    },
    'hbd': {
        name: 'Package HBD',
        duration: '3 ชั่วโมง',
        price: 2999,
        description: 'ถ่ายภาพวันเกิดโดยช่างภาพและทีมงาน'
    },
    'lover': {
        name: 'Package Lover',
        duration: '3 ชั่วโมง',
        price: 5999,
        description: 'สำหรับคู่รัก ถ่ายภาพฝ่ายชายและหญิง'
    },
    'family': {
        name: 'Package Family',
        duration: '3 ชั่วโมง',
        price: 6999,
        description: 'สำหรับครอบครัว ถ่ายการณ์แบบฟิล์มแฟมิลี่'
    },
    'group': {
        name: 'Package Group',
        duration: '4 ชั่วโมง',
        price: 9999,
        description: 'สำหรับกลุ่มหรือองค์กร ถ่ายหมู่แบบเป็นมิตร'
    },
    'premium': {
        name: 'Package Premium',
        duration: '5 ชั่วโมง',
        price: 12999,
        description: 'แพ็กเกจสุดพิเศษ สำหรับการถ่ายภาพแบบละเอียด'
    }
};

const urlParams = new URLSearchParams(window.location.search);
const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
const savedBooking = JSON.parse(localStorage.getItem('currentBooking') || 'null');
const packageId = urlParams.get('package') || (savedBooking && savedBooking.package) || 'profile';
// restore เฉพาะเมื่อเป็น booking ของ user คนเดิม
const currentBooking = (
  savedBooking &&
  savedBooking.package === packageId &&
  (!savedBooking.userId || !currentUser || savedBooking.userId === currentUser.email)
) ? savedBooking : null;
const packageData = packagesData[packageId];

function initPage() {
    if (!packageData) {
        window.location.href = 'package.html';
        return;
    }

    const summary = document.getElementById('packageSummary');
    summary.innerHTML = `
        <div class="summary-box">
            <h2>${packageData.name}</h2>
            <p class="duration">⏱️ ${packageData.duration}</p>
            <p class="desc">${packageData.description}</p>
            ${currentBooking ? `<p class="summary-detail">ชื่อผู้จอง: ${currentBooking.customerName}</p><p class="summary-detail">เวลา: ${currentBooking.bookingTime}</p>${currentBooking.roomName ? `<p class="summary-detail">ห้อง: ${currentBooking.roomName}</p>` : ''}` : ''}
        </div>
    `;
    const nameInput = document.getElementById('customerName');
    const timeSelect = document.getElementById('bookingTime');
    const dateInput = document.getElementById('shootDate');
    const notesInput = document.getElementById('notes');
    const personCountEl = document.getElementById('personCount');

    if (currentBooking) {
        if (nameInput) nameInput.value = currentBooking.customerName || '';
        if (timeSelect) timeSelect.value = currentBooking.bookingTime || '';
        if (currentBooking.shootDate) {
            const isoDate = currentBooking.shootDate.split('T')[0];
            if (dateInput) dateInput.value = isoDate;
            const [y, m, d] = isoDate.split('-');
            document.getElementById('shootDateDisplay').value = `${d}/${m}/${y}`;
        }
        if (notesInput) notesInput.value = currentBooking.notes || '';
        if (currentBooking.personCount) {
            personCount = parseInt(currentBooking.personCount) || 1;
            if (personCountEl) personCountEl.textContent = personCount;
        }
        if (Array.isArray(currentBooking.addons)) {
            addons.forEach(addon => { addon.checked = currentBooking.addons.includes(addon.value); });
        }
    }

    if (currentBooking && currentBooking.room) {
        const roomSelect = document.querySelector(`input[name="studioRoom"][value="${currentBooking.room}"]`);
        if (roomSelect) roomSelect.checked = true;
    }

    document.getElementById('packagePrice').textContent = packageData.price.toLocaleString('th-TH') + ' บาท';
    updatePrice();
}

const addons = document.querySelectorAll('input[name="addon"]');
addons.forEach(addon => {
    addon.addEventListener('change', updatePrice);
});

const personCountEl = document.getElementById('personCount');
let personCount = 1;
const personButtons = document.querySelectorAll('.person-btn');
personButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'increase') {
            personCount++;
        } else if (action === 'decrease' && personCount > 1) {
            personCount--;
        }
        if (personCountEl) {
            personCountEl.textContent = personCount;
        }
        updatePrice();
    });
});

function updatePrice() {
    let total = packageData.price;
    let selectedAddons = [];

    const selectedTheme = document.querySelector('input[name="theme"]:checked');
    let themePrice = 0;
    if (selectedTheme) {
        themePrice = parseInt(selectedTheme.dataset.price) || 0;
        total += themePrice;
    }

    const selectedPersonCount = parseInt(personCountEl ? personCountEl.textContent : '1');
    const personExtra = Math.max(0, selectedPersonCount - 1) * 500;
    total += personExtra;

    addons.forEach(addon => {
        if (addon.checked) {
            const price = parseInt(addon.dataset.price);
            total += price;
            selectedAddons.push({
                label: addon.parentElement.querySelector('.option-title').textContent,
                price: price
            });
        }
    });

    const summaryAddons = document.getElementById('summaryAddons');
    const themeLabel = selectedTheme ? selectedTheme.parentElement.querySelector('.theme-content h4').textContent : '';
    let summaryHtml = '';
    if (themeLabel) {
        summaryHtml += `<div class="summary-item"><span>ธีม: ${themeLabel}</span><span>${themePrice > 0 ? '+ ' + themePrice + ' บาท' : 'ฟรี'}</span></div>`;
    }
    if (selectedPersonCount > 1) {
        summaryHtml += `<div class="summary-item"><span>จำนวนคน: ${selectedPersonCount} ท่าน</span><span>+ ${personExtra} บาท</span></div>`;
    }
    summaryHtml += selectedAddons.map(item =>
        `<div class="summary-item"><span>${item.label}:</span><span>+ ${item.price} บาท</span></div>`
    ).join('');
    summaryAddons.innerHTML = summaryHtml;

    document.getElementById('totalPrice').textContent = total.toLocaleString('th-TH') + ' บาท';
}

document.getElementById('checkoutForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const shootDate = document.getElementById('shootDate').value;
    const notes = document.getElementById('notes').value;
    const customerName = document.getElementById('customerName').value.trim();
    const bookingTime = document.getElementById('bookingTime').value;

    if (!customerName || !bookingTime) {
        alert('กรุณากรอกชื่อผู้จองและเลือกเวลา');
        return;
    }

    if (!shootDate) {
        alert('กรุณาเลือกวันที่ถ่ายภาพ');
        return;
    }

    const selectedAddons = Array.from(addons)
        .filter(addon => addon.checked)
        .map(addon => addon.value);
    const selectedTheme = document.querySelector('input[name="theme"]:checked');
    const themeValue = selectedTheme ? selectedTheme.value : 'minimal';
    const selectedPersonCount = parseInt(personCountEl ? personCountEl.textContent : '1');
    const selectedRoom = document.querySelector('input[name="studioRoom"]:checked');

    if (!selectedRoom) {
        alert('กรุณาเลือกห้องสตูดิโอ');
        return;
    }

    const bookingSave = {
        package: packageId,
        userId: currentUser ? currentUser.email : null,
        packageName: packageData.name,
        packageDuration: packageData.duration,
        packageDescription: packageData.description,
        packagePrice: packageData.price,
        customerName: customerName,
        bookingTime: bookingTime,
        theme: themeValue,
        personCount: selectedPersonCount,
        room: selectedRoom.value,
        roomName: `ห้อง ${selectedRoom.value}`,
        addons: selectedAddons,
        shootDate: shootDate,
        notes: notes,
        totalPrice: document.getElementById('totalPrice').textContent,
        totalPriceValue: Number(document.getElementById('totalPrice').textContent.replace(/[^\d]/g, '')),
        depositAmount: Math.round(Number(document.getElementById('totalPrice').textContent.replace(/[^\d]/g, '')) * 0.3),
        timestamp: new Date().toISOString()
    };

    localStorage.setItem('currentBooking', JSON.stringify(bookingSave));
    window.location.href = 'payment.html';
});

document.getElementById('shootDateDisplay').addEventListener('input', function() {
    let digits = this.value.replace(/\D/g, '').slice(0, 8);
    let v = digits;
    if (digits.length > 2) v = digits.slice(0,2) + '/' + digits.slice(2);
    if (digits.length > 4) v = digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4);
    this.value = v;
    if (digits.length === 8) {
        document.getElementById('shootDate').value = `${digits.slice(4,8)}-${digits.slice(2,4)}-${digits.slice(0,2)}`;
    } else {
        document.getElementById('shootDate').value = '';
    }
});

function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function loadThemes() {
    const grid = document.getElementById('theme-grid');
    let themes = [];
    try {
        const data = await fetch(getApiBase() + '/api/themes').then(r => r.json());
        themes = data.themes || [];
    } catch {}

    if (!themes.length) {
        themes = [
            { slug: 'minimal', name: 'มินิมอล',  description: 'เรียบ สะอาด โทนอ่อน',    price: 0,   color1: '#ffffff', color2: '#edf0f5' },
            { slug: 'classic', name: 'คลาสสิก',  description: 'สุภาพ โทนเทา เข้มขึ้น',  price: 200, color1: '#2f3542', color2: '#a4b0be' },
            { slug: 'fresh',   name: 'สดใส',     description: 'โทนฟ้า สบายตา',           price: 300, color1: '#70d6ff', color2: '#b8f7ff' },
            { slug: 'sweet',   name: 'หวาน',     description: 'โทนชมพู นุ่มละมุน',       price: 300, color1: '#ff8fab', color2: '#ffd6e0' },
            { slug: 'nature',  name: 'ธรรมชาติ', description: 'โทนเขียว ดูผ่อนคลาย',    price: 400, color1: '#2fbf71', color2: '#b7efc5' },
            { slug: 'premium', name: 'พรีเมียม', description: 'ฉากพิเศษ ดูหรูขึ้น',     price: 500, color1: '#1f1235', color2: '#ffd166' },
        ];
    }

    grid.innerHTML = themes.map((t, i) => {
        const previewStyle = t.image
            ? `background-image:url(${getApiBase()}/${escHtml(t.image)});background-size:cover;background-position:center;`
            : `background:linear-gradient(135deg,${escHtml(t.color1)} 0%,${escHtml(t.color2)} 100%);`;
        return `
        <label class="theme-card">
            <input type="radio" name="theme" value="${escHtml(t.slug)}" data-price="${Number(t.price)}"${i === 0 ? ' checked' : ''}>
            <div class="theme-content">
                <div class="theme-preview" style="${previewStyle}"></div>
                <h4>${escHtml(t.name)}</h4>
                <p>${escHtml(t.description)}</p>
                <span class="theme-price">${Number(t.price) > 0 ? '+' + Number(t.price).toLocaleString('th-TH') + ' บาท' : 'ฟรี'}</span>
            </div>
        </label>`;
    }).join('');

    const savedTheme = currentBooking && currentBooking.theme;
    if (savedTheme) {
        const saved = grid.querySelector(`input[value="${savedTheme}"]`);
        if (saved) saved.checked = true;
    }

    document.querySelectorAll('input[name="theme"]').forEach(radio => {
        radio.addEventListener('change', updatePrice);
    });
    updatePrice();
}

initPage();
loadThemes();

const logoutLink = document.getElementById('logoutLink');
if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentBooking');
        window.location.href = logoutLink.getAttribute('href') || '../index.html';
    });
}
