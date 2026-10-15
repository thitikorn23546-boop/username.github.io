/**
 * ฟังก์ชันหลักสำหรับการเรียกใช้งาน Web App
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('ระบบจองห้องประชุมออนไลน์')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * ตรวจสอบและเตรียมความพร้อมของ Google Sheet
 */
function getDatabaseSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("ไม่พบสเปรดชีต กรุณารันสคริปต์นี้จากเมนู Extensions > Apps Script ใน Google Sheets");
  }
  
  var sheetName = "Bookings";
  var sheet = ss.getSheetByName(sheetName);
  
  // ถ้ายังไม่มีชีตนี้ ให้สร้างใหม่และตั้งค่า Header
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = ['ID', 'ชื่อผู้จอง', 'ตำแหน่ง', 'กอง', 'ห้องประชุม', 'วันที่', 'เวลาเริ่ม', 'เวลาสิ้นสุด', 'วัตถุประสงค์', 'เวลาที่บันทึก', 'สถานะ', 'อีเมลผู้จอง', 'เบอร์โทรศัพท์', 'ประเภทผู้จอง'];
    sheet.appendRow(headers);
    sheet.getRange("A1:M1").setFontWeight("bold").setBackground("#f3f4f6");
    sheet.getRange("M:M").setNumberFormat("@");
    sheet.setFrozenRows(1);
  } else {
    // ตรวจสอบเฉพาะชื่อ Header ห้ามแทรกคอลัมน์ระหว่างใช้งาน เพราะจะเลื่อนข้อมูลเดิมทุกครั้งที่เรียกฟังก์ชัน
    var expectedHeaders = ['ID', 'ชื่อผู้จอง', 'ตำแหน่ง', 'กอง', 'ห้องประชุม', 'วันที่', 'เวลาเริ่ม', 'เวลาสิ้นสุด', 'วัตถุประสงค์', 'เวลาที่บันทึก', 'สถานะ', 'อีเมลผู้จอง', 'เบอร์โทรศัพท์', 'ประเภทผู้จอง'];
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    
    sheet.getRange("M:M").setNumberFormat("@");
    sheet.getRange("A1:N1").setFontWeight("bold").setBackground("#f3f4f6");
  }
  
  return sheet;
}

/**
 * ตรวจสอบและเตรียมชีตบัญชีผู้ดูแลระบบ
 */
function getAdminSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("ไม่พบสเปรดชีต กรุณารันสคริปต์นี้จากเมนู Extensions > Apps Script ใน Google Sheets");
  }

  var sheet = ss.getSheetByName("admin");
  if (!sheet) {
    sheet = ss.insertSheet("admin");
    sheet.appendRow(['user', 'password']);
    sheet.getRange("A1:B1").setFontWeight("bold").setBackground("#f3f4f6");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function isAdminCredentialsValid(username, password) {
  var data = getAdminSheet().getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(username).trim() &&
        String(data[i][1]) === String(password)) {
      return true;
    }
  }
  return false;
}

function getAdminAllowedRooms(username) {
  var permissions = {
    admin: null,
    user1: ['สีคิ้ว 1', 'สีคิ้ว 2', 'จันทึก 1'],
    user2: ['อาคารโดม สวนสาธารณะสีคิ้ว'],
    user3: [
      'สนามฟุตซอล สวนสาธารณะบึงสีคิ้ว',
      'สนามฟุตบอล สวนสาธารณะบึงสีคิ้ว',
      'สนามแบดมินตัน สวนสาธารณะบึงสีคิ้ว',
      'สระว่ายน้ำ สวนสาธารณะบึงสีคิ้ว'
    ],
    user4: ['อาคารผู้สูงอายุ สวนสาธารณะบึงสีคิ้ว']
  };
  return permissions[String(username || '').trim()];
}

function canManageBooking(username, room) {
  var allowedRooms = getAdminAllowedRooms(username);
  return allowedRooms === null || (allowedRooms && allowedRooms.indexOf(room) !== -1);
}

function toBookingObject(row) {
  return {
    id: row[0],
    name: row[1],
    position: row[2],
    division: row[3],
    room: row[4],
    date: formatDate(row[5]),
    startTime: formatTime(row[6]),
    endTime: formatTime(row[7]),
    purpose: row[8],
    status: row[10],
    phone: row[12] || '',
    bookingType: row[13] || ''
  };
}

