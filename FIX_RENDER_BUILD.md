# 🔧 แก้ไข Build Command และ Root Directory ใน Render

## ปัญหา
มี 2 ปัญหาหลัก:

1. **Build command ผิด:**
   - ❌ `npm install & npm build` (ผิด)
   - ✅ `npm install && npm run build` (ถูกต้อง)

2. **Root Directory ไม่ถูกต้อง:**
   - ❌ Root Directory = `.` (root directory - ผิด)
   - ✅ Root Directory = `backend` (ถูกต้อง)
   - ทำให้ Render รัน `npm start` จาก root directory แทน backend directory

## วิธีแก้ไข

### ขั้นตอนที่ 1: ไปที่ Render Dashboard
1. เปิด [Render Dashboard](https://dashboard.render.com/)
2. เลือกโปรเจกต์ **RepairHubSV**
3. ไปที่ **Settings** (⚙️ Settings) ใน sidebar

### ขั้นตอนที่ 2: แก้ไข Root Directory (สำคัญมาก!)
1. หา **Root Directory** ใน Settings
2. เปลี่ยนจาก:
   ```
   .
   ```
   หรือ
   ```
   (ว่างเปล่า)
   ```
   เป็น:
   ```
   backend
   ```
3. **บันทึกการเปลี่ยนแปลง**

### ขั้นตอนที่ 3: แก้ไข Build Command
1. หา **Build Command** ใน Settings
2. เปลี่ยนจาก:
   ```
   npm install & npm build
   ```
   เป็น:
   ```
   npm install && npm run build
   ```
3. **บันทึกการเปลี่ยนแปลง**

### ขั้นตอนที่ 4: ตรวจสอบ Start Command
1. หา **Start Command** ใน Settings
2. ตรวจสอบว่าคือ:
   ```
   npm start
   ```
   (ควรจะถูกต้องอยู่แล้ว)

### ขั้นตอนที่ 5: Save และ Redeploy
1. คลิก **Save Changes** (ถ้ายังไม่ได้บันทึก)
2. ไปที่ **Events** tab
3. คลิก **Manual Deploy** → **Deploy latest commit**
4. หรือรอให้ auto-deploy เมื่อ push code ใหม่

## หมายเหตุสำคัญ
- ⚠️ **Root Directory ต้องเป็น `backend`** (ไม่ใช่ `.` หรือ root)
- ใช้ `&&` (double ampersand) ไม่ใช่ `&` (single ampersand)
- ใช้ `npm run build` ไม่ใช่ `npm build`
- โปรเจกต์มีไฟล์ `render.yaml` อยู่แล้วที่ root directory ซึ่งจะช่วย auto-detect settings ในอนาคต

## ตรวจสอบ
หลังจาก deploy ใหม่ ตรวจสอบ logs:

✅ **ควรเห็น:**
```
==> Running build command 'npm install && npm run build'.
==> Running 'npm start'.
```

❌ **ไม่ควรมี error:**
```
Unknown command: "build"
Missing script: "start"
```

## ถ้ายังมีปัญหา
ถ้ายังมี error `Missing script: "start"` แสดงว่า Root Directory ยังไม่ถูกต้อง ให้ตรวจสอบอีกครั้งว่า Root Directory = `backend`
