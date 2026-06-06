let currentPersons = 1;
let totalPrice = 0;

const dateInput = document.getElementById('shootDate');
const timeSelect = document.getElementById('bookingTime');

const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
const savedBooking = JSON.parse(localStorage.getItem('currentBooking') || 'null');
// restore เฉพาะเมื่อเป็น booking ประเภท custom และเป็นของ user คนเดิม
const currentBooking = (
  savedBooking &&
  savedBooking.type === 'custom' &&
  savedBooking.userId &&
  currentUser &&
  savedBooking.userId === currentUser.email
) ? savedBooking : null;

document.getElementById('shootDateDisplay').addEventListener('input', function() {
    let digits = this.value.replace(/\D/g, '').slice(0, 8);
    let v = digits;
    if (digits.length > 2) v = digits.slice(0,2) + '/' + digits.slice(2);
    if (digits.length > 4) v = digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4);
    this.value = v;
    if (digits.length === 8) {
        dateInput.value = `${digits.slice(4,8)}-${digits.slice(2,4)}-${digits.slice(0,2)}`;
        fetchBookingsForDate(dateInput.value); // ดึงข้อมูลห้องจาก server
    } else {
        dateInput.value = '';
        fetchBookingsForDate('');
    }
});

const ROOM_DEFAULTS = {
  A: { name: 'ห้อง A', description: 'สตูดิโอขนาดเล็ก เหมาะสำหรับถ่ายภาพเดี่ยวหรือคู่' },
  B: { name: 'ห้อง B', description: 'สตูดิโอขนาดกลาง เหมาะสำหรับกลุ่มเล็ก' },
  C: { name: 'ห้อง C', description: 'สตูดิโอขนาดใหญ่ เหมาะสำหรับกลุ่มใหญ่' },
  D: { name: 'ห้อง D', description: 'สตูดิโอพรีเมียม พร้อมอุปกรณ์ครบครัน' },
};

async function buildRoomGrid() {
  let rooms = [];
  try {
    const data = await fetch(getApiBase() + '/api/admin/rooms').then(r => r.json());
    rooms = data.rooms || [];
  } catch {}

  const grid = document.getElementById('room-grid');
  const ids = rooms.length ? rooms.map(r => r.id) : ['A', 'B', 'C', 'D'];

  grid.innerHTML = ids.map((id, idx) => {
    const room = rooms.find(r => r.id === id) || {};
    const def = ROOM_DEFAULTS[id] || {};
    const name = room.name || def.name || `ห้อง ${id}`;
    const desc = room.description || def.description || '';
    const imgSrc = room.image ? `${getApiBase()}/${room.image}` : '';
    return `
      <label class="room-card" data-room="${id}">
        <input type="radio" name="studioRoom" value="${id}"${idx === 0 ? ' required' : ''}>
        <div class="room-thumb">${imgSrc ? `<img src="${imgSrc}" alt="${name}">` : ''}</div>
        <div class="room-content">
          <h4>${name}</h4>
          <p>${desc}</p>
          <span class="room-status">ว่าง</span>
        </div>
      </label>`;
  }).join('');

  document.querySelectorAll('input[name="studioRoom"]').forEach(input => {
    input.addEventListener('change', updateRoomSummary);
  });
  if (currentBooking && currentBooking.room) {
    const savedRoom = grid.querySelector(`input[name="studioRoom"][value="${currentBooking.room}"]`);
    if (savedRoom && !savedRoom.disabled) { savedRoom.checked = true; updateRoomSummary(); }
  }
  // ถ้ามีวันที่เลือกอยู่แล้ว ให้ดึงข้อมูลห้องจาก server ทันที
  if (dateInput.value) {
    fetchBookingsForDate(dateInput.value);
  }
}

function getRoomInputs() {
  return document.querySelectorAll('input[name="studioRoom"]');
}

// ---- ระบบเช็คห้องว่าง/ไม่ว่าง (ดึงจาก server จริง) ----
let cachedDateBookings = []; // เก็บ booking ของวันที่เลือกไว้ใน memory

async function fetchBookingsForDate(date) {
    if (!date) {
        cachedDateBookings = [];
        updateTimeAvailability();
        updateRoomAvailability();
        return;
    }
    try {
        const data = await fetch(`${getApiBase()}/api/rooms/availability?date=${date}`).then(r => r.json());
        cachedDateBookings = data.bookings || [];
    } catch {
        cachedDateBookings = [];
    }
    updateTimeAvailability();
    updateRoomAvailability();
}