function sendBookingEmail(booking, status) {
  try {
    var statusText = {
      Pending: 'รับคำขอจองแล้ว กำลังรอเจ้าหน้าที่ตรวจสอบ',
      Approved: 'อนุมัติการจองแล้ว',
      Rejected: 'ไม่อนุมัติการจอง'
    }[status] || status;
    var statusColor = {
      Pending: '#b7791f',
      Approved: '#15803d',
      Rejected: '#b91c1c'
    }[status] || '#172554';
    var logoUrl = 'https://lh3.googleusercontent.com/d/1MQounZJh0h9uffGSQoehKPNf-Gwr0buQ';
    var subject = 'แจ้งสถานะการจองห้องประชุม ' + booking.id;
    var body = [
      'เรียน ' + booking.name,
      '',
      'สถานะการจอง: ' + statusText,
      'รหัสการจอง: ' + booking.id,
      'ห้องประชุม: ' + booking.room,
      'วันที่: ' + formatDate(booking.date),
      'เวลา: ' + booking.startTime + ' - ' + booking.endTime,
      'วัตถุประสงค์: ' + booking.purpose,
      '',
      'ระบบจองห้องประชุม'
    ].join('\n');

    var htmlBody = '<!DOCTYPE html>' +
      '<html lang="th"><body style="margin:0;padding:24px;background:#f4f1e8;font-family:Arial,Tahoma,sans-serif;color:#18213d;">' +
      '<div style="max-width:620px;margin:0 auto;background:#fffdf8;border:1px solid #e1d6b7;border-radius:12px;overflow:hidden;">' +
      '<div style="padding:24px 28px;background:#172554;border-bottom:5px solid #c9972b;">' +
      '<table role="presentation" style="border-collapse:collapse;"><tr>' +
      '<td style="padding:0 16px 0 0;vertical-align:middle;"><img src="' + logoUrl + '" width="64" height="64" alt="โลโก้ระบบจองห้องประชุม" style="display:block;width:64px;height:64px;object-fit:contain;background:#f6e7b0;border:3px solid #f6e7b0;border-radius:10px;"></td>' +
      '<td style="vertical-align:middle;"><div style="font-size:12px;letter-spacing:1px;color:#f6e7b0;">MEETING ROOM BOOKING</div>' +
      '<h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;font-weight:700;">แจ้งสถานะการจองห้องประชุม</h1></td>' +
      '</tr></table>' +
      '</div>' +
      '<div style="padding:28px;">' +
      '<p style="margin:0 0 18px;font-size:16px;">เรียน <strong>' + escapeHtmlForEmail(booking.name) + '</strong></p>' +
      '<div style="margin-bottom:24px;padding:16px 18px;background:#f8efcf;border-left:5px solid ' + statusColor + ';border-radius:6px;">' +
      '<div style="font-size:13px;color:#5b647b;margin-bottom:5px;">สถานะคำขอ</div>' +
      '<div style="color:' + statusColor + ';font-size:19px;font-weight:700;">' + escapeHtmlForEmail(statusText) + '</div>' +
      '</div>' +
      '<table role="presentation" style="width:100%;border-collapse:collapse;font-size:15px;">' +
      '<tr><td style="padding:10px 0;color:#6b7280;width:30%;">รหัสการจอง</td><td style="padding:10px 0;font-weight:700;">' + escapeHtmlForEmail(booking.id) + '</td></tr>' +
      '<tr><td style="padding:10px 0;color:#6b7280;border-top:1px solid #eee8d8;">ห้องประชุม</td><td style="padding:10px 0;border-top:1px solid #eee8d8;font-weight:600;">' + escapeHtmlForEmail(booking.room) + '</td></tr>' +
      '<tr><td style="padding:10px 0;color:#6b7280;border-top:1px solid #eee8d8;">วันที่</td><td style="padding:10px 0;border-top:1px solid #eee8d8;">' + escapeHtmlForEmail(formatDate(booking.date)) + '</td></tr>' +
      '<tr><td style="padding:10px 0;color:#6b7280;border-top:1px solid #eee8d8;">เวลา</td><td style="padding:10px 0;border-top:1px solid #eee8d8;">' + escapeHtmlForEmail(booking.startTime) + ' - ' + escapeHtmlForEmail(booking.endTime) + ' น.</td></tr>' +
      '<tr><td style="padding:10px 0;color:#6b7280;border-top:1px solid #eee8d8;vertical-align:top;">วัตถุประสงค์</td><td style="padding:10px 0;border-top:1px solid #eee8d8;">' + escapeHtmlForEmail(booking.purpose) + '</td></tr>' +
      '</table>' +
      '</div>' +
      '<div style="padding:18px 28px;background:#172554;color:#f6e7b0;font-size:13px;text-align:center;">ระบบจองห้องประชุม</div>' +
      '</div></body></html>';

    MailApp.sendEmail(booking.email, subject, body, { htmlBody: htmlBody, name: 'ระบบจองห้องประชุม' });
    return true;
  } catch (error) {
    Logger.log('ส่งอีเมลไม่สำเร็จ: ' + error.message);
    return false;
  }
}

