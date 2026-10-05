# ⚡ SALESTORM — Flash-Sale Architecture at Scale

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-6366f1.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0-22c55e.svg)](https://nodejs.org)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-00758f.svg)](https://www.mysql.com/)
[![Redis](https://img.shields.io/badge/Redis-7.x-dc382d.svg)](https://redis.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-5.x-e11d48.svg)](https://docs.bullmq.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ed.svg)](https://www.docker.com/)
[![Locust](https://img.shields.io/badge/Load%20Test-Locust%2010k%20CCU-f97316.svg)](https://locust.io/)

**10,000 concurrent buyers. 100 units. Zero oversells. Every time.**

*SysCrafters 2026 Hackathon — Production-Grade System Design Prototype*

</div>

---

## 🧭 Table of Contents

1. [What Is SALESTORM?](#-what-is-salestorm)
2. [Architecture at a Glance](#-architecture-at-a-glance)
3. [Core Architectural Invariants](#-core-architectural-invariants)
4. [Quick Start](#-quick-start)
5. [API Reference](#-api-reference)
6. [Automated Test Suite](#-automated-test-suite-t1--t5)
7. [Load Testing](#-load-testing-10000-concurrent-users)
8. [Design Patterns](#-design-patterns)
9. [Architecture Decision Records](#-architecture-decision-records)
10. [Repository Structure](#-repository-structure)
11. [Submission Artifacts Index](#-submission-artifacts-index)
12. [Environment Variables](#-environment-variables)

---

## 🌩️ What Is SALESTORM?

SALESTORM is a **production-grade flash-sale backend** engineered to handle the hardest problem in e-commerce infrastructure: **exactly 10,000 simultaneous buyers competing for 100 available units** — with a mathematically guaranteed zero-oversell outcome.

This is not a toy prototype. It is a rigorous demonstration of how real distributed systems solve concurrency, idempotency, event-driven consistency, and fault tolerance — using the same primitives deployed at scale by leading e-commerce platforms.

### The Core Challenge

```
10,000 concurrent POST /buy requests
         ↓
  100 units available
         ↓
 Exactly 100 succeed. 9,900 rejected.
 Zero oversells. Zero lost orders.
 Zero crashes. No exceptions.
```

### Tech Stack

| Layer | Technology | Role |
|---|---|---|
| **API Server** | Node.js 20 + Express | High-throughput HTTP handler (pool: 50 conns) |
| **Primary Database** | MySQL 8 (InnoDB) | ACID transactions, CAS inventory updates, CHECK constraints |
| **Cache / Gate** | Redis 7 (AOF) | Fast-reject gate, idempotency cache, BullMQ broker |
| **Job Queue** | BullMQ | Durable async order processing with exponential backoff |
| **Containerization** | Docker Compose | Four-service orchestration with health-check dependencies |
| **Load Testing** | Locust (Python) | Distributed 10k CCU simulation |
| **Logging** | Pino (JSON) | Structured logs with request correlation IDs |

---

## 🏗️ Architecture at a Glance

```
  ┌─────────────────────────────────────────────────────────────────────┐
  │                        CLIENT LAYER                                  │
  │           10,000 concurrent POST /buy  ·  React Dashboard           │
  └────────────────────────┬────────────────────────────────────────────┘
                           │
                           ▼
  ┌────────────────────────────────────────┐
  │         Express API (Port 3000)        │
  │  ┌──────────────────────────────────┐  │
  │  │  Idempotency Middleware          │  │  ← SHA-256 body hash guard
  │  │  RequestId Middleware            │  │  ← UUID correlation per request
  │  └──────────────────────────────────┘  │
  └──────┬─────────────────────┬───────────┘
         │                     │
         ▼                     ▼
  ┌─────────────┐      ┌──────────────┐
  │  MySQL 8    │      │  Redis 7     │
  │  (InnoDB)   │      │  (AOF)       │
  │             │      │              │
  │  inventory  │      │  Fast-Reject │
  │  reservations│     │  Gate (DECR) │
  │  payments   │      │  Idem Cache  │
  │  orders     │      │  BullMQ Jobs │
  │  outbox_    │      │              │
  │    events   │      └──────────────┘
  └──────┬──────┘
         │
         ▼
  ┌─────────────────────────────────────────┐
  │          Background Worker Process       │
  │                                          │
  │  ┌───────────────┐  ┌─────────────────┐ │
  │  │ Expiry Sweeper│  │ Outbox Publisher│ │
  │  │ (every 5s)    │  │ (every 1s)      │ │
  │  │ SKIP LOCKED   │  │ SKIP LOCKED     │ │
  │  └───────────────┘  └────────┬────────┘ │
  │                               │          │
  │               ┌───────────────▼────────┐ │
  │               │ BullMQ Order Consumer  │ │
  │               │ Concurrency: 10        │ │
  │               │ Retries: 20 + backoff  │ │
  │               └────────────────────────┘ │
  └─────────────────────────────────────────┘
```

### The Two-Transaction `/buy` Flow

The entire purchase lifecycle executes across **two short, focused database transactions** with external I/O deliberately placed between them:

```
[Tx 1 — ~2ms]  Reserve Stock
   UPDATE inventory SET available=available-1, reserved=reserved+1
   WHERE product_id=? AND available >= 1          ← atomic CAS, no SELECT needed
   INSERT INTO reservations (status='PENDING', expires_at=NOW+30s)
   COMMIT

[External — 100–300ms]  Charge Payment Gateway
   charge({ reservationId, amountCents: 9999 })   ← never inside a DB transaction

[Tx 2 — ~2ms]  Settle Outcome
   UPDATE reservations SET status='PAID' WHERE id=? AND status='PENDING'   ← CAS guard
   UPDATE inventory SET reserved=reserved-1, sold=sold+1
   INSERT INTO payments (status='SUCCESS')
   INSERT INTO outbox_events (type='OrderCreated', payload=...)             ← same Tx
   UPDATE idempotency_keys SET status='COMPLETED', code=200
   COMMIT
```

> **Key insight**: External payment I/O happens *between* transactions — never inside one. This keeps transaction hold times under 2ms, enabling a 50-connection pool to sustain 25,000 internal tx/s.

---

## 🛡️ Core Architectural Invariants

The system enforces **4 mathematically provable invariants** at every state transition, verified at both the application layer and the MySQL storage engine layer via `CHECK` constraints:

### Invariant 1 — Inventory Conservation (always holds)

```
available + reserved + sold = total
where: available ≥ 0, reserved ≥ 0, sold ≥ 0
```

### Invariant 2 — Reservation State Machine (strictly unidirectional)

```
                ┌──────────► PAID     (payment confirmed)
                │
  PENDING ──────┼──────────► FAILED   (payment declined)
                │
                └──────────► EXPIRED  (TTL elapsed, stock returned)
```

All transitions execute as `UPDATE ... WHERE status = 'PENDING'` — **blind updates are forbidden**. If `affectedRows = 0`, a concurrent winner already claimed the transition; the operation is safely skipped.

### Invariant 3 — Transaction Boundary Rule

- DB transactions stay **under 2ms**.
- External network I/O (payment gateway, MQ dispatch) **must not** execute inside an open transaction.

### Invariant 4 — Asynchronous-Only Order Creation

- Orders are **never created inline** during `POST /buy`.
- Order creation is exclusively driven by consuming `OrderCreated` events via the Transactional Outbox pattern — guaranteeing effectively-once delivery even across worker crashes.

---

## ⚡ Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (must be running)
- Node.js >= 20.0.0
- Python 3.10+ *(optional — only for Locust load-testing)*

### 1. Start Full Stack

```bash
docker compose up --build -d
```

This launches four services with health-check-gated startup ordering:

| Container | Port | Role |
|---|---|---|
| `flash_mysql` | `3306` | MySQL 8 with schema auto-init and CHECK constraints |
| `flash_redis` | `6379` | Redis 7 with AOF durability enabled |
| `flash_api` | `3000` | Express API server, DB pool size 50 |
| `flash_worker` | — | Expiry Sweeper + Outbox Publisher + BullMQ Order Consumer |

### 2. Verify the Stack is Healthy

```bash
curl http://localhost:3000/health
# → { "status": "ok", "mysql": "ok", "redis": "ok" }
```

### 3. Run All Automated Tests

```bash
npm run test:all
```

Each test phase auto-resets the database before running. See [Test Suite](#-automated-test-suite-t1--t5) for details.

### 4. Launch Real-Time Dashboard *(Optional)*

```bash
cd dashboard
npm install
npm run dev
# Open http://localhost:5173
```

---

## 📡 API Reference

### Purchase Flow

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/buy` | Purchase Product X (qty 1) |

**Required Headers:**
```
Idempotency-Key: <uuid-v4>              # Required on all mutating requests
X-Simulate-Payment: success|fail|hang   # Test-only; ignored in production
```

**Success Response `200 OK`:**
```json
{
  "data": {
    "reservationId": "uuid",
    "status": "PAID",
    "expiresAt": "2026-10-05T15:05:00.000Z",
    "payment": { "transactionId": "uuid", "amountCents": 9999 }
  }
}
```

**Sold-Out Response `409 SOLD_OUT`:**
```json
{ "error": { "code": "SOLD_OUT", "message": "No units available." } }
```

**Idempotent Replay `200 OK` (cached):**
```
Idempotent-Replay: true
```

---

### Admin & Observability Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Liveness/readiness — verifies MySQL + Redis connectivity |
| `GET` | `/admin/stats` | Live accounting audit: inventory + reservation + payment + order counts |
| `POST` | `/admin/reset` | Truncates all transactional tables; resets stock to 100 units |
| `POST` | `/admin/order-service/down?seconds=30` | Simulates downstream order-service outage |
| `POST` | `/admin/order-service/up` | Restores order service (clears outage flag) |
| `GET` | `/api/inventory/:productId` | Real-time inventory snapshot |
| `GET` | `/orders/:reservationId` | Fetch order record by reservation ID |

---

## 🧪 Automated Test Suite (T1 – T5)

Run the complete suite end-to-end (each phase resets the database automatically):

```bash
npm run test:all

# Or run individual phases:
npm run test:concurrency    # T2: Oversell protection
npm run test:idempotency    # T3: Idempotency & tamper detection
npm run test:payment        # T4: Payment failure safety
npm run test:expiry         # Phase 5: Reservation expiry + stock return
npm run test:order          # Phase 6: BullMQ order processing + outage recovery
```

### Test Phase Catalog

| Phase | Test Name | Scenario | Pass Condition |
|---|---|---|---|
| **T1** | Happy Path | `POST /buy` — success flow | Reservation `PAID`, payment `SUCCESS`, order created async |
| **T2** | Oversell Protection | 1,000 concurrent requests for 100 units | Exactly **100 succeed** (`PAID`), rest receive `409 SOLD_OUT` — zero exceptions |
| **T3** | Idempotency Replay | Same `Idempotency-Key` fired 5× in parallel | Exactly **1** reservation, **1** payment, **1** order; `Idempotent-Replay: true` on replays |
| **T3b** | Tamper Detection | Same key, different request body payload | `422 IDEMPOTENCY_KEY_REUSED` — no order created |
| **T4** | Payment Failure | `X-Simulate-Payment: fail` | `402` response, reservation `FAILED`, stock **immediately restored** to available |
| **T5** | Order Outage Recovery | Order service downed 30s during active purchases | Payment commits; BullMQ retries with exponential backoff; order created on recovery with zero DLQ drops |

---

## 🔥 Load Testing (10,000 Concurrent Users)

### Setup

```bash
pip install locust
cd load-test
locust -f locustfile.py --host=http://localhost:3000
# Open http://localhost:8089 — set 10,000 users, spawn rate 500/s
```

### Expected Benchmark Results

| Metric | Target | Expected Outcome |
|---|---|---|
| Successful purchases (`PAID`) | Exactly **100** | ✅ Zero oversell |
| Sold-out rejections (`409`) | ~9,900 | ✅ Deterministic |
| Idempotent replays handled | ~1,000 | ✅ No duplicates |
| Peak throughput | > 2,000 req/s | ✅ Pool of 50 sustains 25k internal tx/s |
| Median latency (p50) | < 250ms | ✅ Dominated by simulated payment (~200ms) |
| p95 latency | < 350ms | ✅ |
| p99 latency | < 450ms | ✅ |
| Unexpected 5xx / crashes | **0** | ✅ Zero crashes |

### Post-Test Invariant Audit (`GET /admin/stats`)

After queue drains fully, the accounting snapshot must show:

```json
{
  "inventory":    { "available": 0,   "reserved": 0, "sold": 100, "total": 100 },
  "reservations": { "PAID": 100, "PENDING": 0, "FAILED": 4, "EXPIRED": 0 },
  "payments":     { "SUCCESS": 100, "FAILED": 4 },
  "orders":       { "total": 100 }
}
```

**All 4 invariants verified:**
- `available (0) >= 0` ✅ — No negative inventory
- `sold (100) <= total (100)` ✅ — No oversell
- `available + reserved + sold = total` ✅ — Conservation holds
- `orders.total = reservations.PAID` ✅ — Zero lost orders

---

## 🧩 Design Patterns

This codebase is a deliberate showcase of five production architectural patterns applied to a single domain:

### 1. Repository Pattern
**Files:** `src/modules/*/*.repository.js`

Decouples domain logic from raw SQL. All repository methods accept an explicit `conn` parameter to participate in externally-managed transactions — SQL never leaks into services, controllers, or workers.

### 2. Transactional Outbox Pattern
**Files:** `src/modules/outbox/outbox.repository.js`, `src/jobs/outboxPublisher.js`

Eliminates the "payment committed, but event lost" dual-write problem. `OrderCreated` is inserted into `outbox_events` inside **the same ACID transaction** as payment settlement. A background publisher polls using `FOR UPDATE SKIP LOCKED` and guarantees at-least-once delivery to BullMQ — surviving API crashes between commit and dispatch.

### 3. State Machine (Compare-And-Swap via SQL)
**Files:** `src/modules/reservation/reservation.repository.js`

All status transitions execute as:
```sql
UPDATE reservations SET status = :toStatus
WHERE id = :id AND status = :fromStatus   -- CAS guard
```
If `affectedRows = 0`, a concurrent operation already claimed the transition — the operation is safely skipped. This eliminates application-layer race conditions without pessimistic locking.

### 4. Strategy Pattern (Payment Gateway)
**Files:** `src/modules/payment/paymentGateway.js`

A unified `charge({ reservationId, amountCents, simulate })` contract swaps between deterministic success, deterministic failure, and simulated network hang — without modifying any service orchestration code.

### 5. Producer-Consumer (Outbox → BullMQ → Worker)
**Files:** `src/queues/producer.js`, `src/queues/worker.js`

Decouples high-throughput request ingestion from heavy downstream order creation. The Outbox Publisher is the Producer; BullMQ Worker is the Consumer (concurrency: 10) with 20-attempt exponential backoff and a Dead-Letter Queue for poisoned messages.

---

## 📋 Architecture Decision Records

Four formal ADRs document the key technical decisions made during design:

| ADR | Title | Decision |
|---|---|---|
| [ADR-001](10_ADR/ADR-001_conditional_update_vs_pessimistic_lock.md) | Atomic Conditional UPDATE vs. Pessimistic Lock | **Adopted atomic CAS UPDATE** — eliminates SELECT round-trip, holds row lock for < 2ms vs. entire application execution time under `FOR UPDATE` |
| [ADR-002](10_ADR/ADR-002_transactional_outbox_pattern.md) | Transactional Outbox vs. Direct Queue Publish | **Adopted Outbox** — prevents dual-write split-brain between payment commit and MQ dispatch; survives API crashes |
| [ADR-003](10_ADR/ADR-003_expiry_sweeper_vs_delayed_jobs.md) | Expiry Sweeper Job vs. BullMQ Delayed Jobs | **Adopted Sweeper** — SKIP LOCKED batch processing avoids worker contention; single background job sweeps N expired rows per poll cycle |
| [ADR-004](10_ADR/ADR-004_idempotency_via_unique_constraint.md) | Idempotency via DB Unique Constraint | **Adopted DB-level UNIQUE constraint** on `idempotency_keys.key` — provides race-free, crash-safe ownership claims with no application-layer locking |

---

## 📂 Repository Structure

```
sysdes/
├── src/
│   ├── app.js                      # Express app factory + middleware wiring
│   ├── server.js                   # HTTP server bootstrap
│   ├── worker.js                   # Background worker bootstrap
│   ├── config/                     # env, DB pool (size 50), Redis client
│   ├── middleware/
│   │   ├── requestId.js            # UUID v4 correlation ID injection
│   │   ├── idempotency.js          # SHA-256 hash guard + IN_PROGRESS claim
│   │   └── errorHandler.js         # Unified { error: { code, message } } format
│   ├── modules/
│   │   ├── inventory/              # Atomic CAS UPDATE, stock snapshot
│   │   ├── reservation/            # State machine: PENDING → PAID|FAILED|EXPIRED
│   │   ├── payment/                # Strategy-pattern gateway, TTL guard
│   │   ├── order/                  # Idempotent INSERT ON DUPLICATE KEY UPDATE
│   │   ├── outbox/                 # Transactional outbox: write + poll publisher
│   │   ├── idempotency/            # Key lifecycle: IN_PROGRESS → COMPLETED
│   │   ├── product/                # Product catalogue read
│   │   └── admin/                  # Stats, reset, outage toggle
│   ├── queues/
│   │   ├── producer.js             # Outbox → BullMQ enqueue
│   │   └── worker.js               # BullMQ consumer (concurrency 10, 20 retries)
│   ├── jobs/
│   │   ├── expirySweeper.js        # Cron: SKIP LOCKED batch expiry (every 5s)
│   │   └── outboxPublisher.js      # Cron: SKIP LOCKED outbox poll (every 1s)
│   └── utils/
│       ├── logger.js               # Pino — JSON in prod, pretty in dev
│       └── errors.js               # Typed error classes with HTTP status codes
│
├── db/
│   └── schema.sql                  # Full DDL: tables, indexes, CHECK constraints
│
├── tests/
│   ├── run-all.js                  # Sequential test runner with auto-reset
│   ├── test_phase2_concurrency.js  # T2: 1000 CCU oversell protection
│   ├── test_phase3_idempotency.js  # T3: replay + tamper detection
│   ├── test_phase4_payment.js      # T4: payment failure + stock restore
│   ├── test_phase5_expiry.js       # Phase 5: TTL expiry + stock return
│   ├── test_phase6_order.js        # Phase 6: outbox + BullMQ + outage recovery
│   └── flash_sale_postman_collection.json
│
├── load-test/
│   └── locustfile.py               # Locust: 10,000 CCU, 500 users/s spawn rate
│
├── dashboard/                      # React real-time monitoring dashboard
│
├── docs/                           # Deep-dive technical references
│   ├── concurrency-control.md
│   ├── idempotency.md
│   ├── payment-flow.md
│   ├── reservation-expiry.md
│   ├── order-processing.md
│   └── test-report.md
│
├── docker-compose.yml              # 4-service stack with health-check ordering
├── Dockerfile                      # Node.js container image
├── .env.example                    # Environment variable template
└── README.md
```

---

## 📚 Submission Artifacts Index

All formal hackathon deliverables are organized in dedicated numbered directories:

| Directory | Deliverable | Description |
|---|---|---|
| [`01_Requirements/`](01_Requirements/requirements.md) | Requirements Specification | Functional & non-functional requirements, domain rules, and mathematical invariants |
| [`02_HLD/`](02_HLD/architecture.md) | High-Level Design | Component architecture + 3 Mermaid sequence diagrams (buy flow, expiry, outbox recovery) |
| [`03_LLD/`](03_LLD/low_level_design.md) | Low-Level Design | Concurrency control details, CAS state transitions, transaction boundary analysis |
| [`04_Database/`](04_Database/database_design.md) | Database Design | ER diagram, full schema DDL, indexing strategy, CHECK constraint defense |
| [`05_API/`](05_API/openapi.yaml) | OpenAPI 3.0 Spec | Typed API contract with `Idempotency-Key` header and all error schemas |
| [`06_SOLID/`](06_SOLID/solid_principles.md) | SOLID Principles | Module-by-module mapping of all five SOLID principles to source files |
| [`07_Design_Patterns/`](07_Design_Patterns/design_patterns.md) | Design Patterns | Repository, Outbox, State Machine, Strategy, Producer-Consumer |
| [`08_Scalability_Reliability/`](08_Scalability_Reliability/scalability_and_load_testing.md) | Load Test Report | Locust 10k CCU benchmark template with invariant audit section |
| [`09_Security_Observability/`](09_Security_Observability/security_and_observability.md) | Security & Observability | SQL injection prevention, tamper detection, Pino structured logging, health probes |
| [`10_ADR/`](10_ADR/) | Architecture Decision Records | ADR-001 through ADR-004 with context, decision, rationale, and trade-offs |
| [`11_AI_Assisted_Validation/`](11_AI_Assisted_Validation/ai_usage_log.md) | AI Usage Log | Prompt-by-prompt log of AI assistance, bugs surfaced, changes applied |
| [`12_Presentation/`](12_Presentation/hackathon_pitch.md) | Hackathon Pitch | Presentation deck and architectural highlights summary |

---

## ⚙️ Environment Variables

Copy `.env.example` and adjust as needed:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | API server port |
| `DB_HOST` | `mysql` | MySQL hostname (Docker service name) |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `flash` | MySQL username |
| `DB_PASSWORD` | `flash123` | MySQL password |
| `DB_NAME` | `flash_sale` | MySQL database name |
| `DB_POOL_SIZE` | `50` | MySQL connection pool size |
| `REDIS_URL` | `redis://redis:6379` | Redis connection URL |
| `RESERVATION_TTL_SECONDS` | `30` | Reservation expiry window |
| `LOG_LEVEL` | `info` | Pino log level (`debug`/`info`/`warn`/`error`) |
| `USE_REDIS_GATE` | `false` | Enable Redis fast-reject gate before MySQL |
| `NODE_ENV` | `development` | Disables simulation headers when set to `production` |

---

## 🔐 Security Notes

- **SQL Injection**: 100% parameterized queries via `mysql2/promise` prepared statement placeholders. No string concatenation. All numeric IDs cast with `parseInt(..., 10)` and validated with `Number.isFinite()`.
- **Idempotency Tamper Detection**: SHA-256 hash of the canonical (key-sorted) request body is stored alongside the key. Re-submitting a key with a different payload returns `422 IDEMPOTENCY_KEY_REUSED`.
- **Simulation Header Safety**: `X-Simulate-Payment` is a no-op when `NODE_ENV=production`. It cannot be exploited in deployed environments.
- **Reservation TTL Guard**: Even if payment completes after the TTL window, the CAS `WHERE status='PENDING'` guard on Transaction 2 will find `affectedRows=0` (the sweeper already expired it) and abort cleanly — stock is not double-credited.

---

<div align="center">

Built for **SysCrafters 2026** · Powered by **Node.js · MySQL 8 · Redis 7 · BullMQ · Docker**

*10,000 requests. 100 units. Zero oversells.*

</div>
