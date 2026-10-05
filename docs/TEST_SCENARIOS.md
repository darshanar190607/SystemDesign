# SALESTORM — Test Scenarios Specification

> **Status:** Implemented & Verified (Phase 4)  
> **Reference:** `SALESTORM_SIMULATION_AGENT_INSTRUCTIONS.md` (Section 33)

---

## Scenario Catalog

### TS-001: Last Item Concurrency
- **ID:** `TS-001`
- **Purpose:** Smallest useful concurrency test. Verifies race condition safety when demand exceeds stock by 2x on the final remaining item.
- **Initial State:** `Stock: 1`
- **Configuration:** `Users: 2`, `Duplicate Rate: 0%`, `Payment Success Rate: 100%`
- **Expected Result:** Exactly 1 reservation success, 1 rejection (`OUT_OF_STOCK`), 0 overselling.
- **Observed Result:** 1 success, 1 rejection, 0 oversold.
- **Verdict:** `PASS`

---

### TS-002: Flash Sale 100 Units / 10,000 Attempts
- **ID:** `TS-002`
- **Purpose:** Primary hackathon scenario. Simulates extreme 100x demand spike on flash sale product.
- **Initial State:** `Stock: 100`
- **Configuration:** `Users: 10,000`, `Duplicate Rate: 2%`, `Payment Success Rate: 95%`
- **Expected Result:**
  - Reservations created $\le 100$
  - Out of stock failures $\approx 9,900$
  - Failed payments release stock which gets acquired by subsequent requests
  - Final confirmed orders $\le 100$
  - Oversold units $= 0$
  - Non-negative inventory throughout
- **Observed Result:** 10,000 attempts processed, 0 oversold units, all 7 invariants passed.
- **Verdict:** `PASS`

---

### TS-003: Duplicate Purchase Request (Idempotency)
- **ID:** `TS-003`
- **Purpose:** Verifies that network retries or double clicks sharing the same `idempotency_key` never produce duplicate orders or double reservations.
- **Initial State:** `Stock: 50`
- **Configuration:** `Users: 500`, `Duplicate Rate: 30%`
- **Expected Result:** Cached responses returned for all duplicate keys; at most 1 order per unique key.
- **Observed Result:** 162 duplicate requests intercepted and safely deduplicated.
- **Verdict:** `PASS`

---

### TS-004: Payment Failure & Compensation
- **ID:** `TS-004`
- **Purpose:** Verifies that when a payment gateway drops or rejects a transaction, reserved inventory is safely restored to the available pool.
- **Initial State:** `Stock: 20`
- **Configuration:** `Users: 20`, `Payment Success Rate: 50%`
- **Expected Result:** Failed payments produce 0 confirmed orders; reserved inventory is released back to available pool.
- **Observed Result:** 8 failed payments successfully triggered compensation; 8 units restored to available stock.
- **Verdict:** `PASS`

---

### TS-005: Reservation Expiry TTL
- **ID:** `TS-005`
- **Purpose:** Verifies that uncompleted reservations past their TTL window are reclaimed by background sweeper.
- **Initial State:** `Stock: 10`
- **Configuration:** `10 reservations created with 50ms TTL`, swept after 80ms.
- **Expected Result:** All 10 expired reservations swept; available inventory restored to 10.
- **Observed Result:** 10 reservations swept; available stock fully restored.
- **Verdict:** `PASS`

---

### TS-006: Order Service Temporary Failure & Retry Recovery
- **ID:** `TS-006`
- **Purpose:** Verifies system resilience during downstream Order Service outages post-payment.
- **Initial State:** `Stock: 5`
- **Configuration:** `5 orders generated during Order Service outage`, followed by service restoration and retry flush.
- **Expected Result:** Orders buffered without data loss; retry queue flushes to database with 0 duplicates and 0 DLQ entries.
- **Observed Result:** 5 buffered orders successfully recovered and committed upon service restoration.
- **Verdict:** `PASS`
