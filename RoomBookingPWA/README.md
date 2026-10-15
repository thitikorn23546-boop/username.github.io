# ระบบจองห้องประชุม แบบ PWA (ติดตั้งบน iPhone / Android)

ไฟล์ในโฟลเดอร์นี้
- code.gs            Apps Script เวอร์ชันแก้แล้ว (เพิ่ม API ใน doPost, ส่วนอื่นเหมือนเดิม)
- index.html         หน้าเว็บสำหรับโฮสต์ภายนอก (ใช้ google.script.run ผ่าน fetch)
- manifest.webmanifest, sw.js, icons/   ส่วนที่ทำให้ติดตั้งเป็นแอปได้

## 1) อัปเดต Apps Script
1. วางโค้ดจาก code.gs ทับไฟล์เดิมใน Apps Script (ไฟล์ index.html เดิมใน Apps Script ไม่ต้องแก้)
2. Deploy > Manage deployments > Edit > New version > Deploy
   ตั้งค่า Execute as: Me, Who has access: Anyone
3. คัดลอก URL ที่ลงท้ายด้วย /exec

## 2) ใส่ URL ใน index.html
ค้นหา PASTE_YOUR_DEPLOYMENT_ID_HERE แล้วแทนด้วย URL ทั้งเส้นจากข้อ 1

## 3) โฮสต์ทั้งโฟลเดอร์ (ต้องเป็น HTTPS)
ตัวเลือกฟรี เลือกอย่างใดอย่างหนึ่ง
- Netlify: app.netlify.com/drop ลากโฟลเดอร์นี้ไปวาง
- GitHub Pages: อัปโหลดไฟล์ขึ้น repo แล้วเปิด Settings > Pages
- Cloudflare Pages หรือ Firebase Hosting
หรือใช้โดเมน/เซิร์ฟเวอร์ของหน่วยงานเองก็ได้ ขอแค่เป็น https

## 4) ติดตั้งบน iPhone
เปิดลิงก์ด้วย **Safari** (ไม่ใช่ Chrome/LINE browser) > ปุ่มแชร์ > "เพิ่มไปยังหน้าจอโฮม" > เพิ่ม
ไอคอนจะขึ้นบนหน้าจอ เปิดแล้วเต็มจอไม่มีแถบ Safari
Android: Chrome > เมนู > "ติดตั้งแอป"

## ข้อควรรู้
- แก้ index.html แล้วอัปโหลดใหม่ ผู้ใช้ได้เวอร์ชันใหม่เมื่อเปิดแอปครั้งถัดไป
- ถ้าเปลี่ยนไฟล์ในแคชหลายไฟล์ ให้เปลี่ยนเลข room-booking-v1 ใน sw.js
- เปลี่ยนไอคอน: แทนไฟล์ใน icons/ (180, 192, 512 และ maskable 512)
