# System Architecture

## Overview

This document describes the technical architecture of the Flash Sale Reservation System, focusing on expiration mechanisms, concurrency control, database schema, and design trade-offs.

## Database Schema

### Product Model

```prisma
model Product {
  id             String        @id @default(uuid())
  name           String
  price          Float
  availableStock Int           @default(0)
  thumbnail      String?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  reservations   Reservation[]

  @@map("products")
}
```

**Key Points**:

-    `availableStock` is decremented immediately on reservation creation
-    Stock is restored when reservation expires or is cancelled
-    `thumbnail` is optional for product images

### Reservation Model

```prisma
model Reservation {
  id        String            @id @default(uuid())
  productId String
  product   Product           @relation(fields: [productId], references: [id], onDelete: Cascade)
  quantity  Int
  status    ReservationStatus @default(ACTIVE)
  createdAt DateTime          @default(now())
  expiresAt DateTime
  updatedAt DateTime          @updatedAt

  @@index([status])
  @@index([expiresAt])
  @@map("reservations")
}
```

**Key Points**:

-    `expiresAt` is calculated as `now() + 2 minutes` at creation time
-    Status transitions: `ACTIVE` → `COMPLETED` or `EXPIRED`
-    Indexed on `status` and `expiresAt` for efficient queries
-    Cascade delete: if product is deleted, reservations are deleted

### ReservationStatus Enum

```prisma
enum ReservationStatus {
  ACTIVE      // Reservation is active, stock is reserved
  COMPLETED   // Purchase completed, stock remains deducted
  EXPIRED     // Time expired, stock restored
}
```

## How Expiration Works

### Three-Layer Expiration System

The system uses a multi-layered approach to ensure reservations expire reliably:

#### 1. Primary: BullMQ Job Queue (Redis)

**How it works**:

1. When a reservation is created, a delayed job is scheduled in Redis
2. Job is stored with a unique ID (`expire-{reservationId}`) and delay of 2 minutes
3. BullMQ worker processes the job at the exact expiration time
4. Job persists in Redis, surviving server restarts

**Implementation**:

```typescript
// Schedule expiration job
await this.expirationQueue.add(
     "expire-reservation",
     {reservationId: reservation.id},
     {
          delay: RESERVATION_DURATION_MS, // 2 minutes
          jobId: `expire-${reservation.id}`, // Unique ID
          attempts: 3, // Retry on failure
          backoff: {type: "exponential", delay: 5000},
     }
);
```

**Key Features**:

-    **Persistence**: Jobs stored in Redis survive server restarts
-    **Deduplication**: Unique `jobId` prevents duplicate jobs
-    **Retry Logic**: Failed jobs retry up to 3 times with exponential backoff
-    **Exact Timing**: Jobs execute at precise expiration time

#### 2. Secondary: Server Startup Recovery

**How it works**:

1. On server startup, `ReservationsService.onModuleInit()` runs
2. Queries database for all `ACTIVE` reservations
3. For each reservation:
     - If `expiresAt <= now`: Expire immediately and restore stock
     - If `expiresAt > now`: Reschedule expiration job with remaining time

**Implementation**:

```typescript
async recoverReservations(): Promise<void> {
     const activeReservations = await this.prisma.reservation.findMany({
          where: {status: ReservationStatus.ACTIVE},
     });

     const now = new Date();
     for (const reservation of activeReservations) {
          if (now > reservation.expiresAt) {
               // Already expired - expire immediately
               await this.expire(reservation.id);
          } else {
               // Reschedule job with remaining time
               const remainingTime = reservation.expiresAt.getTime() - now.getTime();
               await this.expirationQueue.add(/* ... */, {delay: remainingTime});
          }
     }
}
```

**Why it's needed**:

-    Handles cases where Redis jobs might be lost
-    Ensures expired reservations are caught on startup
-    Reschedules jobs that were lost during server crash

#### 3. Tertiary: Periodic Safety Check

**How it works**:

1. Runs every 30 seconds as a backup mechanism
2. Queries database for `ACTIVE` reservations where `expiresAt <= now`
3. Expires any found reservations and restores stock

**Implementation**:

```typescript
async checkExpiredReservations(): Promise<void> {
     const now = new Date();
     const expiredReservations = await this.prisma.reservation.findMany({
          where: {
               status: ReservationStatus.ACTIVE,
               expiresAt: {lte: now}, // expiresAt <= now
          },
     });

     for (const reservation of expiredReservations) {
          await this.expire(reservation.id);
     }
}
```

**Why it's needed**:

