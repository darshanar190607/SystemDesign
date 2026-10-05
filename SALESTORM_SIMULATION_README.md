# SALESTORM Simulation

AI-assisted simulation and validation dashboard for the **SALESTORM
high-scale e-commerce flash-sale architecture**.

The purpose of this project is to demonstrate and validate the
architecture using controlled simulations rather than claiming that a
local prototype represents production-scale capacity.

## 1. Problem

SALESTORM models a flash-sale scenario where a very large number of
users attempt to purchase a limited quantity of products at nearly the
same time.

Primary validation scenario:

-   **10,000 concurrent purchase attempts**
-   **100 available units**
-   No overselling
-   Duplicate requests must not create duplicate business transactions
-   Payment failures must be handled safely
-   Temporary service failures must support the approved recovery
    strategy

## 2. Goals

This simulation helps the team:

-   Validate concurrency and inventory-reservation logic
-   Test idempotency and duplicate-request handling
-   Validate payment success/failure flows
-   Test reservation expiry and inventory release
-   Exercise failure and recovery scenarios
-   Measure latency and throughput in the available environment
-   Produce evidence for the final hackathon presentation
-   Identify architecture issues that should be fed back into the
    HLD/LLD/ADR

> **Important:** The simulation tests the architecture. It does not
> define or replace the architecture.

## 3. Team Ownership

The simulation consumes the team's approved design documents.

  ------------------------------------------------------------------------
  Student                 Responsibility          Simulation Dependency
  ----------------------- ----------------------- ------------------------
  Student 1               System Architecture     HLD, service boundaries,
                                                  deployment assumptions

  Student 2               LLD & Design            Purchase/payment/order
                                                  sequences, state
                                                  diagrams, patterns

  Student 3               Data & API              Database schema, APIs,
                                                  events and contracts

  Student 4               Reliability             Concurrency,
                                                  scalability, failures,
                                                  recovery, security,
                                                  observability
  ------------------------------------------------------------------------

The simulation must not silently create competing service boundaries,
APIs, database models, or recovery rules.

If a required design decision is missing, record it in:

`docs/OPEN_DESIGN_DECISIONS.md`

## 4. Simulation Modes

### Connected API Mode

The simulation sends requests to the approved SALESTORM APIs and
measures the behavior of the actual prototype/services.

### Deterministic Simulation Mode

Used when the complete backend is not available.

It models the approved business rules for:

-   Inventory
-   Reservation
-   Idempotency
-   Payment
-   Order creation
-   Reservation expiry
-   Failure/recovery

This mode is useful for validating business invariants without
pretending to measure real distributed-system performance.

## 5. Main Components

``` text
Web Dashboard
      |
      v
Simulation Controller
      |
      +----------------------+
      |                      |
      v                      v
Locust Runner        Deterministic Engine
      |                      |
      +----------+-----------+
                 |
                 v
        SALESTORM APIs
                 |
                 v
        Result Aggregator
                 |
                 v
        Validation Engine
                 |
                 v
             Dashboard
```

## 6. Main Test Scenarios

  -----------------------------------------------------------------------
  ID                      Scenario                Expected Result
  ----------------------- ----------------------- -----------------------
  TS-001                  Last Item Concurrency   1 unit → at most 1
                                                  successful reservation

  TS-002                  Flash Sale 100 / 10,000 Successful
                                                  reservations/orders
                                                  must not exceed
                                                  available inventory

  TS-003                  Duplicate Purchase      Same idempotency key
                          Request                 must not create
                                                  duplicate transactions

  TS-004                  Payment Failure         Failed payment must not
                                                  create a confirmed/sold
                                                  order

  TS-005                  Reservation Expiry      Expired reservation
                                                  eventually releases
                                                  inventory according to
                                                  the design

  TS-006                  Order Service Temporary Recovery follows the
                          Failure                 approved reliability
                                                  design
  -----------------------------------------------------------------------

## 7. Key Invariants

Every important simulation run should validate:

1.  Successful reserved quantity never exceeds initial inventory.
2.  Available inventory never becomes negative.
3.  Inventory accounting remains consistent where applicable.
4.  The same idempotency key cannot create multiple successful business
    transactions.
5.  A failed payment cannot create a confirmed/sold order.
6.  Expired reservations stop holding inventory according to the
    approved design.
7.  Order-service failure recovery follows the approved design.

## 8. Dashboard

The dashboard should allow configuration of:

-   Product ID
-   Initial inventory
-   Virtual users
-   Requests per user
-   Test duration
-   Ramp-up
-   Payment success percentage
-   Duplicate request percentage
-   Reservation TTL
-   Execution mode
-   Target API URL

Typical flash-sale configuration:

``` text
Product: Product X
Inventory: 100
Virtual Users: 10,000
Payment Success: 95%
Duplicate Requests: 2%
```

