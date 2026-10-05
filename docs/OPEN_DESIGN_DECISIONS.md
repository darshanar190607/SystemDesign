# SALESTORM — Open Design Decisions & Gap Register

> **Document Status:** Initialized (Phase 3)  
> **Reference:** `SALESTORM_SIMULATION_AGENT_INSTRUCTIONS.md`  
> **Rule:** Do NOT silently invent architecture decisions. Record all unconfirmed requirements or missing specifications here for review by the responsible team student owner.

---

## 1. Summary of Repository Inspection (Phase 1)

During Phase 1 repository inspection, the workspace was checked for team design artifacts (`01_Requirements/`, `02_HLD/`, `03_LLD/`, `04_Database/`, `05_API/`, `08_Scalability_Reliability/`, etc.).

Currently:
- The team design markdown/diagram files are being developed by the respective student owners.
- The simulation harness establishes baseline assumptions directly from `SALESTORM_SIMULATION_AGENT_INSTRUCTIONS.md` (Sections 1, 6, 7, 11, 12, 26, 27).
- Any deviations or team updates will be reconciled through this register.

---

## 2. Open Design Decisions Table

| Decision ID | Area | Student Owner | Summary of Issue / Question | Proposed Baseline for Simulation Engine | Status |
|---|---|---|---|---|---|
| **ODD-001** | API Endpoint Naming | Student 3 (Data/API) | Standard path for flash sale buy/reservation API endpoint. | Default to `POST /api/v1/reservations` with payload `{"productId": "...", "userId": "...", "quantity": 1}` and header `X-Idempotency-Key`. | **PROPOSED** |
| **ODD-002** | Reservation Expiry TTL | Student 2 & 4 | Expiry duration for reserved inventory before payment confirmation. | Default TTL: `300 seconds` (5 minutes). Automated background sweeper / timer marks expired reservations as `RELEASED`. | **PROPOSED** |
| **ODD-003** | Concurrency Strategy | Student 4 (Reliability) | Mechanism for inventory reservation under 10k load. | Redis atomic Lua script / single-threaded decrement (`DECRBY` / CAS with bounds check `qty >= 0`), backed by MySQL row-level transactional checks for Connected API Mode. | **PROPOSED** |
| **ODD-004** | Payment Gateway Timeout Handling | Student 2 & 4 | Timeout threshold and fallback state when payment provider does not respond within deadline. | Default payment timeout: `3000ms`. Outcome: Trigger reverse compensation / reservation cancellation (`PAYMENT_TIMEOUT`). | **PROPOSED** |
| **ODD-005** | Order Service Failure Recovery | Student 4 (Reliability) | Message broker semantics when Order Service is temporarily unavailable post-payment. | Outbox Pattern / Kafka / RabbitMQ event stream with retry topic + Dead Letter Queue (DLQ), ensuring at-least-once delivery and consumer-side idempotency. | **PROPOSED** |
| **ODD-006** | Simulation Control Plane Port / Security | Student 1 & 4 | Web simulation dashboard port and authentication bounds. | Localhost dev server (e.g., backend `:8000`, frontend `:3000` or unified Vite bundle), input rate limiter, explicit confirmation modal before 10k execution. | **PROPOSED** |

---

## 3. Feedback and Revision Protocol

1. When a student owner finalizes a design document in the repo, update the corresponding `ODD` status to `APPROVED` or `SUPERSEDED`.
2. The simulation engine will automatically sync with approved API contracts and database schema once committed.
