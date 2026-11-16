# FlashSlot ⚡

**A real-time flash-deal marketplace that fills businesses' empty last-minute slots with auto-dropping prices, selling each slot exactly once even under heavy concurrent demand.**

A salon gets a cancellation for 4 PM. Instead of losing that revenue, it lists the slot on FlashSlot at ₹1,800 with a floor of ₹800. The price falls automatically as 4 PM approaches. Buyers watch it drop live. The first person to tap **Grab it** locks the price for 2 minutes, pays, and owns the slot. Everyone else is turned away instantly, even if 1,000 people tapped at the same millisecond.

---

## Quick start

Requirements: **Node 20+**, plus **either** Homebrew (lightweight, recommended on a laptop) **or** Docker Desktop.

### Option A: without Docker (native Postgres + Redis, light on disk/CPU)

```bash
brew install postgresql@16 redis   # once
npm install                        # once
npm run local:setup                # once: start services, create DB, migrate, load demo data
npm run local                      # every time: starts Postgres + Redis, then API (:4000) + web (:5173)
npm run local:stop                 # when you're done: stops Postgres + Redis (frees memory)
```

Nothing auto-starts at login. `npm run local:status` shows what's running, `npm run local:seed` resets demo data.
Native services use ports **5434** (Postgres) and **6379** (Redis), so they never clash with the Docker ones or with another Postgres already on 5432.

### Option B: with Docker

```bash
npm install
npm run docker:setup     # once: start containers, migrate, load demo data
npm run docker           # every time
npm run infra:down       # stop containers
```

Docker uses ports 5433/6380. The two options keep **separate databases**, so seed whichever one you use.

Open **http://localhost:5173**. Every demo account's password is `password123`, and the login page has one-click buttons:

| Role | Email | What to try |
|---|---|---|
| Customer | `customer@flashslot.dev` | Browse live deals, grab one, pay, see it in *My bookings* |
| Merchant | `merchant@flashslot.dev` | Dashboard, list a new slot with a live price-curve preview |
| Admin | `admin@flashslot.dev` | **Concurrency Lab**: fire up to 1,000 simultaneous buyers at one slot |

Seeded deals start within the next ~4 hours, so reset the data (`npm run local:seed` / `npm run docker:seed`) or press **Spawn 8 fresh deals** in the Lab if they've all expired.

### Production-style stack (2 API instances + load balancer)

```bash
npm run stack:up     # Postgres, Redis, api1, api2, Nginx+web  ->  http://localhost:8080
npm run stack:seed   # load demo data into it
npm run stack:down
```

Every API response carries an `X-Served-By` header, so you can watch Nginx spread requests across `api-1` and `api-2`.

---

## Tech stack

| Layer | Choice |
|---|---|
| Backend | **TypeScript + NestJS** (modules, DI, guards), Prisma ORM |
| Database | **PostgreSQL** (source of truth, ACID transactions) |
| Cache / coordination | **Redis** (atomic Lua scripts, rate limiting, pub/sub, cache) |
| Realtime | **Socket.IO** + Redis adapter (works across instances) |
| Frontend | **React 19 + TypeScript + Vite**, Tailwind CSS v4, TanStack Query, Framer Motion, Recharts |
| Infra | Docker Compose, Nginx load balancer |

---

## Architecture

```
                ┌────────────── Browser (React) ──────────────┐
                │  REST (fetch)            WebSocket (live)   │
                └───────┬───────────────────────┬─────────────┘
                        ▼                       ▼
                 ┌──────────── Nginx (load balancer) ─────────┐
                 └───────┬───────────────────────┬────────────┘
                         ▼                       ▼
                 ┌─────────────┐          ┌─────────────┐
                 │   API #1    │          │   API #2    │   stateless NestJS
                 │  (leader)   │          │             │   (JWT auth)
                 └──┬───────┬──┘          └──┬───────┬──┘
                    │       └──────┬─────────┘       │
                    ▼              ▼                 ▼
             ┌────────────┐  ┌───────────────────────────────┐
             │ PostgreSQL │  │ Redis: hold gate · rate limits│
             │ (truth)    │  │ feed cache · leader lease ·   │
             └────────────┘  │ viewer counts · Socket.IO bus │
                             └───────────────────────────────┘
```

### Backend modules (`apps/api/src`)