## 9. Metrics

The simulation should present both technical and business metrics.

### Load Metrics

-   Virtual users
-   Total requests
-   Requests per second
-   Test duration
-   p50 latency
-   p95 latency
-   p99 latency
-   Maximum latency

### Business Metrics

-   Successful reservations
-   Failed reservations
-   Oversold quantity
-   Duplicate transactions
-   Payment successes
-   Payment failures
-   Orders created
-   Orders failed/recovered
-   Invariant pass/fail

## 10. Suggested Project Structure

``` text
simulation/
├── web/
│   ├── frontend/
│   └── backend/
├── locust/
│   ├── locustfile.py
│   ├── scenarios/
│   └── config/
├── deterministic/
│   ├── engine/
│   ├── scenarios/
│   └── validation/
├── validation/
│   ├── invariants/
│   ├── result_aggregator/
│   └── verdict/
├── postman/
│   └── SALESTORM.postman_collection.json
├── results/
│   ├── sample/
│   └── schemas/
├── docs/
│   ├── SIMULATION_DESIGN.md
│   ├── TEST_SCENARIOS.md
│   ├── VALIDATION_RESULTS.md
│   ├── OPEN_DESIGN_DECISIONS.md
│   ├── SIMULATION_SOURCE_MAP.md
│   └── AI_USAGE_NOTE.md
└── README.md
```

Adapt this structure to the actual team repository rather than creating
duplicate projects.

## 11. Recommended Execution Flow

``` text
1. Inspect approved team designs
        ↓
2. Map simulation requirements to source documents
        ↓
3. Record missing decisions
        ↓
4. Implement deterministic validation
        ↓
5. Implement connected API mode
        ↓
6. Integrate Locust
        ↓
7. Build dashboard
        ↓
8. Run staged tests
        ↓
9. Capture validation evidence
        ↓
10. Feed findings back into architecture/ADR
```

## 12. Load Testing Approach

Do not immediately start with 10,000 users.

Recommended progression:

``` text
1–2 users
   ↓
2 users / 1 inventory unit
   ↓
100 users
   ↓
1,000 users
   ↓
10,000 users
```

This helps identify correctness problems before increasing load.

If the environment cannot actually generate or sustain a claimed
production throughput, report the **measured result** and clearly
distinguish it from the production target.

## 13. Simulation vs Production

This project is a hackathon validation prototype.

It should **not** claim:

-   Production-grade capacity from a laptop run
-   Real-world 500,000 requests/sec unless actually measured in an
    appropriate environment
-   Production reliability based only on deterministic simulation
-   That mocked components behave exactly like external production
    systems

Instead, report:

-   Configuration used
-   Environment used
-   Measured results
-   Known limitations
-   Architecture conclusions

## 14. Documentation

The simulation should maintain the following documents:

-   `SIMULATION_DESIGN.md` --- simulation architecture and component
    responsibilities
-   `TEST_SCENARIOS.md` --- scenarios, inputs and expected outcomes
-   `VALIDATION_RESULTS.md` --- actual test evidence and conclusions
-   `OPEN_DESIGN_DECISIONS.md` --- unresolved architecture questions
-   `SIMULATION_SOURCE_MAP.md` --- mapping between simulation behavior
    and approved team designs
-   `AI_USAGE_NOTE.md` --- AI tools/prompts used and how generated
    output was validated

## 15. Safety and Security

The simulation is intended for controlled development/testing
environments.

Important safeguards:

-   Keep secrets in environment variables.
-   Do not execute arbitrary shell commands from the web dashboard.
-   Restrict configurable target hosts where appropriate.
-   Add limits for maximum users, duration and ramp-up.
-   Require deliberate confirmation before very large test runs.
-   Keep failure injection deterministic and visible.

## 16. Final Demonstration

The target demonstration should show:

``` text
10,000 purchase attempts
        ↓
Concurrency-safe reservation
        ↓
≤ 100 successful reservations
        ↓
Payment handling
        ↓
Payment failures release/stop inventory according to design
        ↓
Valid orders
        ↓
No duplicate transactions
        ↓
Failure + recovery scenario
        ↓
Measured validation results
```

The final result should make it easy for reviewers to connect:

**Architecture → Design Decision → Simulation → Evidence → Conclusion**

## 17. Source of Truth

Before implementing or changing simulation behavior, check the team's
approved:

-   HLD
-   LLD diagrams
-   Database/ER design
-   OpenAPI specification
-   Event specification
-   Scalability/reliability design
-   Security/observability design
-   ADRs

When sources conflict or a required decision is absent, document the
issue instead of silently inventing a new design.

------------------------------------------------------------------------

**SALESTORM principle:**\
**Architecture comes first. Simulation validates the architecture.
Evidence drives refinement.**
