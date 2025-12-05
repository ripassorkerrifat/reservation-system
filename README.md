# Product Reservation System

A full-stack application that allows users to reserve products for exactly 2 minutes with automatic expiration and stock restoration. The system handles concurrency, prevents overselling, and ensures expiration works even after server restarts.

## 🏗️ Tech Stack

-    **Backend**: NestJS + Prisma + PostgreSQL + BullMQ (Redis)
-    **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS

## 📋 Features

-    ✅ Reserve products for exactly 2 minutes
-    ✅ Automatic stock deduction on reservation (transaction-safe)
-    ✅ Background job-based expiration using BullMQ (survives server restarts)
-    ✅ Transaction-safe stock management (prevents overselling)
-    ✅ Real-time countdown timer with backend sync (polls every 2 seconds)
-    ✅ Timer persistence across page refreshes (localStorage)
-    ✅ Multiple users can reserve the same product simultaneously
-    ✅ Periodic safety checks for missed expirations (every 30 seconds)
-    ✅ Server restart recovery (automatically reschedules expiration jobs)

## 🚀 Quick Start

### Prerequisites

-    Node.js 18+ and npm
-    PostgreSQL 14+
-    Redis 6+

### Installation

1. **Clone the repository**:

     ```bash
     git clone git@github.com-personal:ripassorkerrifat/reservation-system.git
     cd reservation-system
     ```

2. **Set up the Backend**:

     ```bash
     cd backend
     npm install
     ```

3. **Set up the Frontend**:

     ```bash
     cd ../frontend
     npm install
     ```

### Environment Configuration

1. **Backend Environment** (`backend/.env`):

     ```env
     DATABASE_URL="postgresql://user:password@localhost:5432/reservation_db?schema=public"
     REDIS_HOST="localhost"
     REDIS_PORT="6379"
     PORT=4000
     FRONTEND_URL="http://localhost:3000"
     ```

2. **Frontend Environment** (`frontend/.env.local`):

     ```env
     NEXT_PUBLIC_API_URL="http://localhost:4000"
     ```

### Database Setup

1. **Start PostgreSQL** (if not running):

     ```bash
     # macOS with Homebrew
     brew services start postgresql@14

     # Linux (systemd)
     sudo systemctl start postgresql

     # Or you can use Docker
     ```

2. **Run Prisma migrations and generate client**:

     ```bash
     cd backend
     npx prisma migrate dev --name init
     npx prisma generate  # This generates TypeScript types
     ```

     **Important**: You must run `prisma generate` before starting the backend, as it generates the Prisma Client with TypeScript types.

3. **Seed sample data**:

     ```bash
     # Run the seed script
     npm run prisma:seed

     # Or use Prisma Studio to add products manually
     npx prisma studio
     ```

### Redis Setup

1. **Start Redis**:

     ```bash
     # macOS with Homebrew
     brew services start redis

     # Linux (systemd)
     sudo systemctl start redis

     # Or use Docker
     docker run --name redis -p 6379:6379 -d redis:7-alpine
     ```

2. **Verify Redis is running**:

     ```bash
     redis-cli ping
     # Should return: PONG
     ```

### Running the Application

**Important**: Make sure PostgreSQL and Redis are running before starting the application.

1. **Start the Backend** (Terminal 1):

     ```bash
     cd backend
     npm run start:dev
     ```

     The backend will start on `http://localhost:4000`

     You should see:

     ```
     🚀 Backend server running on http://localhost:4000
     ```

2. **Start the Frontend** (Terminal 2 - new terminal window):

     ```bash
     cd frontend
     npm run dev
     ```

     The frontend will start on `http://localhost:3000`

     You should see:

     ```
     ✓ Ready in [time]
     ○ Local: http://localhost:3000
     ```

3. **Open your browser**:

     Navigate to `http://localhost:3000` to see the application

## 📁 Project Structure