function sendNewBookingNotification(booking) {
  try {
    var recipient = Session.getEffectiveUser().getEmail();
    if (!recipient) {
      Logger.log('ไม่พบอีเมลผู้รับแจ้งเตือนคำขอจองใหม่');
      return false;
    }

    var subject = 'มีคำขอจองห้องประชุมใหม่ ' + booking.id;
    var body = [
      'มีคำขอจองห้องประชุมใหม่รอการอนุมัติ',
      '',
      'รหัสการจอง: ' + booking.id,
      'ผู้จอง: ' + booking.name,
      'ตำแหน่ง: ' + booking.position,
      'กอง: ' + booking.division,
      'อีเมลผู้จอง: ' + booking.email,
      'เบอร์โทรศัพท์: ' + booking.phone,
      'ประเภทผู้จอง: ' + booking.bookingType,
      'ห้องประชุม: ' + booking.room,
      'วันที่: ' + formatDate(booking.date),
      'เวลา: ' + booking.startTime + ' - ' + booking.endTime + ' น.',
      'วัตถุประสงค์: ' + booking.purpose,
      '',
      'กรุณาเข้าสู่ระบบเพื่อพิจารณาคำขอ'
    ].join('\n');

    MailApp.sendEmail(recipient, subject, body, { name: 'ระบบจองห้องประชุม' });
    return true;
  } catch (error) {
    Logger.log('ส่งอีเมลแจ้งเตือนคำขอใหม่ไม่สำเร็จ: ' + error.message);
    return false;
  }
}

/**
 * ส่งข้อความแจ้งเตือนไปยังกลุ่ม/ผู้ใช้ LINE ผ่าน Messaging API
 * ต้องตั้งค่า Script Properties ก่อนใช้งาน: LINE_CHANNEL_ACCESS_TOKEN, LINE_GROUP_ID
 * (Project Settings > Script Properties ใน Apps Script)
 */
function sendLineNotification(message) {
  try {
    var props = PropertiesService.getScriptProperties();
    var token = props.getProperty('LINE_CHANNEL_ACCESS_TOKEN');
    var groupId = props.getProperty('LINE_GROUP_ID');
    if (!token || !groupId) {
      Logger.log('ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN หรือ LINE_GROUP_ID ใน Script Properties');
      return false;
    }
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({
        to: groupId,
        messages: [{ type: 'text', text: message }]
      }),
      muteHttpExceptions: true
    });
    return true;
  } catch (error) {
    Logger.log('ส่งแจ้งเตือน LINE ไม่สำเร็จ: ' + error.message);
    return false;
  }
}

function sendLineBookingStatusNotification(booking, status, adminUsername) {
  var isApproved = status === 'Approved';
  var statusLabel = isApproved ? 'อนุมัติการจองแล้ว' : 'ไม่อนุมัติการจอง';
  var statusIcon = isApproved ? '✅' : '❌';

  sendLineNotification(
    statusIcon + ' ' + statusLabel + '\n' +
    '━━━━━━━━━━━━━━\n' +
    '🆔 รหัสการจอง: ' + booking.id + '\n\n' +
    '📍 ห้องประชุม: ' + booking.room + '\n' +
    '📅 วันที่: ' + formatDate(booking.date) + '\n' +
    '⏰ เวลา: ' + booking.startTime + ' - ' + booking.endTime + ' น.\n\n' +
    '👤 ผู้จอง: ' + booking.name + '\n' +
    '📝 วัตถุประสงค์: ' + booking.purpose + '\n' +
    '🛡️ ดำเนินการโดย: ' + adminUsername + '\n' +
    '━━━━━━━━━━━━━━\n' +
    'สถานะ: ' + statusLabel
  );
}