function getRoomBookings() {
    return cachedDateBookings; // อ่านจาก cache ที่ดึงมาจาก server
}

function parseMinutes(timeStr) {
    const m = String(timeStr || '').match(/(\d{1,2}):(\d{2})/);
    return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : -1;
}

function slotOverlaps(booking, checkTime) {
    const startMin = parseMinutes(booking.bookingTime);
    const checkMin = parseMinutes(checkTime);
    if (startMin < 0 || checkMin < 0) return false;
    const durHours = parseInt(booking.duration) || 2;
    return checkMin >= startMin && checkMin < startMin + durHours * 60;
}

function isRoomBooked(room, checkTime) {
    if (!room || !checkTime) return false;
    return getRoomBookings().some(b => b.room === room && slotOverlaps(b, checkTime));
}

function isTimeBooked(checkTime) {
    if (!checkTime) return false;
    const bookings = getRoomBookings();
    const allRooms = ['A', 'B', 'C', 'D'];
    return allRooms.every(room => bookings.some(b => b.room === room && slotOverlaps(b, checkTime)));
}

function updateTimeAvailability() {
    Array.from(timeSelect.options).forEach(option => {
        if (!option.value) return;
        if (isTimeBooked(option.value)) {
            option.disabled = true;
            if (!option.dataset.originalText) option.dataset.originalText = option.text;
            option.text = option.dataset.originalText + ' (เต็ม)';
        } else {
            option.disabled = false;
            if (option.dataset.originalText) option.text = option.dataset.originalText;
        }
    });
    if (timeSelect.value && isTimeBooked(timeSelect.value)) {
        timeSelect.value = '';
        document.getElementById('summaryBookingTime').textContent = '-';
    }
}

function updateRoomAvailability() {
    const time = timeSelect.value;
    getRoomInputs().forEach(input => {
        const card = input.closest('.room-card');
        const status = card.querySelector('.room-status');
        if (isRoomBooked(input.value, time)) {
            input.disabled = true;
            card.classList.add('full');
            status.textContent = 'เต็ม';
        } else {
            input.disabled = false;
            card.classList.remove('full');
            status.textContent = 'ว่าง';
        }
    });
    const selectedRoom = document.querySelector('input[name="studioRoom"]:checked');
    if (selectedRoom && selectedRoom.disabled) {
        selectedRoom.checked = false;
        document.getElementById('summaryRoom').textContent = '-';
    }
}

function updateRoomSummary() {
    const selectedRoom = document.querySelector('input[name="studioRoom"]:checked');
    document.getElementById('summaryRoom').textContent = selectedRoom ? `ห้อง ${selectedRoom.value}` : '-';
}

document.querySelectorAll('.person-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const action = this.dataset.action;
        if (action === 'increase' && currentPersons < 20) {
            currentPersons++;
        } else if (action === 'decrease' && currentPersons > 1) {
            currentPersons--;
        }
        document.getElementById('personCount').textContent = currentPersons;
        document.getElementById('summaryPersons').textContent = currentPersons + ' ท่าน';
        updatePrice();
    });
});

document.querySelectorAll('input[name="shootType"]').forEach(radio => {
    radio.addEventListener('change', function() {
        const typeNames = {
            'profile': 'โปรไฟล์',
            'couple': 'คู่รัก',
            'family': 'ครอบครัว',
            'group': 'กลุ่ม'
        };
        document.getElementById('summaryShootType').textContent = typeNames[this.value];
        updatePrice();
    });
});

