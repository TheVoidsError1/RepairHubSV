# Repair Hub Pro - Backend

Backend API server for Repair Hub Pro application with PostgreSQL database connection using TypeORM.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the backend directory (copy from `env.example`):
```bash
cp env.example .env
```

3. Update the `.env` file with your PostgreSQL credentials:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=Fixphone
DB_USER=postgres
DB_PASSWORD=your_password_here
PORT=3001
NODE_ENV=development
```

**Note:** If your PostgreSQL doesn't have a password (common in local development), you can:
- Leave `DB_PASSWORD=` empty
- Or omit the `DB_PASSWORD` line entirely

4. Make sure PostgreSQL is running and the database `Fixphone` exists:
```sql
CREATE DATABASE Fixphone;
```

## Running the Server

### Development mode (with hot reload):
```bash
npm run dev
```

### Production mode:
```bash
npm run build
npm start
```

## Database Migrations

### Generate migration:
```bash
npm run migration:generate -- src/migrations/MigrationName
```

### Run migrations:
```bash
npm run migration:run
```

### Revert last migration:
```bash
npm run migration:revert
```

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /api/db/test` - Test database connection
- `GET /api/db/query` - Example database query

## Deployment on Render

### Required Environment Variables

เมื่อ deploy บน Render ต้องตั้งค่า Environment Variables ต่อไปนี้:

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_API_BACKEND` | Neon database connection string | `postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=verify-full` |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port (Render จะกำหนดให้อัตโนมัติ) | - |
| `FRONTEND_URL` | **สำคัญ!** URL ของ Frontend บน Vercel | `https://repair-hub-sv.vercel.app` |

### ⚠️ สำคัญ: ตั้งค่า FRONTEND_URL

**ต้องตั้งค่า `FRONTEND_URL` เพื่อแก้ปัญหา CORS:**

1. ไปที่ Render Dashboard → Service → Environment
2. เพิ่ม Environment Variable:
   - **Key**: `FRONTEND_URL`
   - **Value**: URL ของ Frontend บน Vercel (เช่น `https://repair-hub-sv.vercel.app`)
3. **Manual Deploy** เพื่อให้การเปลี่ยนแปลงมีผล

**หมายเหตุ:**
- ถ้าไม่ตั้งค่า `FRONTEND_URL` Backend จะไม่รองรับ CORS จาก Frontend
- สามารถตั้งค่าได้หลาย URLs โดยคั่นด้วย comma: `https://app1.vercel.app,https://app2.vercel.app`
- หรือใช้ `*` เพื่ออนุญาตทุก origin (ไม่แนะนำสำหรับ production)

## Database Connection

The backend uses **TypeORM** to connect to PostgreSQL database named `Fixphone`. 

### Features:
- ✅ TypeORM ORM for type-safe database operations
- ✅ Repository pattern for clean data access
- ✅ Entity relationships (OneToMany, ManyToOne, ManyToMany)
- ✅ UUID primary keys for all entities
- ✅ Automatic migrations support
- ✅ TypeScript decorators for entities

### Entities:
- **Customer** (ลูกค้า) - Customer information with UUID
- **Personnel** (บุคลากร) - Staff/Technician users with UUID
- **Part** (อะไหล่) - Inventory/Spare parts with UUID
- **Repair** (ใบแจ้งซ่อม) - Repair orders with UUID

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── data-source.ts      # TypeORM DataSource configuration
│   │   └── database.ts         # Legacy pg connection (optional)
│   ├── entities/               # TypeORM entities
│   │   ├── Customer.ts
│   │   ├── Personnel.ts
│   │   ├── Part.ts
│   │   └── Repair.ts
│   ├── migrations/            # Database migrations
│   ├── subscribers/           # TypeORM subscribers
│   └── server.ts              # Express server
├── typeorm.config.ts          # TypeORM CLI configuration
└── package.json
```