/**
 * Webhook รับ Event จาก LINE — ใช้ตอนตั้งค่าครั้งแรกเพื่อดู Group ID
 * วิธีใช้: ผูก URL ของ Web App นี้เป็น Webhook URL ใน LINE Developers Console (ต้องตั้ง
 * LINE_CHANNEL_ACCESS_TOKEN ใน Script Properties ไว้ก่อน) แล้วเชิญบอทเข้ากลุ่มเจ้าหน้าที่
 * พิมพ์ข้อความอะไรก็ได้ในกลุ่ม บอทจะตอบกลับ Group ID เข้าไปในแชททันที
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    // คำขอจากแอป/PWA (มี action) ส่งไปประมวลผลเป็น API; คำขอจาก LINE (มี events) ทำงานตามเดิม
    if (payload && payload.action) return handleApiRequest(payload);
    var token = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');

    (payload.events || []).forEach(function(event) {
      var source = event.source || {};
      var idType = source.groupId ? 'Group ID' : (source.roomId ? 'Room ID' : (source.userId ? 'User ID' : ''));
      var id = source.groupId || source.roomId || source.userId || '';
      if (!id) return;

      Logger.log(idType + ': ' + id);

      // ตอบกลับ ID เข้าไปในแชทโดยตรง เพื่อให้เห็นทันทีโดยไม่ต้องเปิดดู Log
      if (token && event.replyToken) {
        UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
          method: 'post',
          contentType: 'application/json',
          headers: { Authorization: 'Bearer ' + token },
          payload: JSON.stringify({
            replyToken: event.replyToken,
            messages: [{ type: 'text', text: idType + ': ' + id }]
          }),
          muteHttpExceptions: true
        });
      }
    });
  } catch (error) {
    Logger.log('doPost error: ' + error.message);
  }
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * API สำหรับแอปมือถือ/PWA — รับ {action, args} แล้วเรียกฟังก์ชันที่อนุญาตเท่านั้น
 */
