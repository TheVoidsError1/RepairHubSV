# 🔧 แก้ไข Build Command ใน Render

## ปัญหา
Build command ใน Render ตั้งค่าผิด ทำให้ build ล้มเหลว:
- ❌ `npm install & npm build` (ผิด)
- ✅ `npm install && npm run build` (ถูกต้อง)

## วิธีแก้ไข

### ขั้นตอนที่ 1: ไปที่ Render Dashboard
1. เปิด [Render Dashboard](https://dashboard.render.com/)
2. เลือกโปรเจกต์ **RepairHubSV**
3. ไปที่ **Settings** (⚙️ Settings) ใน sidebar

### ขั้นตอนที่ 2: แก้ไข Build Command
1. เลื่อนลงไปหา **Build Command**
2. เปลี่ยนจาก:
   ```
   npm install & npm build
   ```
   เป็น:
   ```
   npm install && npm run build
   ```
3. คลิก **Save Changes**

### ขั้นตอนที่ 3: Redeploy
1. ไปที่ **Events** tab
2. คลิก **Manual Deploy** → **Deploy latest commit**
3. หรือรอให้ auto-deploy เมื่อ push code ใหม่

## หมายเหตุ
- ใช้ `&&` (double ampersand) ไม่ใช่ `&` (single ampersand)
- ใช้ `npm run build` ไม่ใช่ `npm build`
- โปรเจกต์มีไฟล์ `render.yaml` อยู่แล้วที่ root directory ซึ่งจะช่วย auto-detect settings

## ตรวจสอบ
หลังจาก deploy ใหม่ ตรวจสอบ logs ว่ามีข้อความ:
```
==> Running build command 'npm install && npm run build'.
```

และไม่ควรมี error:
```
Unknown command: "build"
```
