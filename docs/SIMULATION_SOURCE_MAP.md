# SALESTORM — Simulation Source Map

> **Document Status:** Baseline Initialized (Phase 1 & Phase 2)  
> **Reference:** `SALESTORM_SIMULATION_AGENT_INSTRUCTIONS.md`  
> **Repository Owner:** SysCrafters 2026 Team (Students 1, 2, 3, 4)

---

## 1. Purpose & Pre-Coding Mapping

This document maps every simulation behavior, contract, and invariant directly to the designated source-of-truth ownership as defined in the team collaboration contract.

The simulation acts as a **consumer and validator** of the architecture. It does not invent or redefine architecture decisions.

---

## 2. Team Ownership & Artifact Map

| Simulation Concern | Owning Role | Source-of-Truth Artifact | Current Repo Status | Simulation Operational Mode |
|---|---|---|---|---|
| **System Context & Scope** | Student 1 (System Architect) | `01_Requirements/`, `02_HLD/` | Pending team upload | Bounded to 10,000 requests vs 100 units flash-sale scope |
| **Service Boundaries & Topology** | Student 1 (System Architect) | Container & Deployment Diagrams, ADRs | Pending team upload | Decoupled Control Plane vs Data Plane |
| **Purchase & Reservation Sequence** | Student 2 (LLD & Design) | Purchase/Reservation Sequence Diagram | Inferred from Instructions (`Section 6, 10`) | Buy Now → Reserve → Pay → Order Workflow |
| **State Machine & Lifecycle** | Student 2 (LLD & Design) | Order / Reservation State Diagrams | Inferred from Instructions (`Section 12, 26, 27`) | `RESERVED`, `PAYMENT_PENDING`, `CONFIRMED`, `RELEASED`, `EXPIRED`, `FAILED` |
| **Database Schema & Inventory Accounting** | Student 3 (Data / API / Events) | Database / ER Diagram (`04_Database/`) | Pending schema file | Invariant: `available + reserved + sold = total` (100 units) |
| **API Request / Response Contracts** | Student 3 (Data / API / Events) | OpenAPI / Swagger Specification (`05_API/`) | Pending OpenAPI spec | REST contracts with Idempotency Key header |
| **Domain Events & Message Broker Contracts** | Student 3 (Data / API / Events) | Event Specification | Pending event spec | At-least-once with correlation ID & idempotency key |
| **Concurrency & Lock Strategy** | Student 4 (Reliability Engineer) | Concurrency Design (`08_Scalability_Reliability/`) | Inferred from Instructions (`Section 1, 12`) | Atomic reservation preventing overselling (`available >= 0`) |
| **Failure & Recovery Workflows** | Student 4 (Reliability Engineer) | Failure / Recovery Matrix | Inferred from Instructions (`Section 25, 26, 27`) | Payment failure compensation & Order service retry/DLQ |
| **Observability & Telemetry** | Student 4 (Reliability Engineer) | Observability Design (`09_Security_Observability/`) | Inferred from Instructions (`Section 28`) | Structured JSON logs (`run_id`, `request_id`, `correlation_id`, `latency`) |

---

## 3. Detailed Contract Mapping

### 3.1 Purchase & Reservation Lifecycle
- **Virtual User Actions:**
  1. Generate unique `idempotency_key`, `request_id`, `virtual_user_id`.
  2. Issue reservation request for `PRODUCT-X`.
  3. If reservation succeeds: proceed to payment checkout simulation.
  4. If payment succeeds: trigger order confirmation.
  5. If payment fails / times out: trigger reservation release (compensating transaction).
  6. If out-of-stock / rejected: record immediate fast-fail response.

### 3.2 Inventory Concurrency Model
- **Initial Inventory:** 100 units.
- **Concurrent Attempts:** 10,000 requests.
- **Invariant Rules:**
  - `successful_reservations <= 100`
  - `available_quantity >= 0` at all timestamps.
  - `duplicate_business_transactions <= 1` per idempotency key.

### 3.3 Simulation Control Plane vs Data Plane Separation
- **Simulation Control Plane:** Controls load runs, test presets, collects telemetry, executes verification invariants.
- **SALESTORM Data Plane:** Handles incoming buy requests, atomic stock reservation, payment verification, order fulfillment.

---

## 4. Gaps and Verification Checklist
Any unconfirmed schema details or endpoint URI variations are documented in [OPEN_DESIGN_DECISIONS.md](file:///e:/System%20Design%20Hackathon/docs/OPEN_DESIGN_DECISIONS.md) to ensure team alignment before production integration.