function handleApiRequest(payload) {
  var allowed = {
    getBookings: getBookings,
    addBooking: addBooking,
    getPendingBookings: getPendingBookings,
    getPendingBookingCount: getPendingBookingCount,
    approveBooking: approveBooking,
    rejectBooking: rejectBooking
  };
  var result;
  try {
    var fn = allowed[payload.action];
    if (!fn) throw new Error('ไม่รู้จักคำสั่ง: ' + payload.action);
    result = { ok: true, data: fn.apply(null, payload.args || []) };
  } catch (error) {
    result = { ok: false, error: error.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function escapeHtmlForEmail(value) {
  return String(value || '').replace(/[&<>'"]/g, function(character) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character];
  });
}

/**
 * ดึงข้อมูลการจองทั้งหมดเพื่อแสดงผลในตาราง
 */
function getBookings() {
  try {
    var sheet = getDatabaseSheet();
    var data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) return []; // มีแต่ Header
    
    var headers = data[0];
    var bookings = [];
    
    // แปลงข้อมูลจาก Array ให้เป็น Object เพื่อให้ Frontend ใช้งานง่าย
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      // แสดงเฉพาะรายการที่เจ้าหน้าที่อนุมัติแล้ว
      if (row[10] !== 'Approved' && row[10] !== 'Active') continue;

      bookings.push(toBookingObject(row));
    }
    
    // เรียงลำดับจากล่าสุดไปเก่าสุด
    return bookings.reverse();
  } catch (error) {
    throw new Error("เกิดข้อผิดพลาดในการดึงข้อมูล: " + error.message);
  }
}

/**
 * เพิ่มการจองใหม่ และตรวจสอบการชนกันของเวลา
 */
function addBooking(bookingData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var sheet = getDatabaseSheet();
    var data = sheet.getDataRange().getValues();

    if (!bookingData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bookingData.email)) {
      throw new Error("กรุณาระบุอีเมลผู้จองให้ถูกต้อง");
    }
    if (!bookingData.phone || !/^[0-9+() -]{8,20}$/.test(bookingData.phone)) {
      throw new Error("กรุณาระบุเบอร์โทรศัพท์ให้ถูกต้อง");
    }
    
    // ตรวจสอบการจองซ้ำซ้อน (Conflict Check)
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (row[10] !== 'Approved' && row[10] !== 'Active') continue;
      
      var existRoom = row[4];
      var existDate = formatDate(row[5]);
      var existStart = formatTime(row[6]); // บังคับ format เวลา
      var existEnd = formatTime(row[7]);   // บังคับ format เวลา
      
      // ถ้าเป็นห้องเดียวกัน และวันเดียวกัน ต้องเช็คเวลา
      if (existRoom === bookingData.room && existDate === bookingData.date) {
        if (isTimeOverlap(bookingData.startTime, bookingData.endTime, existStart, existEnd)) {
          throw new Error("ห้องนี้ถูกจองแล้วในช่วงเวลาดังกล่าว กรุณาเลือกเวลาหรือห้องอื่น");
        }
      }
    }
    
    // สร้าง ID ใหม่ และบันทึกข้อมูล
    var newId = 'BK' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmmss");
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
    
    var newRow = [
      newId,
      bookingData.name,
      bookingData.position,
      bookingData.division,
      bookingData.room,
      bookingData.date,
      bookingData.startTime,
      bookingData.endTime,
      bookingData.purpose,
      timestamp,
      'Pending',
      bookingData.email,
      bookingData.phone,
      bookingData.bookingType
    ];
    
    sheet.appendRow(newRow);
    var savedRow = sheet.getLastRow();
    sheet.getRange(savedRow, 13).setNumberFormat('@').setValue(String(bookingData.phone).trim());
    sendBookingEmail({
      id: newId,
      name: bookingData.name,
      email: bookingData.email,
      phone: bookingData.phone,
      bookingType: bookingData.bookingType,
      room: bookingData.room,
      date: bookingData.date,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      purpose: bookingData.purpose
    }, 'Pending');
    sendNewBookingNotification({
      id: newId,
      name: bookingData.name,
      position: bookingData.position,
      division: bookingData.division,
      bookingType: bookingData.bookingType,
      email: bookingData.email,
      phone: bookingData.phone,
      room: bookingData.room,
      date: bookingData.date,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      purpose: bookingData.purpose
    });
    sendLineNotification(
      '📢 แจ้งเตือนคำขอจองห้องประชุม\n' +
      '━━━━━━━━━━━━━━\n' +
      '🆔 รหัสการจอง: ' + newId + '\n\n' +
      '📍 สถานที่\n' +
      'ห้องประชุม: ' + bookingData.room + '\n' +
      '📅 วันที่: ' + bookingData.date + '\n' +
      '⏰ เวลา: ' + bookingData.startTime + ' - ' + bookingData.endTime + ' น.\n\n' +
      '👤 ผู้จอง\n' +
      'ชื่อ: ' + bookingData.name + '\n' +
      'ตำแหน่ง: ' + bookingData.position + '\n' +
      'กอง/หน่วยงาน: ' + bookingData.division + '\n' +
      'ประเภท: ' + bookingData.bookingType + '\n\n' +
      '📝 วัตถุประสงค์\n' +
      bookingData.purpose + '\n' +
      '━━━━━━━━━━━━━━\n' +
      'สถานะ: รอเจ้าหน้าที่ตรวจสอบ'
    );
    return { success: true, message: "ส่งคำขอจองแล้ว กรุณารอเจ้าหน้าที่อนุมัติ" };
    
  } catch (error) {
    return { success: false, message: error.message };
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

/**
 * ตรวจสอบเวลาว่าทับซ้อนกันหรือไม่
 */
function isTimeOverlap(start1, end1, start2, end2) {
  // แปลงเวลา "HH:mm" เป็นตัวเลขนาทีเพื่อเปรียบเทียบ
  var s1 = timeToMinutes(start1);
  var e1 = timeToMinutes(end1);
  var s2 = timeToMinutes(start2);
  var e2 = timeToMinutes(end2);
  
  return (s1 < e2 && e1 > s2);
}

function timeToMinutes(timeStr) {
  var parts = timeStr.toString().split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function formatDate(dateObj) {
  if (!dateObj) return "";
  // กรณีข้อมูลในชีตเป็น String อยู่แล้ว
  if (typeof dateObj === 'string') {
    return dateObj.split('T')[0]; // ป้องกันกรณีมีเวลาติดมาใน string
  }
  // แปลง Date object ให้เป็น YYYY-MM-DD
  return Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

/**
 * แปลงข้อมูลเวลาจาก Sheet ให้เป็น String รูปแบบ HH:mm เพื่อไม่ให้ FullCalendar อ่านค่าผิดพลาด
 */
function formatTime(timeObj) {
  if (!timeObj) return "";
  
  // กรณีเป็น String อยู่แล้ว (เช่น "09:00" หรือ "09:00:00")
  if (typeof timeObj === 'string') {
    return timeObj.substring(0, 5); // เอาแค่ 5 ตัวอักษรแรก (HH:mm)
  }
  
  // กรณี Google Sheet อ่านเป็น Date object ภายใน (1899-12-30)
  return Utilities.formatDate(timeObj, Session.getScriptTimeZone(), "HH:mm");
}

function getPendingBookings(username, password) {
  if (!isAdminCredentialsValid(username, password)) {
    throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  }

  var data = getDatabaseSheet().getDataRange().getValues();
  var pending = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][10] === 'Pending' && canManageBooking(username, data[i][4])) {
      pending.push(toBookingObject(data[i]));
    }
  }
  return pending.reverse();
}

