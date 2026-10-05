# SALESTORM — Simulation Engine Design Document

> **Status:** Active / Implemented (Phase 4)  
> **Reference:** `SALESTORM_SIMULATION_AGENT_INSTRUCTIONS.md` (Section 32)

---

## 1. Purpose
The SALESTORM Simulation Engine provides a lightweight, design-first validation harness to test and demonstrate the core architectural decisions of the flash-sale platform under heavy concurrency.

It serves as evidence for the system design invariants and validates behavior during edge cases such as stock exhaustion, duplicate requests, payment drops, reservation expiry, and temporary downstream outages.

---

## 2. Architecture Under Test
The simulation validates the high-scale e-commerce flash-sale architecture defined across the team roles:
- **System Scope:** 10,000 concurrent purchase attempts competing for 100 available units of `PRODUCT-X`.
- **Primary Invariant:** `successful_reservations <= initial_inventory (100)`.
- **Concurrency & State Control:**
  - Fast-fail atomic stock reservation (`available_quantity >= 0`).
  - Strict idempotency key tracking to avoid double charges.
  - Compensating transactions to release stock when payment fails.
  - Event-driven buffering & retry recovery for temporary order fulfillment downtime.

---

## 3. Subsystem Architecture

```text
                           +--------------------------------+
                           |       Simulation Engine        |
                           +---------------+----------------+
                                           |
                +--------------------------+--------------------------+
                |                          |                          |
                v                          v                          v
      +-------------------+      +-------------------+      +-------------------+
      |  InventoryStore   |      |IdempotencyRegistry|      |ReservationManager |
      | (Atomic Counters) |      | (Key Lock / Cache)|      | (State & TTL Sweep|
      +-------------------+      +-------------------+      +-------------------+
                |                          |                          |
                +--------------------------+--------------------------+
                                           |
                +--------------------------+--------------------------+
                |                                                     |
                v                                                     v
      +-------------------+                                 +-------------------+
      | PaymentSimulator  |                                 |  OrderProcessor   |
      | (Config Outcomes) |                                 | (Retry / Outbox)  |
      +-------------------+                                 +-------------------+
                                           |
                                           v
                             +---------------------------+
                             |     InvariantChecker      |
                             |  (7 Formal Architecture   |
                             |       Invariants)         |
                             +---------------------------+
```

---

## 4. Formal Invariants Checked

| ID | Invariant | Formal Rule | Verification Method |
|---|---|---|---|
| **INV-1** | No Overselling | `reserved + sold <= initial_stock` | Final quantity audit |
| **INV-2** | Non-Negative Inventory | `available >= 0` across all transitions | Full state-transition history log scan |
| **INV-3** | Conservation of Stock | `available + reserved + sold == total` | Checkpoint invariant assertion |
| **INV-4** | Idempotency Protection | `tx <= 1` per unique `idempotency_key` | Transaction log audit |
| **INV-5** | Payment Failure Safety | Failed payment $\Rightarrow$ 0 orders | Payment vs order cross-reference |
| **INV-6** | Reservation Expiry | Expired reservations release stock | Sweeper audit |
| **INV-7** | Order Service Recovery | Downtime buffer is recoverable | DLQ and retry queue audit |

---

## 5. Scope & Limitations
- **Correctness vs Raw Capacity:** Deterministic Mode verifies business invariants, state machines, and concurrency logic. It does not measure physical network bandwidth or distributed database cluster bottlenecks.
- **Hardware Separation:** Measured requests per second (RPS) reflect single-node execution performance; distributed production benchmarking is targeted via Locust Load Generation (Phase 6).