| Module | Responsibility |
|---|---|
| `infrastructure/` | Prisma, Redis, Lua script runner, **leader election**, **token-bucket rate limiter** |
| `modules/auth` | Register/login, JWT, `@Auth('MERCHANT')` role guards, `PasswordHasher` abstraction |
| `modules/pricing` | Price-drop strategies (pure functions of time) + curve preview |
| `modules/slots` | Slot lifecycle (State pattern), repository with atomic transitions, cached feed, price ticker, expiry sweeper |
| `modules/booking` | Two-phase hold → checkout, Redis gate, validation chain, idempotency |
| `modules/payment` | Payment gateway port, mock adapter, circuit-breaker decorator |
| `modules/events` | Domain events, in-process event bus, **transactional outbox** + relay |
| `modules/realtime` | Socket.IO gateway, Redis adapter, live viewer presence |
| `modules/notifications` | Reacts to events → stored + pushed notifications |
| `modules/business` | Merchant profile + dashboard stats |
| `modules/demo` | Concurrency Lab (stampede test) + demo data |

---

## The core problem: selling each slot exactly once

Booking is **two-phase**:

1. **Hold** (`POST /api/slots/:id/hold`): reserve the slot for 2 minutes and **lock the price** at that instant.
2. **Checkout** (`POST /api/slots/:id/checkout`, with an `Idempotency-Key` header): charge the payment, then atomically mark the slot SOLD, create the booking, and write an outbox event.

Correctness comes from **three independent layers** (defense in depth):

| Layer | Where | How |
|---|---|---|
| 1. Redis atomic gate | `booking/hold-gate.ts` | Lua script: *if no holder → set holder (with TTL)* as one indivisible step. Rejects the crowd in ~1 ms, so Postgres never sees the stampede. |
| 2. Optimistic lock (compare-and-set) | `slots/slot.repository.ts` | `UPDATE slot SET status='HELD', version=version+1 WHERE id=? AND version=? AND status='LIVE'`. Postgres row locking means exactly one request gets "1 row updated". **This is the authoritative guarantee.** |
| 3. Unique constraint | `prisma/schema.prisma` | `Booking.slotId @unique`: the database physically refuses a second booking row. |

Even if Redis were wiped, layers 2 and 3 still guarantee one sale. The **Concurrency Lab** proves it live:

| Lab mode | Result with 300–1000 buyers |
|---|---|
| Redis gate + DB lock | 1 winner, everyone else rejected by Redis in a few ms |
| DB lock only | 1 winner, rejected by the compare-and-set (slower, still correct) |
| Naive read-then-write | **every** buyer "wins": the double-selling bug we prevent |

### Other edge cases handled

- **Price locked at hold time**: the price can't change during checkout.
- **Hold expiry**: lazy (an expired hold already reads as LIVE) plus a background sweeper that writes it back and notifies clients.
- **Double-click / retry**: same `Idempotency-Key` → same booking, never charged twice. A concurrent duplicate gets `409 DUPLICATE_REQUEST`.
- **Payment succeeded but sale failed** (hold expired mid-payment) → automatic **refund** (compensating action).
- **One checkout at a time per buyer** and **merchants can't buy their own slots** (validation chain).
- **Slot started unsold** → EXPIRED and merchant notified.

---

## System design concepts → where to find them

| Concept | Implementation |
|---|---|
| Concurrency control / distributed locking | Redis Lua gate, Postgres optimistic locking (`version` column) |
| Idempotency | `Idempotency-Key` header, unique `idempotencyKey` column, in-flight Redis lock |
| Caching (cache-aside) | `CachedSlotFeedQuery`: feed cached in Redis, invalidated by **version bump** on any slot change |
| Rate limiting | Token bucket in Redis (Lua, uses Redis `TIME`), per user/IP: `@RateLimit('hold', 6, 0.2)` |
| Horizontal scaling | Stateless API (JWT) behind Nginx; Socket.IO Redis adapter fans events to all instances |
| Leader election | Redis lease (`SET NX PX` + renew script): background jobs run on exactly one instance |
| Event-driven architecture | Domain events + event bus (Observer) |
| Transactional outbox | Event row written in the same DB transaction as the sale; relay publishes with retries |
| Resilience | Circuit breaker + timeout around the payment provider; compensating refund |
| Real-time push | WebSockets: price ticks every 2s, slot state changes, viewer counts, notifications |
| Data modelling | Integer paise for money, indexes on `(status, startsAt)`, `(businessId, status)`, `(status, holdExpiresAt)` |
| CQRS-lite | Reads (`SlotFeedService`, cached) separated from writes (`SlotCommandService`, `BookingService`) |
| Load balancing | Nginx `least_conn` across 2 API containers, health checks in Compose |
| Graceful degradation | If Redis goes down: the feed is served from Postgres, holds fall back to the DB lock alone (still exactly one winner), rate limiting fails open. Redis commands fail fast instead of hanging. Try it: `docker compose stop redis`, then run the Lab. |

---

## OOP & SOLID

### Design patterns

