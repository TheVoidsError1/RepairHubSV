# คู่มือการตั้งค่า Vercel และ Neon Database

คู่มือนี้จะช่วยคุณ deploy Frontend บน Vercel และใช้ Neon Database สำหรับ Backend

## 📋 สารบัญ

1. [การตั้งค่า Neon Database](#การตั้งค่า-neon-database)
2. [การ Deploy Frontend บน Vercel](#การ-deploy-frontend-บน-vercel)
3. [การ Deploy Backend](#การ-deploy-backend)
4. [การตั้งค่า Environment Variables](#การตั้งค่า-environment-variables)
5. [การตรวจสอบการทำงาน](#การตรวจสอบการทำงาน)

---

## 🗄️ การตั้งค่า Neon Database

### ขั้นตอนที่ 1: สร้าง Neon Database

1. ไปที่ [Neon Console](https://console.neon.tech/)
2. สร้างบัญชีหรือเข้าสู่ระบบ
3. คลิก **"Create a project"**
4. ตั้งชื่อโปรเจกต์ (เช่น `repair-hub-pro`)
5. เลือก Region ที่ใกล้ที่สุด (แนะนำ: `Southeast Asia (Singapore)`)
6. เลือก PostgreSQL version (แนะนำ: `16` หรือ `15`)
7. คลิก **"Create project"**

### ขั้นตอนที่ 2: รับ Connection String

1. หลังจากสร้างโปรเจกต์เสร็จ คุณจะเห็นหน้า Dashboard
2. คลิกที่ **"Connection Details"** หรือ **"Connection string"**
3. คัดลอก **Connection String** (จะมีรูปแบบประมาณนี้):
   ```
   postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```
4. **สำคัญ**: เก็บ Connection String นี้ไว้อย่างปลอดภัย (จะใช้ในขั้นตอนถัดไป)

### ขั้นตอนที่ 3: ตั้งค่า Database Schema

Neon จะสร้าง database เปล่าให้คุณ คุณต้องรัน migrations เพื่อสร้าง tables:

**วิธีที่ 1: ใช้ Neon SQL Editor (แนะนำสำหรับเริ่มต้น)**

1. ไปที่ Neon Console → SQL Editor
2. เปิดไฟล์ `backend/src/migrations/` และรัน SQL statements ที่มีอยู่

**วิธีที่ 2: ใช้ TypeORM Migrations (แนะนำสำหรับ production)**

1. ตั้งค่า Environment Variables ในเครื่องของคุณ:
   ```bash
   # ใน backend/.env
   DB_API_BACKEND=postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
   # หรือใช้ DATABASE_URL ก็ได้
   ```

2. รัน migrations:
   ```bash
   cd backend
   npm run migration:run
   ```

---

## 🚀 การ Deploy Frontend บน Vercel

### ขั้นตอนที่ 1: เตรียมโปรเจกต์

1. ตรวจสอบว่าโปรเจกต์พร้อมสำหรับ deploy:
   ```bash
   npm run build
   ```

2. ตรวจสอบว่าไฟล์ `vercel.json` ถูกต้อง

### ขั้นตอนที่ 2: Deploy บน Vercel

**วิธีที่ 1: ใช้ Vercel CLI (แนะนำ)**

1. ติดตั้ง Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```
   
   - เลือก scope (personal หรือ team)
   - Link to existing project? → **No** (สำหรับครั้งแรก)
   - Project name → ตั้งชื่อโปรเจกต์
   - Directory → `.` (root directory)
   - Override settings? → **No**

4. Deploy to production:
   ```bash
   vercel --prod
   ```

**วิธีที่ 2: ใช้ GitHub Integration (แนะนำสำหรับ production)**

1. Push โปรเจกต์ไปยัง GitHub repository
2. ไปที่ [Vercel Dashboard](https://vercel.com/dashboard)
3. คลิก **"Add New Project"**
4. Import GitHub repository ของคุณ
5. ตั้งค่าดังนี้:
   - **Framework Preset**: Vite
   - **Root Directory**: `.` (root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

6. คลิก **"Deploy"**

### ขั้นตอนที่ 3: ตั้งค่า Environment Variables บน Vercel

1. ไปที่ Vercel Dashboard → Project → Settings → Environment Variables
2. เพิ่ม Environment Variables:

   | Name | Value | Environment |
   |------|-------|-------------|
   | `VITE_API_BASE_URL` | `https://your-backend-url.com` | Production, Preview, Development |

   **หมายเหตุ**: ใส่ URL ของ Backend ที่ deploy แล้ว (จะตั้งค่าในขั้นตอนถัดไป)

3. Redeploy project:
   - ไปที่ Deployments tab
   - คลิก "..." → "Redeploy"

---

## 🔧 การ Deploy Backend

Backend ต้อง deploy แยกจาก Frontend เพราะ Vercel ไม่เหมาะสำหรับ long-running Node.js applications ที่มี Socket.IO

### ตัวเลือกสำหรับ Deploy Backend:

#### ตัวเลือกที่ 1: Railway (แนะนำ)

1. ไปที่ [Railway](https://railway.app/)
2. สร้างบัญชีและเชื่อมต่อ GitHub
3. คลิก **"New Project"** → **"Deploy from GitHub repo"**
4. เลือก repository ของคุณ
5. ตั้งค่า:
   - **Root Directory**: `backend`
   - **Start Command**: `npm start`
   - **Build Command**: `npm run build`

6. ตั้งค่า Environment Variables:
   - ไปที่ Variables tab
   - เพิ่ม variables ต่อไปนี้:

   | Name | Value |
   |------|-------|
   | `DB_API_BACKEND` | Connection string จาก Neon (แนะนำ) |
   | `NODE_ENV` | `production` |
   | `PORT` | (Railway จะกำหนดให้อัตโนมัติ) |
   | `FRONTEND_URL` | URL ของ Frontend บน Vercel |
   | `DB_HOST` | (ถ้าใช้ individual parameters แทน connection string) |
   | `DB_PORT` | `5432` |
   | `DB_NAME` | ชื่อ database จาก Neon |
   | `DB_USER` | username จาก Neon |
   | `DB_PASSWORD` | password จาก Neon |
   
   **หมายเหตุ**: ใช้ `DB_API_BACKEND` หรือ `DATABASE_URL` ก็ได้ (โค้ดรองรับทั้งสองชื่อ)

7. หลังจาก deploy เสร็จ Railway จะให้ URL (เช่น `https://your-app.railway.app`)
8. คัดลอก URL นี้ไปตั้งค่า `VITE_API_BASE_URL` บน Vercel

#### ตัวเลือกที่ 2: Render

1. ไปที่ [Render](https://render.com/)
2. สร้างบัญชีและเชื่อมต่อ GitHub
3. คลิก **"New"** → **"Web Service"**
4. เลือก repository
5. ตั้งค่า:
   - **Name**: `repair-hub-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

6. ตั้งค่า Environment Variables (เหมือนกับ Railway)
7. Deploy

#### ตัวเลือกที่ 3: DigitalOcean App Platform

1. ไปที่ [DigitalOcean](https://www.digitalocean.com/products/app-platform)
2. สร้าง App จาก GitHub
3. ตั้งค่า Root Directory เป็น `backend`
4. ตั้งค่า Environment Variables
5. Deploy

---

## 🔐 การตั้งค่า Environment Variables

### Frontend (Vercel)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | URL ของ Backend API | `https://your-backend.railway.app` |
| `VITE_LINE_QR_SRC` | (Optional) Path ไปยัง LINE QR image | `/line-qr.png` |
| `VITE_LINE_QR_TEXT` | (Optional) Caption สำหรับ LINE QR | `LINE` |

### Backend (Railway/Render/etc.)

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_API_BACKEND` | Neon connection string (แนะนำ) | `postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require` |
| `DATABASE_URL` | Neon connection string (รองรับเหมือน DB_API_BACKEND) | `postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require` |
| `DB_HOST` | (ถ้าไม่ใช้ connection string) | `ep-xxx-xxx.region.aws.neon.tech` |
| `DB_PORT` | (ถ้าไม่ใช้ connection string) | `5432` |
| `DB_NAME` | (ถ้าไม่ใช้ connection string) | `neondb` |
| `DB_USER` | (ถ้าไม่ใช้ connection string) | `username` |
| `DB_PASSWORD` | (ถ้าไม่ใช้ connection string) | `password` |
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | (Platform จะกำหนดให้) |
| `FRONTEND_URL` | URL ของ Frontend | `https://your-app.vercel.app` |
| `LINE_CHANNEL_ACCESS_TOKEN` | (Optional) LINE Bot token | |
| `LINE_CHANNEL_SECRET` | (Optional) LINE Bot secret | |

**หมายเหตุ**: Backend รองรับทั้ง `DB_API_BACKEND` หรือ `DATABASE_URL` (connection string) และ individual parameters (`DB_HOST`, `DB_PORT`, etc.)

---

## ✅ การตรวจสอบการทำงาน

### 1. ตรวจสอบ Frontend

1. เปิด URL ของ Vercel deployment
2. เปิด Browser DevTools (F12) → Console
3. ตรวจสอบว่าไม่มี errors
4. ตรวจสอบ Network tab ว่า API calls ไปที่ Backend URL ที่ถูกต้อง

### 2. ตรวจสอบ Backend

1. เปิด URL ของ Backend + `/health`:
   ```
   https://your-backend.railway.app/health
   ```
   ควรเห็น: `{"status":"ok","message":"Server is running"}`

2. ตรวจสอบ Database connection:
   ```
   https://your-backend.railway.app/api/db/test
   ```
   ควรเห็น: `{"status":"success","message":"TypeORM database connection successful"}`

### 3. ตรวจสอบ Database (Neon)

1. ไปที่ Neon Console → SQL Editor
2. รัน query:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```
3. ควรเห็น tables ที่สร้างจาก migrations

---

## 🐛 แก้ไขปัญหาที่พบบ่อย

### ปัญหา: Frontend ไม่สามารถเชื่อมต่อ Backend ได้

**แก้ไข**:
1. ตรวจสอบว่า `VITE_API_BASE_URL` ตั้งค่าถูกต้องบน Vercel
2. ตรวจสอบว่า Backend URL ถูกต้องและทำงาน
3. ตรวจสอบ CORS settings ใน Backend (`FRONTEND_URL` ต้องตรงกับ Vercel URL)
4. Redeploy Frontend หลังจากเปลี่ยน Environment Variables

### ปัญหา: Database connection failed

**แก้ไข**:
1. ตรวจสอบว่า `DB_API_BACKEND` (หรือ `DATABASE_URL`) หรือ database parameters ถูกต้อง
2. ตรวจสอบว่า Neon database ยัง active อยู่ (Neon จะ suspend database ที่ไม่ได้ใช้)
3. ตรวจสอบ SSL mode (`?sslmode=require` ใน connection string)
4. ตรวจสอบว่า IP address ไม่ถูก block (Neon ไม่มี IP whitelist แต่ควรตรวจสอบ)

### ปัญหา: Migrations ไม่ทำงาน

**แก้ไข**:
1. ตรวจสอบว่า `NODE_ENV=production` (migrations จะไม่ auto-sync)
2. รัน migrations ก่อน deploy:
   ```bash
   cd backend
   npm run migration:run
   ```
3. หรือรัน migrations ผ่าน Neon SQL Editor

### ปัญหา: Socket.IO ไม่ทำงาน

**แก้ไข**:
1. ตรวจสอบว่า Backend รองรับ WebSocket
2. ตรวจสอบว่า Frontend ใช้ URL เดียวกันกับ API base URL
3. ตรวจสอบ CORS settings

---

## 📚 ทรัพยากรเพิ่มเติม

- [Neon Documentation](https://neon.tech/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app/)
- [TypeORM Migrations](https://typeorm.io/migrations)

---

## 🎉 เสร็จสิ้น!

หลังจากทำตามขั้นตอนทั้งหมดแล้ว คุณควรมี:
- ✅ Frontend deploy บน Vercel
- ✅ Backend deploy บน Railway/Render/etc.
- ✅ Database ใช้ Neon PostgreSQL
- ✅ ทุกอย่างเชื่อมต่อกันและทำงานได้

หากมีปัญหาหรือคำถามเพิ่มเติม กรุณาตรวจสอบ logs ในแต่ละ platform หรือดู documentation ที่เกี่ยวข้อง
