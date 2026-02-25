# 🚀 คู่มือ Deploy ขึ้น Vercel

## ขั้นตอนการ Deploy

### วิธีที่ 1: ใช้ Vercel CLI (แนะนำสำหรับเริ่มต้น)

1. **ติดตั้ง Vercel CLI** (ถ้ายังไม่มี):
   ```bash
   npm i -g vercel
   ```

2. **Login เข้า Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy โปรเจกต์**:
   ```bash
   vercel
   ```
   
   - เลือก scope (personal หรือ team)
   - Link to existing project? → **No** (สำหรับครั้งแรก)
   - Project name → ตั้งชื่อโปรเจกต์ (เช่น `repair-hub-pro`)
   - Directory → `.` (root directory)
   - Override settings? → **No**

4. **Deploy ขึ้น Production**:
   ```bash
   vercel --prod
   ```

### วิธีที่ 2: ใช้ GitHub Integration (แนะนำสำหรับ production)

1. **Push โปรเจกต์ไปยัง GitHub**:
   ```bash
   git add .
   git commit -m "Ready for Vercel deployment"
   git push origin main
   ```

2. **ไปที่ Vercel Dashboard**:
   - เปิด [https://vercel.com/dashboard](https://vercel.com/dashboard)
   - คลิก **"Add New Project"**

3. **Import GitHub Repository**:
   - เลือก repository ของคุณ
   - Vercel จะ auto-detect settings จาก `vercel.json`

4. **ตรวจสอบ Settings**:
   - **Framework Preset**: Vite (auto-detected)
   - **Root Directory**: `.` (root)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)

5. **ตั้งค่า Environment Variables** (สำคัญ!):
   - คลิก **"Environment Variables"**
   - เพิ่ม:
     - **Name**: `VITE_API_BASE_URL`
     - **Value**: URL ของ Backend ที่ deploy แล้ว (เช่น `https://your-backend.railway.app`)
     - **Environment**: Production, Preview, Development (เลือกตามต้องการ)
   - คลิก **"Add"**

6. **Deploy**:
   - คลิก **"Deploy"**
   - รอให้ build เสร็จ (ประมาณ 2-3 นาที)

## ⚠️ สิ่งสำคัญที่ต้องทำ

### 1. ตั้งค่า Environment Variable: `VITE_API_BASE_URL`

**สำคัญมาก!** Frontend ต้องรู้ว่า Backend อยู่ที่ไหน

1. ไปที่ Vercel Dashboard → Project → Settings → Environment Variables
2. เพิ่ม:
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: URL ของ Backend (เช่น `https://your-backend.railway.app`)
   - **Environment**: Production, Preview, Development

3. **Redeploy** หลังจากตั้งค่า:
   - ไปที่ Deployments tab
   - คลิก "..." → "Redeploy"

### 2. ตรวจสอบว่า Backend Deploy แล้ว

Frontend ต้องมี Backend ที่ deploy แล้วก่อน:
- Backend ต้อง deploy บน Railway, Render, หรือ platform อื่น
- ดูคู่มือใน `VERCEL_NEON_SETUP.md` สำหรับการ deploy backend

### 3. ตรวจสอบ CORS Settings ใน Backend

Backend ต้องอนุญาต Frontend URL:
- ตั้งค่า `FRONTEND_URL` ใน Backend environment variables
- ตัวอย่าง: `FRONTEND_URL=https://your-app.vercel.app`

## ✅ ตรวจสอบการทำงาน

หลังจาก deploy เสร็จ:

1. **เปิด URL จาก Vercel** (เช่น `https://your-app.vercel.app`)

2. **เปิด Browser Console** (F12):
   - ควรเห็น: `🔗 Using API Base URL from environment: https://your-backend-url.com`
   - ไม่ควรมี error "Cannot connect to backend API"

3. **ทดสอบ Login**:
   - Email: `admin@example.com`
   - Password: `123456`

4. **ตรวจสอบ Network Tab**:
   - API calls ควรไปที่ Backend URL ที่ตั้งค่าไว้
   - ไม่ควรมี CORS errors

## 🐛 แก้ไขปัญหาที่พบบ่อย

### ปัญหา: Frontend ไม่สามารถเชื่อมต่อ Backend ได้

**แก้ไข**:
1. ตรวจสอบว่า `VITE_API_BASE_URL` ตั้งค่าถูกต้องใน Vercel
2. ตรวจสอบว่า Backend URL ถูกต้องและทำงาน
3. ตรวจสอบ CORS settings ใน Backend (`FRONTEND_URL`)
4. Redeploy Frontend หลังจากเปลี่ยน Environment Variables

### ปัญหา: Build ล้มเหลว

**แก้ไข**:
1. ตรวจสอบ logs ใน Vercel Dashboard → Deployments → Build Logs
2. ตรวจสอบว่า `package.json` มี dependencies ครบ
3. ตรวจสอบว่า `vercel.json` ถูกต้อง

### ปัญหา: Socket.IO ไม่ทำงาน

**แก้ไข**:
1. ตรวจสอบว่า Backend รองรับ WebSocket
2. ตรวจสอบว่า `VITE_API_BASE_URL` ตั้งค่าถูกต้อง
3. ตรวจสอบ CORS settings

## 📚 ดูรายละเอียดเพิ่มเติม

- `VERCEL_NEON_SETUP.md` - คู่มือฉบับเต็มสำหรับ Vercel + Neon
- `DEPLOY_QUICK_START.md` - คู่มือสั้นๆ สำหรับเริ่มต้น

## 🎉 เสร็จสิ้น!

หลังจากทำตามขั้นตอนทั้งหมดแล้ว คุณควรมี:
- ✅ Frontend deploy บน Vercel
- ✅ Backend deploy บน Railway/Render/etc.
- ✅ Database ใช้ Neon PostgreSQL
- ✅ ทุกอย่างเชื่อมต่อกันและทำงานได้