-    Catches any reservations that slipped through primary and secondary mechanisms
-    Uses database timestamp as source of truth (not memory-based)
-    Provides redundancy for critical expiration logic

### Expiration Process

When a reservation expires (via any mechanism):

```typescript
async expire(id: string): Promise<void> {
     await this.prisma.$transaction(async (tx) => {
          const reservation = await tx.reservation.findUnique({
               where: {id},
          });

          // Only expire if still ACTIVE (might have been completed)
          if (reservation.status === ReservationStatus.ACTIVE) {
               // Update status to EXPIRED
               await tx.reservation.update({
                    where: {id},
                    data: {status: ReservationStatus.EXPIRED},
               });

               // Restore stock
               await this.productsService.incrementStock(
                    reservation.productId,
                    reservation.quantity
               );
          }
     });
}
```

**Key Points**:

-    Uses transaction to ensure atomicity
-    Checks status before expiring (prevents double-expiration)
-    Restores stock atomically
-    Idempotent: safe to call multiple times

### Edge Case: Completion During Expiration

**Scenario**: User completes purchase exactly when expiration job runs.

**Solution**: Transaction-based status check ensures only one operation succeeds.

```typescript
async complete(id: string) {
     return this.prisma.$transaction(async (tx) => {
          const reservation = await tx.reservation.findUnique({where: {id}});

          // Check status and expiration
          if (reservation.status !== ReservationStatus.ACTIVE) {
               throw new BadRequestException('Reservation not active');
          }

          if (new Date() > reservation.expiresAt) {
               // Mark as expired and restore stock
               await tx.reservation.update({
                    where: {id},
                    data: {status: ReservationStatus.EXPIRED},
               });
               await this.productsService.incrementStock(/* ... */);
               throw new BadRequestException('Reservation expired');
          }

          // Complete reservation
          return tx.reservation.update({
               where: {id},
               data: {status: ReservationStatus.COMPLETED},
          });
     });
}
```

**Race Condition Handling**:

-    Both `complete()` and `expire()` use transactions
-    Database ensures only one succeeds (ACID properties)
-    If expiration wins: completion fails with clear error
-    If completion wins: expiration job sees status != ACTIVE and skips

## How Concurrency is Handled

### Problem: Race Conditions

Multiple users attempting to reserve the same product simultaneously can cause:

-    Overselling (stock goes negative)
-    Lost updates
-    Inconsistent state

### Solution: Database Transactions with Atomic Operations

All stock operations use Prisma transactions to ensure atomicity:

```typescript
async create(createReservationDto: CreateReservationDto) {
     return this.prisma.$transaction(async (tx) => {
          // 1. First, expire any already-expired reservations for this product
          const now = new Date();
          const expiredReservations = await tx.reservation.findMany({
               where: {
                    productId,
                    status: ReservationStatus.ACTIVE,
                    expiresAt: {lte: now},
               },
          });

          // Expire them and restore stock (batch operation)
          if (expiredReservations.length > 0) {
               await expireReservationsAndRestoreStock(
                    tx as any,
                    expiredReservations,
                    productId
               );
          }

          // 2. Get current product with stock
          const product = await tx.product.findUnique({
               where: {id: productId},
          });

          if (!product) {
               throw new NotFoundException(`Product not found`);
          }

          // 3. Check stock availability (inside transaction)
          if (product.availableStock < quantity) {
               throw new BadRequestException(
                    `Insufficient stock. Available: ${product.availableStock}, Requested: ${quantity}`
               );
          }

          // 4. Create reservation
          const newReservation = await tx.reservation.create({
               data: {
                    productId,
                    quantity,
                    status: ReservationStatus.ACTIVE,
                    expiresAt: new Date(Date.now() + RESERVATION_DURATION_MS),
               },
          });

          // 5. Atomically decrement stock
          await tx.product.update({
               where: {id: productId},
               data: {
                    availableStock: {decrement: quantity},
               },
          });

          return newReservation;
     });
}
```

**How it works**:

-    Prisma transactions use PostgreSQL's `BEGIN`/`COMMIT`
-    All operations in the transaction are atomic
-    Database-level locking ensures only one transaction modifies stock at a time
-    If any operation fails, entire transaction rolls back
-    Stock check happens inside transaction, preventing race conditions

### Stock Validation Flow

```
User Request → Transaction Start (BEGIN)
    ↓
Expire Already-Expired Reservations (free up stock)
    ↓
Get Product (with current stock)
    ↓
Check Stock >= Quantity?
    ├─ NO → Rollback → Error Response
    └─ YES → Continue
        ↓
Create Reservation
    ↓
Decrement Stock (Atomic Operation)
    ↓
Commit Transaction (COMMIT)
    ↓
Schedule Expiration Job
    ↓
Success Response
```