```
reservation-system/
├── backend/
│   ├── src/
│   │   ├── common/
│   │   │   └── constants.ts          # Shared constants (ReservationStatus, durations, etc.)
│   │   ├── products/                 # Product module
│   │   │   ├── products.controller.ts
│   │   │   ├── products.service.ts
│   │   │   └── products.module.ts
│   │   ├── reservations/             # Reservation module
│   │   │   ├── dto/
│   │   │   │   └── create-reservation.dto.ts
│   │   │   ├── utils/
│   │   │   │   └── reservation.utils.ts  # Utility functions
│   │   │   ├── reservations.controller.ts
│   │   │   ├── reservations.service.ts    # Main service (includes recovery logic)
│   │   │   └── reservations.module.ts
│   │   ├── workers/                  # BullMQ workers
│   │   │   ├── expiration.processor.ts
│   │   │   └── expiration-worker.module.ts
│   │   ├── prisma/                   # Prisma service
│   │   │   ├── prisma.service.ts
│   │   │   └── prisma.module.ts
│   │   ├── app.module.ts             # Root module
│   │   └── main.ts                   # Application entry
│   ├── prisma/
│   │   ├── schema.prisma             # Database schema
│   │   ├── seed.ts                   # Seed script
│   │   └── migrations/               # Database migrations
│   └── package.json
├── frontend/
│   ├── app/
│   │   ├── components/               # React components
│   │   │   ├── ProductCard.tsx
│   │   │   ├── CountdownTimer.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── hooks/                    # Custom React hooks
│   │   │   └── useDebouncedCallback.ts
│   │   ├── lib/                      # Utilities & API client
│   │   │   ├── api.ts                # API client
│   │   │   └── reservation-timer.ts  # Timer utilities
│   │   ├── types/                    # TypeScript types
│   │   │   └── index.ts
│   │   ├── page.tsx                  # Main page
│   │   └── layout.tsx                # Root layout
│   └── package.json
├── README.md                         # This file
└──ARCHITECTURE.md                   # Technical architecture docs
```

## 🧪 Testing the System

### Test Scenarios

1. **Basic Reservation Flow**:

     - Click "Reserve Now" on a product
     - Verify countdown timer appears (2 minutes)
     - Verify stock decreases immediately
     - Complete purchase before expiration
     - Verify stock remains decreased after completion

2. **Expiration Test**:

     - Create a reservation
     - Wait 2 minutes (or modify `RESERVATION_DURATION_MS` in `backend/src/common/constants.ts` for testing)
     - Verify stock is restored automatically
     - Verify reservation status changes to EXPIRED
     - Verify countdown timer shows "Reservation Expired"

3. **Concurrency Test**:

     - Open multiple browser tabs/windows
     - Try to reserve the same product simultaneously
     - Verify each user gets their own reservation
     - Verify stock decreases correctly for each reservation
     - Verify multiple reservations can exist for the same product

4. **Persistence Test**:

     - Create a reservation
     - Refresh the page
     - Verify timer continues from where it left off
     - Verify reservation state is restored from localStorage
     - Verify backend sync works correctly

5. **Server Restart Test**:

     - Create a reservation
     - Restart the backend server
     - Verify expiration job is rescheduled automatically
     - Verify reservation still expires correctly after restart
     - Verify stock is restored after expiration

6. **Edge Cases**:

     - Try to complete an expired reservation (should fail)
     - Try to reserve when stock is 0 (should be disabled)
     - Try to complete a reservation that's already completed (should fail)
     - Create reservation and let it expire, then try to complete (should fail)

## 📝 API Endpoints

### Products

-    `GET /products` - Get all products
     -    Response: Array of products with `id`, `name`, `price`, `availableStock`, `thumbnail`, etc.

### Reservations

-    `POST /reservations` - Create a reservation

     -    Request Body:
          ```json
          {
               "productId": "uuid",
               "quantity": 1
          }
          ```
     -    Response: Reservation object with `id`, `productId`, `quantity`, `status`, `expiresAt`, etc.

-    `GET /reservations/:id` - Get reservation by ID

     -    Response: Reservation object with product details

-    `POST /reservations/:id/complete` - Complete a reservation (purchase)
     -    Response: Updated reservation with status `COMPLETED`

## 🔒 Security & Validation

-    Input validation using `class-validator` (DTOs)
-    Transaction-safe database operations (prevents race conditions)
-    Stock validation to prevent overselling
-    Status checks before completing reservations
-    Expiration validation (cannot complete expired reservations)
-    CORS configuration for frontend access
