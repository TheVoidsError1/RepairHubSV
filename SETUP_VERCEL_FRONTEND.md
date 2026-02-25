# 🚀 ตั้งค่า Frontend (Vercel) ให้เชื่อมต่อกับ Backend (Render)

## 📋 ข้อมูลที่ต้องใช้

- **Backend URL**: `https://repairhubsv.onrender.com`
- **Frontend**: Deploy บน Vercel

## ✅ ขั้นตอนการตั้งค่า

### ขั้นตอนที่ 1: ไปที่ Vercel Dashboard

1. เปิด [Vercel Dashboard](https://vercel.com/dashboard)
2. เลือกโปรเจกต์ Frontend ของคุณ (RepairHubSV หรือชื่ออื่น)

### ขั้นตอนที่ 2: ตั้งค่า Environment Variable

1. ไปที่ **Settings** → **Environment Variables**
2. คลิก **Add New**
3. ตั้งค่า:
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: `https://repairhubsv.onrender.com`
   - **Environment**: เลือก **Production**, **Preview**, และ **Development** (หรือเลือกตามต้องการ)
4. คลิก **Save**

### ขั้นตอนที่ 3: Redeploy Frontend

1. ไปที่ **Deployments** tab
2. คลิก **"..."** (สามจุด) ที่ deployment ล่าสุด
3. เลือก **Redeploy**
4. รอให้ build และ deploy เสร็จ (ประมาณ 2-3 นาที)

## ✅ ตรวจสอบการทำงาน

### 1. ตรวจสอบ Backend

เปิดเบราว์เซอร์ไปที่:
```
https://repairhubsv.onrender.com/health
```

ควรเห็น:
```json
{
  "status": "ok",
  "message": "Server is running"
}
```

### 2. ตรวจสอบ Frontend

1. เปิด URL จาก Vercel (เช่น `https://your-app.vercel.app`)
2. กด **F12** → เปิด **Console** tab
3. ควรเห็นข้อความ:
   ```
   🔗 Using API Base URL from environment: https://repairhubsv.onrender.com
   ```
4. ไม่ควรมี error "Cannot connect to backend API"

### 3. ทดสอบ Login

1. เปิดหน้า Login
2. ใช้ credentials:
   - Email: `admin@example.com`
   - Password: `123456`
3. ควร login ได้สำเร็จ

## 🔄 อัปเดต CORS ใน Backend (สำคัญมาก! ต้องทำ)

**⚠️ ต้องตั้งค่านี้เพื่อแก้ปัญหา CORS Error!**

ถ้า Frontend ยังเชื่อมต่อ Backend ไม่ได้ หรือเห็น error:
```
Access to fetch at 'https://repairhubsv.onrender.com/api/auth/login' 
has been blocked by CORS policy
```

**วิธีแก้ไข:**

1. **หา Frontend URL จาก Vercel:**
   - ไปที่ Vercel Dashboard → เลือกโปรเจกต์
   - คัดลอก URL (เช่น `https://repair-hub-90qni8joc-minis-projects-48aecca1.vercel.app`)
   - หรือดูจาก Production Domain ใน Settings → Domains

2. **ตั้งค่าใน Render:**
   - ไปที่ **Render Dashboard** → เลือก service **RepairHubSV**
   - ไปที่ **Environment** tab (ใน sidebar ใต้ MANAGE)
   - คลิก **Add Environment Variable**
   - ตั้งค่า:
     - **Key**: `FRONTEND_URL`
     - **Value**: URL ของ Frontend บน Vercel (เช่น `https://repair-hub-90qni8joc-minis-projects-48aecca1.vercel.app`)
       - **สำคัญ**: ต้องใส่ URL เต็ม ไม่มี trailing slash (`/`)
       - ถ้ามีหลาย domain (เช่น preview deployments) ให้ใส่หลายค่าแยกด้วย comma: `https://app1.vercel.app,https://app2.vercel.app`
   - คลิก **Save Changes**

3. **Redeploy Backend:**
   - Render จะ restart อัตโนมัติหลังจาก save
   - หรือไปที่ **Events** tab → **Manual Deploy** → **Deploy latest commit**
   - รอให้ deploy เสร็จ (ประมาณ 1-2 นาที)

## 📝 สรุป Environment Variables

### Frontend (Vercel):
- `VITE_API_BASE_URL` = `https://repairhubsv.onrender.com`

### Backend (Render):
- `DB_API_BACKEND` = Connection String จาก Neon
- `FRONTEND_URL` = URL ของ Frontend บน Vercel (เช่น `https://your-app.vercel.app`)
- `NODE_ENV` = `production`

## 🐛 แก้ไขปัญหา

### ปัญหา: Frontend ไม่สามารถเชื่อมต่อ Backend ได้

**ตรวจสอบ**:
1. ✅ Backend URL ถูกต้องและทำงาน (เปิด `/health`)
2. ✅ `VITE_API_BASE_URL` ตั้งค่าถูกต้องใน Vercel
3. ✅ `FRONTEND_URL` ตั้งค่าถูกต้องใน Render
4. ✅ Redeploy ทั้ง Frontend และ Backend หลังจากแก้ไข

### ปัญหา: CORS Error

**แก้ไข**:
- ตรวจสอบว่า `FRONTEND_URL` ใน Render ตรงกับ URL ของ Frontend บน Vercel
- Redeploy Backend

### ปัญหา: Environment Variable ไม่ทำงาน

**แก้ไข**:
- ตรวจสอบว่า Environment Variable ตั้งค่าใน **Production** environment
- **Redeploy** Frontend หลังจากตั้งค่า (สำคัญมาก!)
- Vite environment variables ต้องมี prefix `VITE_` และต้อง rebuild

## ✅ เสร็จสิ้น!

หลังจากทำตามขั้นตอนทั้งหมดแล้ว:
- ✅ Frontend บน Vercel
- ✅ Backend บน Render (`https://repairhubsv.onrender.com`)
- ✅ Database ใช้ Neon
- ✅ ทุกอย่างเชื่อมต่อกันและทำงานได้
