# Attendance System Backend

Node.js + Express + MongoDB REST API for the Attendance Management System, with JWT authentication.

## Architecture

```
server.js                 # App bootstrap & DB connection
src/
├── config/               # Environment & database config
├── controllers/          # HTTP request/response handlers
├── middleware/           # Auth, validation, error handling
├── models/               # Mongoose schemas
├── routes/               # Route definitions
├── services/             # Business logic layer
├── utils/                # Shared helpers
└── validators/           # Request validation rules
```

**Flow:** Route → Controller → Service → Model

## Custom IDs

Readable custom IDs instead of MongoDB ObjectIds:

| Collection | Format           | Example      |
|------------|------------------|--------------|
| Users      | `USR` + 7 digits | `USR0000001` |
| Groups     | `GRP` + 7 digits | `GRP0000001` |
| Employees  | `EMP` + 7 digits | `EMP0000001` |
| Branches   | `BRN` + 7 digits | `BRN0000001` |

IDs are generated atomically via a counter collection.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment file and update values:

```bash
cp .env.example .env
```

3. Make sure MongoDB is running locally, then start the server:

```bash
npm run dev
```

## Postman Collection

Import this file in Postman:

`postman/Attendance_System_Backend.postman_collection.json`

1. Open Postman → **Import** → select the JSON file
2. Collection variables: `baseUrl` = `http://localhost:5000`
3. Run **Login Admin** first — token auto-saves to `adminToken`
4. Run **Login Employee** for employee APIs — saves `employeeToken`

## API Endpoints (22 total)

### Health

| Method | Endpoint  | Description      |
|--------|-----------|------------------|
| GET    | `/health` | Server health check |

### Auth

| Method | Endpoint             | Description              |
|--------|----------------------|--------------------------|
| POST   | `/api/auth/register` | First admin setup        |
| POST   | `/api/auth/login`    | Login & get JWT token    |
| GET    | `/api/auth/me`       | Current user profile     |

### Groups (Admin)

| Method | Endpoint          | Description     |
|--------|-------------------|-----------------|
| GET    | `/api/groups`     | List groups     |
| POST   | `/api/groups`     | Create group    |
| PUT    | `/api/groups/:id` | Update group    |

### Users (Admin)

| Method | Endpoint         | Description    |
|--------|------------------|----------------|
| GET    | `/api/users`     | List users     |
| POST   | `/api/users`     | Create user    |
| PUT    | `/api/users/:id` | Update user    |

### Branches

| Method | Endpoint           | Description                    |
|--------|--------------------|--------------------------------|
| GET    | `/api/branches`      | List branches (any logged-in)  |
| POST   | `/api/branches`      | Create branch (admin)          |
| PUT    | `/api/branches/:id`  | Update branch (admin)          |

### Employees (Admin)

| Method | Endpoint             | Description       |
|--------|----------------------|-------------------|
| GET    | `/api/employees`     | List employees    |
| POST   | `/api/employees`     | Create employee   |
| PUT    | `/api/employees/:id` | Update employee   |

### Attendance

| Method | Endpoint                        | Access           | Description                    |
|--------|---------------------------------|------------------|--------------------------------|
| GET    | `/api/attendance/today`    | Employee / Admin | Today's record            |
| GET    | `/api/attendance/overview` | Employee / Admin | Dashboard attendance grid |
| POST   | `/api/attendance/mark-nfc` | Employee         | Check-in/out via NFC + GPS |

## Example Requests

### Register

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ali","email":"ali@example.com","password":"secret123","phone":"971501234567"}'
```

### Login

Dashboard admins use **email + password**. Mobile employees use **phone + password**.

```bash
# Dashboard admin
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ali@example.com","password":"secret123"}'

# Mobile employee
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"971501234567","password":"secret123"}'
```

### Get Profile

```bash
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Environment Variables

| Variable         | Description                 |
|------------------|-----------------------------|
| `PORT`           | Server port (default: 5000) |
| `NODE_ENV`       | development / production    |
| `MONGODB_URI`    | MongoDB connection string   |
| `JWT_SECRET`     | Secret key for JWT signing  |
| `JWT_EXPIRES_IN` | Token expiry (default: 7d)  |
