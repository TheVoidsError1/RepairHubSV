# 🔧 แก้ไข CORS Error - Frontend ไม่สามารถเชื่อมต่อ Backend ได้

## ❌ ปัญหา

เมื่อเปิด Frontend บน Vercel จะเห็น error ใน Console:
```
Access to fetch at 'https://repairhubsv.onrender.com/api/auth/login' 
from origin 'https://your-app.vercel.app' 
has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

และหน้าเว็บจะแสดง:
```
เข้าสู่ระบบล้มเหลว
Cannot connect to backend API. Please check VITE_API_BASE_URL configuration.
```

## ✅ วิธีแก้ไข

### ขั้นตอนที่ 1: หา Frontend URL จาก Vercel

1. ไปที่ [Vercel Dashboard](https://vercel.com/dashboard)
2. เลือกโปรเจกต์ Frontend ของคุณ
3. ดู **Production Domain** หรือ URL จาก Deployments
4. **คัดลอก URL เต็ม** (เช่น `https://repair-hub-90qni8joc-minis-projects-48aecca1.vercel.app`)

### ขั้นตอนที่ 2: ตั้งค่า FRONTEND_URL ใน Render

1. ไปที่ [Render Dashboard](https://dashboard.render.com/)
2. เลือก service **RepairHubSV** (Backend)
3. ไปที่ **Environment** tab (ใน sidebar ใต้ MANAGE)
4. คลิก **Add Environment Variable** (หรือแก้ไขถ้ามีอยู่แล้ว)
5. ตั้งค่า:
   - **Key**: `FRONTEND_URL`
   - **Value**: URL ของ Frontend จาก Vercel
     - ตัวอย่าง: `https://repair-hub-90qni8joc-minis-projects-48aecca1.vercel.app`
     - **สำคัญ**: 
       - ต้องใส่ URL เต็ม (มี `https://`)
       - ไม่มี trailing slash (`/`) ท้าย URL
       - ถ้ามีหลาย domain (เช่น preview deployments) ให้ใส่หลายค่าแยกด้วย comma:
         ```
         https://app.vercel.app,https://app-preview.vercel.app
         ```
6. คลิก **Save Changes**

### ขั้นตอนที่ 3: Redeploy Backend

1. ไปที่ **Events** tab
2. คลิก **Manual Deploy** → **Deploy latest commit**
3. รอให้ deploy เสร็จ (ประมาณ 1-2 นาที)
4. ตรวจสอบ logs ว่าไม่มี error

### ขั้นตอนที่ 4: ทดสอบ

1. เปิด Frontend URL จาก Vercel
2. กด **F12** → เปิด **Console**
3. **ไม่ควรมี** CORS error อีกต่อไป
4. ทดสอบ Login:
   - Email: `admin@example.com`
   - Password: `123456`
5. ควร login ได้สำเร็จ

## 📝 ตรวจสอบ Environment Variables

### Backend (Render) ต้องมี:
- ✅ `DB_API_BACKEND` = Connection String จาก Neon
- ✅ `FRONTEND_URL` = URL ของ Frontend บน Vercel (สำคัญมาก!)
- ✅ `NODE_ENV` = `production`

### Frontend (Vercel) ต้องมี:
- ✅ `VITE_API_BASE_URL` = `https://repairhubsv.onrender.com`

## 🐛 ถ้ายังมีปัญหา

### ตรวจสอบว่า FRONTEND_URL ถูกต้อง:
1. ไปที่ Render Dashboard → Environment
2. ตรวจสอบว่า `FRONTEND_URL` ตรงกับ URL จริงของ Frontend บน Vercel
3. ตรวจสอบว่าไม่มี trailing slash (`/`)
4. ตรวจสอบว่าใส่ `https://` ครบ

### ตรวจสอบว่า Backend Restart แล้ว:
1. ไปที่ Render Dashboard → Events
2. ดู deployment ล่าสุดว่ามี timestamp หลังจากที่ตั้งค่า `FRONTEND_URL`
3. ถ้ายังไม่ restart → กด Manual Deploy

### ตรวจสอบ CORS ใน Logs:
1. ไปที่ Render Dashboard → Logs
2. ดูว่ามี error เกี่ยวกับ CORS หรือไม่
3. ตรวจสอบว่า server start สำเร็จ

## 💡 หมายเหตุ

- Backend จะอนุญาตเฉพาะ origin ที่ระบุใน `FRONTEND_URL` เท่านั้น
- ถ้ามีหลาย Vercel deployments (Production, Preview) ให้ใส่หลาย URL แยกด้วย comma
- หลังจากตั้งค่า `FRONTEND_URL` แล้ว ต้อง redeploy Backend เพื่อให้การตั้งค่าใหม่มีผล