### Multiple Users, Same Product

**Design Decision**: Each user/browser gets their own reservation.

**How it works**:

-    User A reserves Product X (quantity: 1) → Stock decreases by 1
-    User B reserves Product X (quantity: 1) → Stock decreases by 1 again
-    Both reservations are independent
-    Each has its own 2-minute timer
-    Stock is restored when each reservation expires

**Why this design**:

-    Allows multiple users to reserve the same product simultaneously
-    Each user has their own reservation window
-    Prevents one user from blocking others
-    More user-friendly than "first come, first served"

## Trade-offs and Limitations

### Trade-offs

#### 1. Polling vs WebSocket

**Current Approach**: Frontend polls backend every 2 seconds

**Trade-offs**:

-    ✅ **Pros**: Simple, works with any backend, no persistent connections
-    ❌ **Cons**: Slight delay (up to 2 seconds) for status updates, more server load

**Alternative**: WebSocket for real-time updates

-    ✅ **Pros**: Instant updates, less server load
-    ❌ **Cons**: More complex, requires persistent connections, harder to scale

#### 2. Three-Layer Expiration System

**Current Approach**: BullMQ jobs + Startup recovery + Periodic checks

**Trade-offs**:

-    ✅ **Pros**: Highly reliable, handles edge cases, survives failures
-    ❌ **Cons**: More complex, slight overhead from periodic checks

**Alternative**: Single mechanism (e.g., only BullMQ)

-    ✅ **Pros**: Simpler code
-    ❌ **Cons**: Less reliable, fails if Redis is down or jobs are lost

#### 3. Multiple Reservations per Product

**Current Approach**: Each user gets their own reservation

**Trade-offs**:

-    ✅ **Pros**: Better UX, no blocking, fair for all users
-    ❌ **Cons**: Stock can be "locked" by multiple reservations

**Alternative**: First-come-first-served

-    ✅ **Pros**: Simpler, stock not locked by multiple users
-    ❌ **Cons**: Poor UX, one user blocks others

#### 4. localStorage for Timer Persistence

**Current Approach**: Save timer state to localStorage

**Trade-offs**:

-    ✅ **Pros**: Works offline, survives page refreshes, no server state needed
-    ❌ **Cons**: Browser-specific, can be cleared, not shared across devices

**Alternative**: Server-side session

-    ✅ **Pros**: Shared across devices, more secure
-    ❌ **Cons**: Requires authentication, server state management

### Limitations

#### 1. No User Authentication

**Current State**: System doesn't track which user made which reservation

**Limitations**:

-    Cannot prevent same user from creating multiple reservations
-    Cannot show user's reservation history
-    Cannot implement per-user rate limiting

#### 2. No Reservation Cancellation

**Current State**: Users cannot cancel reservations manually

**Limitations**:

-    Stock remains locked until expiration or completion
-    Users must wait for expiration to free up stock

#### 3. Fixed 2-Minute Duration

**Current State**: Reservation duration is hardcoded to 2 minutes

**Limitations**:

-    Cannot configure different durations per product
-    Cannot allow users to extend reservations

#### 4. Polling Delay

**Current State**: Frontend polls every 2 seconds

**Limitations**:

-    Up to 2-second delay for status updates
-    More server requests than WebSocket

**Impact**: Low - acceptable for this use case

#### 5. Single Redis Instance

**Current State**: Uses single Redis instance for job queue

**Limitations**:

-    Single point of failure
-    No high availability

**Impact**: Medium - can be mitigated with Redis Cluster

### Performance Considerations

#### Database Indexes

-    `reservations.status` - Fast queries for active reservations
-    `reservations.expiresAt` - Efficient expiration queries
-    `products.id` - Primary key, automatically indexed

#### Job Queue Optimization

-    Unique job IDs prevent duplicates
-    Exponential backoff for retries
-    Redis persistence ensures no job loss

#### Frontend Optimization

-    Polling interval (2 seconds) balances accuracy vs. server load
-    Local timer (100ms) provides smooth UX without server requests
-    Debounced API calls prevent infinite loops
-    Memoized components reduce re-renders

### Scalability Considerations

#### Horizontal Scaling

-    **Backend**: Stateless, can run multiple instances
-    **Redis**: Shared job queue across instances
-    **PostgreSQL**: Can use read replicas for product queries

#### Vertical Scaling

-    Database connection pooling (Prisma default)
-    Redis connection pooling (BullMQ default)
-    Efficient indexing for fast queries
