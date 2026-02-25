# 🚀 ขั้นตอนการ Deploy Repair Hub Pro

## ✅ สิ่งที่เตรียมไว้แล้ว
- ✅ `vercel.json` - ตั้งค่าแล้ว
- ✅ Frontend build ผ่านแล้ว (`npm run build`)
- ✅ Backend build ผ่านแล้ว (`npm run build`)

---

## 📋 ขั้นตอนการ Deploy

### ขั้นตอนที่ 1: Deploy Frontend บน Vercel

#### วิธีที่ 1: ใช้ Vercel CLI (แนะนำ - เร็วที่สุด)

1. **ติดตั้ง Vercel CLI** (ถ้ายังไม่มี):
   ```bash
   npm i -g vercel
   ```

2. **Login เข้า Vercel**:
   ```bash
   vercel login
   ```
   - จะเปิด browser ให้ login
   - เลือก GitHub, GitLab, หรือ Bitbucket

3. **Deploy โปรเจกต์**:
   ```bash
   vercel
   ```
   
   ตอบคำถาม:
   - **Set up and deploy?** → `Y`
   - **Which scope?** → เลือก personal หรือ team
   - **Link to existing project?** → `N` (สำหรับครั้งแรก)
   - **What's your project's name?** → ตั้งชื่อ (เช่น `repair-hub-pro`)
   - **In which directory is your code located?** → `./` (กด Enter)
   - **Want to override the settings?** → `N` (ใช้ vercel.json ที่มีอยู่)

4. **Deploy to Production**:
   ```bash
   vercel --prod
   ```
   
   หลังจากเสร็จ Vercel จะให้ URL เช่น: `https://your-project.vercel.app`

#### วิธีที่ 2: ใช้ GitHub Integration (แนะนำสำหรับ production)