function getPendingBookingCount(username, password) {
  if (!isAdminCredentialsValid(username, password)) return 0;

  var data = getDatabaseSheet().getDataRange().getValues();
  var count = 0;

  for (var i = 1; i < data.length; i++) {
    if (data[i][10] === 'Pending' && canManageBooking(username, data[i][4])) count++;
  }

  return count;
}

function approveBooking(bookingId, username, password) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    if (!isAdminCredentialsValid(username, password)) {
      throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    }

    var sheet = getDatabaseSheet();
    var data = sheet.getDataRange().getValues();
    var targetRow = -1;
    var target = null;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(bookingId)) {
        targetRow = i + 1;
        target = data[i];
        break;
      }
    }
    if (!target) throw new Error("ไม่พบคำขอจองนี้");
    if (target[10] !== 'Pending') throw new Error("คำขอนี้ถูกดำเนินการไปแล้ว");
    if (!canManageBooking(username, target[4])) {
      throw new Error("คุณไม่มีสิทธิ์อนุมัติห้องประชุมนี้");
    }

    for (var j = 1; j < data.length; j++) {
      var row = data[j];
      if (row[10] !== 'Approved' && row[10] !== 'Active') continue;
      if (row[4] === target[4] && formatDate(row[5]) === formatDate(target[5]) &&
          isTimeOverlap(formatTime(target[6]), formatTime(target[7]), formatTime(row[6]), formatTime(row[7]))) {
        throw new Error("ไม่สามารถอนุมัติได้ เพราะช่วงเวลานี้ถูกอนุมัติแล้ว");
      }
    }

    sheet.getRange(targetRow, 11).setValue('Approved');
    sendBookingEmail({
      id: target[0],
      name: target[1],
      email: target[11],
      phone: target[12],
      room: target[4],
      date: target[5],
      startTime: formatTime(target[6]),
      endTime: formatTime(target[7]),
      purpose: target[8]
    }, 'Approved');
    sendLineBookingStatusNotification({
      id: target[0],
      name: target[1],
      room: target[4],
      date: target[5],
      startTime: formatTime(target[6]),
      endTime: formatTime(target[7]),
      purpose: target[8]
    }, 'Approved', username);
    return { success: true, message: "อนุมัติการจองสำเร็จ" };
  } catch (error) {
    return { success: false, message: error.message };
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function rejectBooking(bookingId, username, password) {
  try {
    if (!isAdminCredentialsValid(username, password)) {
      throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    }

    var sheet = getDatabaseSheet();
    var data = sheet.getDataRange().getValues();
    var targetRow = -1;
    var target = null;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(bookingId)) {
        targetRow = i + 1;
        target = data[i];
        break;
      }
    }
    if (!target) throw new Error("ไม่พบคำขอจองนี้");
    if (target[10] !== 'Pending') throw new Error("คำขอนี้ถูกดำเนินการไปแล้ว");
    if (!canManageBooking(username, target[4])) {
      throw new Error("คุณไม่มีสิทธิ์ไม่อนุมัติห้องประชุมนี้");
    }

    sheet.getRange(targetRow, 11).setValue('Rejected');
    sendBookingEmail({
      id: target[0],
      name: target[1],
      email: target[11],
      phone: target[12],
      room: target[4],
      date: target[5],
      startTime: formatTime(target[6]),
      endTime: formatTime(target[7]),
      purpose: target[8]
    }, 'Rejected');
    sendLineBookingStatusNotification({
      id: target[0],
      name: target[1],
      room: target[4],
      date: target[5],
      startTime: formatTime(target[6]),
      endTime: formatTime(target[7]),
      purpose: target[8]
    }, 'Rejected', username);
    return { success: true, message: "ไม่อนุมัติคำขอจองแล้ว" };
  } catch (error) {
    return { success: false, message: error.message };
  }
}