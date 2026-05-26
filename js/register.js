const btnRegister = document.getElementById('btnRegister');

if (btnRegister) {
    btnRegister.addEventListener('click', async () => {
        const firstName = document.getElementById('name').value.trim();
        const lastName = document.getElementById('surname').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const email = document.getElementById('email').value.trim().toLowerCase();
        const password = document.getElementById('password').value.trim();
        const confirmPassword = document.getElementById('confirmPassword').value.trim();

        // เช็กกรอกข้อมูลครบไหม
        if (!firstName || !lastName || !phone || !email || !password || !confirmPassword) {
            alert('กรุณากรอกข้อมูลให้ครบทุกช่อง');
            return;
        }

        // เช็กรหัสผ่านตรงกันไหม
        if (password !== confirmPassword) {
            alert('รหัสผ่านกับยืนยันรหัสผ่านไม่ตรงกัน');
            return;
        }

        try {
            // มัดรวมข้อมูลส่งไปหลังบ้าน
            const userData = { firstName, lastName, phone, email, password };

            const response = await fetch('https://pixle-studio.onrender.com/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });

            const result = await response.json();

            if (response.ok) {
                alert('สมัครสมาชิกสำเร็จเรียบร้อยแล้ว!');
                window.location.href = 'index.html';
            } else {
                alert(result.message || 'สมัครสมาชิกไม่สำเร็จ');
            }

        } catch (error) {
            console.error('Error:', error);
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์หลังบ้าน');
        }
    });
}