1. **Push โปรเจกต์ไป GitHub** (ถ้ายังไม่ได้ push):
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Deploy บน Vercel Dashboard**:
   - ไปที่ [Vercel Dashboard](https://vercel.com/dashboard)
   - คลิก **"Add New Project"**
   - เลือก GitHub repository ของคุณ
   - ตั้งค่า:
     - **Framework Preset**: Vite (จะ detect อัตโนมัติ)
     - **Root Directory**: `.` (root)
     - **Build Command**: `npm run build` (มีใน vercel.json แล้ว)
     - **Output Directory**: `dist` (มีใน vercel.json แล้ว)
   - คลิก **"Deploy"**

---

### ขั้นตอนที่ 2: ตั้งค่า Neon Database

1. **สร้าง Neon Database**:
   - ไปที่ [Neon Console](https://console.neon.tech/)
   - สร้างบัญชีหรือ login
   - คลิก **"Create a project"**
   - ตั้งชื่อ: `repair-hub-pro`
   - เลือก Region: `Southeast Asia (Singapore)` (ใกล้ที่สุด)
   - PostgreSQL version: `16` หรือ `15`
   - คลิก **"Create project"**

2. **รับ Connection String**:
   - หลังจากสร้างเสร็จ จะเห็นหน้า Dashboard
   - คลิก **"Connection Details"** หรือ **"Connection string"**
   - คัดลอก Connection String (รูปแบบ):
     ```
     postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
     ```
   - **เก็บ Connection String นี้ไว้** (จะใช้ในขั้นตอนถัดไป)

3. **รัน Database Migrations**:
   
   **วิธีที่ 1: ใช้ Neon SQL Editor** (ง่ายที่สุด)
   - ไปที่ Neon Console → SQL Editor
   - เปิดไฟล์ migrations จาก `backend/src/migrations/`
   - Copy SQL statements และรันใน SQL Editor
   
   **วิธีที่ 2: ใช้ TypeORM CLI** (แนะนำ)
   ```bash
   cd backend
   # สร้างไฟล์ .env
   echo DB_API_BACKEND=your-connection-string-here > .env
   # รัน migrations
   npm run migration:run
   ```

---

### ขั้นตอนที่ 3: Deploy Backend บน Railway

**หมายเหตุ**: Vercel ไม่เหมาะสำหรับ Backend ที่มี Socket.IO และ long-running processes ดังนั้นต้อง deploy Backend แยกบน Railway, Render, หรือ DigitalOcean

1. **ไปที่ Railway**:
   - ไปที่ [Railway](https://railway.app/)
   - สร้างบัญชี (ใช้ GitHub login ได้)
   - คลิก **"New Project"** → **"Deploy from GitHub repo"**

2. **เลือก Repository**:
   - เลือก repository ของคุณ
   - Railway จะ detect โปรเจกต์อัตโนมัติ

3. **ตั้งค่า Root Directory**:
   - ไปที่ Settings → Root Directory
   - ตั้งค่าเป็น: `backend`

4. **ตั้งค่า Environment Variables**:
   - ไปที่ Variables tab
   - เพิ่ม variables ต่อไปนี้:

   | Name | Value |
   |------|-------|
   | `DB_API_BACKEND` | Connection String จาก Neon (ที่คัดลอกไว้) |
   | `NODE_ENV` | `production` |
   | `FRONTEND_URL` | URL ของ Frontend จาก Vercel (เช่น `https://your-project.vercel.app`) |
   | `PORT` | (Railway จะกำหนดให้อัตโนมัติ - ไม่ต้องตั้ง) |

5. **Deploy**:
   - Railway จะ build และ deploy อัตโนมัติ
   - รอให้เสร็จ (ประมาณ 2-5 นาที)
   - หลังจากเสร็จ Railway จะให้ URL เช่น: `https://your-app.railway.app`
   - **คัดลอก URL นี้ไว้** (จะใช้ในขั้นตอนถัดไป)

---

### ขั้นตอนที่ 4: ตั้งค่า Frontend Environment Variables

1. **ไปที่ Vercel Dashboard**:
   - ไปที่ [Vercel Dashboard](https://vercel.com/dashboard)
   - เลือกโปรเจกต์ของคุณ
   - ไปที่ **Settings** → **Environment Variables**

2. **เพิ่ม Environment Variable**:
   - คลิก **"Add New"**
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: URL ของ Backend จาก Railway (เช่น `https://your-app.railway.app`)
   - **Environment**: เลือกทั้ง Production, Preview, และ Development
   - คลิก **"Save"**

3. **Redeploy Frontend**:
   - ไปที่ **Deployments** tab
   - คลิก **"..."** ที่ deployment ล่าสุด
   - เลือก **"Redeploy"**
   - หรือ push commit ใหม่ไป GitHub (ถ้าใช้ GitHub Integration)

---

### ขั้นตอนที่ 5: ตรวจสอบการทำงาน

1. **ตรวจสอบ Frontend**:
   - เปิด URL จาก Vercel (เช่น `https://your-project.vercel.app`)
   - เปิด Browser DevTools (F12) → Console
   - ตรวจสอบว่าไม่มี errors
   - ตรวจสอบ Network tab ว่า API calls ไปที่ Backend URL ที่ถูกต้อง

2. **ตรวจสอบ Backend**:
   - เปิด `https://your-backend.railway.app/health`
   - ควรเห็น: `{"status":"ok","message":"Server is running"}`
   
   - ตรวจสอบ Database connection:
     - เปิด `https://your-backend.railway.app/api/db/test`
     - ควรเห็น: `{"status":"success","message":"TypeORM database connection successful"}`

3. **ตรวจสอบ Database**:
   - ไปที่ Neon Console → SQL Editor
   - รัน query:
     ```sql
     SELECT table_name FROM information_schema.tables 
     WHERE table_schema = 'public';
     ```
   - ควรเห็น tables ที่สร้างจาก migrations

---

## 🎉 เสร็จสิ้น!

หลังจากทำตามขั้นตอนทั้งหมดแล้ว คุณควรมี:
- ✅ Frontend deploy บน Vercel
- ✅ Backend deploy บน Railway
- ✅ Database ใช้ Neon PostgreSQL
- ✅ ทุกอย่างเชื่อมต่อกันและทำงานได้

---

## 📚 ดูรายละเอียดเพิ่มเติม

- คู่มือฉบับเต็ม: [VERCEL_NEON_SETUP.md](./VERCEL_NEON_SETUP.md)
- Quick Start: [DEPLOY_QUICK_START.md](./DEPLOY_QUICK_START.md)

---

## 🐛 แก้ไขปัญหาที่พบบ่อย

### Frontend ไม่สามารถเชื่อมต่อ Backend ได้
- ตรวจสอบว่า `VITE_API_BASE_URL` ตั้งค่าถูกต้องบน Vercel
- ตรวจสอบว่า Backend URL ถูกต้องและทำงาน
- ตรวจสอบ CORS settings ใน Backend (`FRONTEND_URL` ต้องตรงกับ Vercel URL)
- Redeploy Frontend หลังจากเปลี่ยน Environment Variables

### Database connection failed
- ตรวจสอบว่า `DB_API_BACKEND` ถูกต้อง
- ตรวจสอบว่า Neon database ยัง active อยู่
- ตรวจสอบ SSL mode (`?sslmode=require` ใน connection string)

### Build failed
- ตรวจสอบ logs ใน Vercel/Railway dashboard
- ตรวจสอบว่า dependencies ติดตั้งครบ (`npm install`)
- ตรวจสอบว่า build command ถูกต้อง