async function buildThemeGrid() {
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

    const grid = document.getElementById('theme-grid');
    grid.innerHTML = themes.map((t, i) => {
        const previewStyle = t.image
            ? `background-image:url(${getApiBase()}/${t.image});background-size:cover;background-position:center;`
            : `background:linear-gradient(135deg,${t.color1} 0%,${t.color2} 100%);`;
        return `
        <label class="theme-card">
            <input type="checkbox" name="theme" value="${t.slug}" data-price="${Number(t.price)}">
            <div class="theme-content">
                <div class="theme-preview" style="${previewStyle}"></div>
                <div class="theme-text">
                    <h4>${t.name}</h4>
                    <p>${t.description}</p>
                    <span class="theme-price">${Number(t.price) > 0 ? '+' + Number(t.price).toLocaleString('th-TH') + ' บาท' : 'ฟรี'}</span>
                </div>
            </div>
        </label>`;
    }).join('');

    function updateThemeSummary() {
        const checked = Array.from(document.querySelectorAll('input[name="theme"]:checked'));
        const names = checked.map(t => t.closest('label').querySelector('h4').textContent);
        document.getElementById('summaryTheme').textContent = names.length ? names.join(', ') : '-';
        updatePrice();
    }

    document.querySelectorAll('input[name="theme"]').forEach(cb => {
        cb.addEventListener('change', updateThemeSummary);
    });

    // restore จาก booking เดิม (รองรับทั้ง array และ string เดิม)
    const savedSlugs = currentBooking
        ? (Array.isArray(currentBooking.themes) ? currentBooking.themes
            : currentBooking.theme ? currentBooking.theme.split(',') : [])
        : [];
    if (savedSlugs.length) {
        savedSlugs.forEach(slug => {
            const el = grid.querySelector(`input[name="theme"][value="${slug.trim()}"]`);
            if (el) el.checked = true;
        });
    }
    updateThemeSummary();
    updatePrice();
}

document.querySelectorAll('input[name="duration"]').forEach(radio => {
    radio.addEventListener('change', function() {
        document.getElementById('summaryDuration').textContent = this.value + ' ชั่วโมง';
        updatePrice();
    });
});

document.querySelectorAll('input[name="service"]').forEach(checkbox => {
    checkbox.addEventListener('change', updatePrice);
});

document.getElementById('bookingTime').addEventListener('change', function() {
    document.getElementById('summaryBookingTime').textContent = this.value || '-';
    updateRoomAvailability();
});

dateInput.addEventListener('change', function() {
    fetchBookingsForDate(this.value); // ดึงจาก server ทุกครั้งที่เปลี่ยนวันที่
});

function updatePrice() {
    totalPrice = 0;

    const shootType = document.querySelector('input[name="shootType"]:checked');
    if (shootType) {
        totalPrice += parseInt(shootType.dataset.price);
    }

    if (currentPersons > 1) {
        totalPrice += (currentPersons - 1) * 500;
    }

    document.querySelectorAll('input[name="theme"]:checked').forEach(theme => {
        totalPrice += parseInt(theme.dataset.price);
    });

    const duration = document.querySelector('input[name="duration"]:checked');
    if (duration) {
        totalPrice += parseInt(duration.dataset.price);
    }

    const services = document.querySelectorAll('input[name="service"]:checked');
    let selectedServices = [];
    services.forEach(service => {
        const price = parseInt(service.dataset.price);
        totalPrice += price;
        selectedServices.push({
            label: service.parentElement.querySelector('.service-title').textContent,
            price: price
        });
    });

    const summaryServices = document.getElementById('summaryServices');
    summaryServices.innerHTML = selectedServices.map(item =>
        `<div class="summary-service-item">${item.label}: +${item.price} บาท</div>`
    ).join('');

    document.getElementById('totalPrice').textContent = totalPrice.toLocaleString('th-TH') + ' บาท';
}

function getApiBase() {
    const { protocol, hostname, port, origin } = window.location;
    if (protocol === 'file:') return 'http://127.0.0.1:3000';
    if ((hostname === '127.0.0.1' || hostname === 'localhost') && port && port !== '3000')
        return `${protocol}//${hostname}:3000`;
    return origin;
}