| Pattern | Where | Why |
|---|---|---|
| **Strategy** | `pricing/strategies.ts` (Linear, Step, Exponential) | Swap price curves without touching callers |
| **Template Method** | `PricingStrategy.priceAt()` | Fixed algorithm (progress → discount → clamp → round); subclasses only define the curve shape |
| **State** | `slots/slot-state.ts` | Each lifecycle state decides which actions are legal (`canHold`, `canConfirm`, …) |
| **Repository** | `slots/slot.repository.ts` | All persistence and atomic transitions in one place |
| **Decorator** | `CachedSlotFeedQuery`, `ResilientPaymentGateway` | Add caching / circuit breaking without modifying the wrapped class |
| **Adapter** | `MockPaymentGateway` implements `PaymentGateway` | Plug any provider (Razorpay, Stripe) behind one interface |
| **Chain of Responsibility** | `booking/booking-rules.ts` | Validation rules linked together; add a rule = add a class |
| **Observer** | `events/event-bus.ts` + `NotificationsService` | Producers emit events without knowing consumers |
| **Facade** | `PricingService`, `BookingService` | Simple API over strategies / the multi-step purchase |
| **Singleton (via DI)** | Nest providers (`RedisService`, `PrismaService`) | One shared connection pool per instance |

### SOLID

- **S**ingle Responsibility: `HoldGate` only does the Redis gate, `SlotChangePublisher` only does cache invalidation + broadcast, `IdempotencyLock` only deduplicates.
- **O**pen/Closed: new price curve = new `PricingStrategy` subclass registered in `PricingModule`; new booking rule = new `BookingRule`; new event reaction = new `bus.subscribe`. No existing code edited.
- **L**iskov Substitution: any `PaymentGateway` (mock, resilient wrapper, a future Razorpay one) works wherever one is expected; same for `SlotFeedQuery` (DB vs cached).
- **I**nterface Segregation: small focused ports: `PaymentGateway` (charge/refund), `RealtimePublisher` (toAll/toUser/toRoom), `PasswordHasher` (hash/verify).
- **D**ependency Inversion: services depend on abstract classes (`PaymentGateway`, `RealtimePublisher`, `SlotFeedQuery`, `PasswordHasher`). Concrete classes are chosen only in module providers (the composition root).

---

## API reference (all under `/api`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` · `/auth/login` | none | Get a JWT |
| GET | `/auth/me` | any | Current user |
| GET | `/slots?category=&city=&sort=` | optional | Live deal feed (cached) |
| GET | `/slots/:id` | optional | Slot + price curve |
| POST | `/slots` | merchant | Create slot (draft or live) |
| POST | `/slots/:id/publish` · `/cancel` | merchant | Lifecycle actions |
| POST | `/slots/:id/hold` | customer | Phase 1: lock price for 2 min |
| POST | `/slots/:id/release` | any | Abandon a hold |
| POST | `/slots/:id/checkout` | customer | Phase 2: pay (needs `Idempotency-Key`) |
| GET | `/bookings/me` | any | My bookings |
| GET | `/pricing/strategies` · POST `/pricing/preview` | none | Curve metadata & preview |
| GET/PUT | `/business/me` · GET `/business/me/dashboard` | merchant | Profile & stats |
| GET | `/notifications` · POST `/notifications/read-all` | any | Notifications |
| POST | `/demo/stampede` · `/demo/spawn-deals` · GET `/demo/system` | admin | Concurrency Lab |

WebSocket events (server → client): `prices`, `slot:update`, `viewers`, `notification`. Client → server: `slot:watch`, `slot:unwatch`.

Errors always look like `{ "error": "SLOT_UNAVAILABLE", "message": "…" }`.

---

## Configuration (`apps/api/.env`)

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | local Docker Postgres on 5433 | Postgres connection |
| `REDIS_URL` | `redis://localhost:6380` | Redis connection |
| `JWT_SECRET` | dev value | **Change in production** |
| `HOLD_TTL_SECONDS` | 120 | Checkout hold length |
| `PAYMENT_LATENCY_MS` | 700 | Mock gateway latency |
| `PAYMENT_FAILURE_RATE` | 0 | Set e.g. `0.3` to demo declines and the circuit breaker |
| `INSTANCE_ID` | `api-local` | Name shown in `X-Served-By` |

## Deploying

The repo is deploy-ready: both apps have Dockerfiles (build context = repo root) and `docker-compose.yml` runs the full topology. For a cloud host, provide managed Postgres + Redis URLs and a strong `JWT_SECRET`, run the API image (it applies migrations when `RUN_MIGRATIONS=true`), and serve the web image (Nginx config in `infra/nginx`).
