# 🚀 Quick Start: Deploy to Vercel + Neon

คู่มือสั้นๆ สำหรับ deploy โปรเจกต์ Repair Hub Pro

## 📝 ขั้นตอนสั้นๆ

### 1. สร้าง Neon Database (5 นาที)

1. ไปที่ [Neon Console](https://console.neon.tech/) → สร้างโปรเจกต์
2. คัดลอก **Connection String** (รูปแบบ: `postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require`)
3. เก็บ Connection String ไว้ใช้ในขั้นตอนถัดไป

### 2. Deploy Frontend บน Vercel (5 นาที)

**วิธีที่ 1: ใช้ Vercel CLI**
```bash
npm i -g vercel
vercel login
vercel --prod
```

**วิธีที่ 2: ใช้ GitHub Integration**
1. Push โปรเจกต์ไป GitHub
2. ไปที่ [Vercel Dashboard](https://vercel.com/dashboard) → Add New Project
3. Import repository → Deploy

### 3. ตั้งค่า Environment Variables บน Vercel

ไปที่ Vercel Dashboard → Project → Settings → Environment Variables

เพิ่ม:
- `VITE_API_BASE_URL` = `https://your-backend-url.com` (จะได้ URL นี้หลังจาก deploy backend)

### 4. Deploy Backend บน Railway (10 นาที)

1. ไปที่ [Railway](https://railway.app/) → New Project → Deploy from GitHub
2. เลือก repository → ตั้งค่า Root Directory = `backend`
3. ตั้งค่า Environment Variables:
   - `DB_API_BACKEND` = Connection String จาก Neon (หรือใช้ `DATABASE_URL` ก็ได้)
   - `NODE_ENV` = `production`
   - `FRONTEND_URL` = URL ของ Frontend บน Vercel
4. Deploy → คัดลอก URL ที่ได้ (เช่น `https://your-app.railway.app`)

### 5. อัปเดต Frontend Environment Variable

กลับไปที่ Vercel → Environment Variables → แก้ไข `VITE_API_BASE_URL` ให้ชี้ไปที่ Backend URL → Redeploy

### 6. รัน Database Migrations

```bash
cd backend
# ตั้งค่า DB_API_BACKEND (หรือ DATABASE_URL) ใน .env
npm run migration:run
```

หรือใช้ Neon SQL Editor เพื่อรัน migrations

## ✅ ตรวจสอบ

1. Frontend: เปิด URL จาก Vercel → ตรวจสอบ Console (F12)
2. Backend: เปิด `https://your-backend.railway.app/health`
3. Database: เปิด `https://your-backend.railway.app/api/db/test`

## 📚 ดูรายละเอียดเพิ่มเติม

ดูคู่มือฉบับเต็มใน [VERCEL_NEON_SETUP.md](./VERCEL_NEON_SETUP.md)