document.getElementById('studioForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const customerName = currentUser ? (currentUser.username || '') : '';
    const shootDate = document.getElementById('shootDate').value;
    const bookingTime = document.getElementById('bookingTime').value;
    const notes = document.getElementById('notes').value;

    if (!bookingTime) { alert('กรุณาเลือกเวลานัดถ่ายภาพ'); return; }
    if (!shootDate) { alert('กรุณาเลือกวันที่ถ่ายภาพ'); return; }

    const shootType = document.querySelector('input[name="shootType"]:checked');
    if (!shootType) { alert('กรุณาเลือกประเภทการถ่ายภาพ'); return; }

    const selectedThemeEls = Array.from(document.querySelectorAll('input[name="theme"]:checked'));
    if (!selectedThemeEls.length) { alert('กรุณาเลือกธีมการถ่ายอย่างน้อย 1 ธีม'); return; }

    const selectedServices = Array.from(document.querySelectorAll('input[name="service"]:checked'))
        .map(service => service.value);

    const selectedRoom = document.querySelector('input[name="studioRoom"]:checked');
    if (!selectedRoom) { alert('กรุณาเลือกห้องสตูดิโอ'); return; }

    // ดึงข้อมูลล่าสุดจาก server ก่อน submit เพื่อป้องกันจองซ้ำ
    await fetchBookingsForDate(shootDate);
    if (isRoomBooked(selectedRoom.value, bookingTime)) {
        alert('ขออภัย ห้องที่เลือกถูกจองแล้ว กรุณาเลือกห้องอื่นหรือเวลาอื่น');
        updateRoomAvailability();
        return;
    }

    const duration = document.querySelector('input[name="duration"]:checked')?.value || '3';
    const shootTypeName = document.getElementById('summaryShootType').textContent;
    const totalPriceText = document.getElementById('totalPrice').textContent;
    const totalPriceNumber = Number(totalPriceText.replace(/[^\d]/g, ''));

    const bookingData = {
        type: 'custom',
        userId: currentUser ? currentUser.email : null,
        package: 'studio-custom',
        packageName: 'Studio Custom Package',
        packageDuration: duration + ' ชั่วโมง',
        packageDescription: `ถ่ายภาพแบบ ${shootTypeName} ธีม${document.getElementById('summaryTheme').textContent} จำนวน ${currentPersons} ท่าน`,
        packagePrice: totalPriceNumber,
        customerName: customerName,
        shootType: shootType.value,
        shootTypeName: shootTypeName,
        themes: selectedThemeEls.map(t => t.value),
        theme: selectedThemeEls.map(t => t.value).join(','),
        themeName: document.getElementById('summaryTheme').textContent,
        persons: currentPersons,
        room: selectedRoom.value,
        roomName: `ห้อง ${selectedRoom.value}`,
        duration: duration,
        services: selectedServices,
        shootDate: shootDate,
        bookingTime: bookingTime,
        notes: notes,
        totalPrice: totalPriceText,
        timestamp: new Date().toISOString()
    };

    localStorage.setItem('currentBooking', JSON.stringify(bookingData));
    window.location.href = 'payment.html';
});

function restoreFields() {
    if (!currentBooking) return;

    if (currentBooking.bookingTime) {
        timeSelect.value = currentBooking.bookingTime;
        document.getElementById('summaryBookingTime').textContent = currentBooking.bookingTime;
    }

    if (currentBooking.shootDate) {
        const isoDate = currentBooking.shootDate.split('T')[0];
        dateInput.value = isoDate;
        const [y, m, d] = isoDate.split('-');
        document.getElementById('shootDateDisplay').value = `${d}/${m}/${y}`;
    }

    const notesEl = document.getElementById('notes');
    if (notesEl) notesEl.value = currentBooking.notes || '';

    if (currentBooking.shootType) {
        const shootTypeEl = document.querySelector(`input[name="shootType"][value="${currentBooking.shootType}"]`);
        if (shootTypeEl) {
            shootTypeEl.checked = true;
            document.getElementById('summaryShootType').textContent = currentBooking.shootTypeName || currentBooking.shootType;
        }
    }

    if (currentBooking.persons) {
        currentPersons = parseInt(currentBooking.persons) || 1;
        document.getElementById('personCount').textContent = currentPersons;
        document.getElementById('summaryPersons').textContent = currentPersons + ' ท่าน';
    }

    if (currentBooking.duration) {
        const durationEl = document.querySelector(`input[name="duration"][value="${currentBooking.duration}"]`);
        if (durationEl) {
            durationEl.checked = true;
            document.getElementById('summaryDuration').textContent = currentBooking.duration + ' ชั่วโมง';
        }
    }

    if (Array.isArray(currentBooking.services)) {
        document.querySelectorAll('input[name="service"]').forEach(cb => {
            cb.checked = currentBooking.services.includes(cb.value);
        });
    }

    updateTimeAvailability();
    updateRoomAvailability();
    updatePrice();
}

restoreFields();
updatePrice();
buildRoomGrid();
buildThemeGrid();

const logoutLink = document.getElementById('logoutLink');
if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentBooking');
        window.location.href = logoutLink.getAttribute('href') || '../index.html';
    });
}
