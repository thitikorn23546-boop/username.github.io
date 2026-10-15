// Service worker: แคชหน้าแอปให้เปิดเร็วและเปิดได้แม้ออฟไลน์ (ข้อมูลการจองต้องใช้เน็ตเสมอ)
const CACHE = 'room-booking-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // POST ไป Apps Script ไม่แคช
  const url = new URL(req.url);
  if (url.pathname.includes('/macros/')) return;                 // อย่าแคชการเรียก API

  // หน้าแอป: ลองเน็ตก่อน ถ้าไม่ได้ใช้ของในแคช (แก้ไขแล้วผู้ใช้ได้เวอร์ชันใหม่ทันที)
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }

  // ไฟล์อื่น (Tailwind, FullCalendar, ฟอนต์, ไอคอน): ใช้แคชก่อน แล้วอัปเดตเบื้องหลัง
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
