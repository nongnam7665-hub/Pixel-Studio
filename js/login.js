const btnLogin = document.getElementById('btnLogin');
const CURRENT_USER_STORAGE_KEY = 'currentUser';

function getApiBase() {
    const { protocol, hostname, port, origin } = window.location;
    if (protocol === 'file:') return 'http://127.0.0.1:3000';
    if ((hostname === '127.0.0.1' || hostname === 'localhost') && port && port !== '3000')
        return `${protocol}//${hostname}:3000`;
    return origin;
}

if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
        const email = document.getElementById('email').value.trim().toLowerCase();
        const password = document.getElementById('password').value.trim();

        if (!email || !password) {
            alert('กรุณากรอกอีเมลและรหัสผ่านก่อนเข้าสู่ระบบ');
            return;
        }

        try {
    
            const adminRes = await fetch(getApiBase() + '/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const adminData = await adminRes.json();

            if (adminRes.ok && adminData.admin) {
                localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(adminData.admin));
                alert('เข้าสู่ระบบสำเร็จ!');
                window.location.href = 'admin.html';
                return;
            }
            
            const userRes = await fetch(getApiBase() + '/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const userResult = await userRes.json();

            if (userRes.ok && userResult.user) {
                localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(userResult.user));
                alert('เข้าสู่ระบบสำเร็จ!');
                window.location.href = 'user/home.html';
            } else {
                alert('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
            }

        } catch (error) {
            console.error('Error:', error);
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
        }
    });
}
