# SALESTORM — AI Agent Instruction: Web Simulation & Validation Prototype

> **Purpose:** Build a small, design-first, AI-assisted web prototype that demonstrates and validates the SALESTORM flash-sale architecture described in the team's shared design documents.
>
> **Primary validation scenario:** 10,000 concurrent purchase attempts against only 100 available units.
>
> **Important:** This prototype is evidence for the architecture. It must **not redefine the architecture** and must not become a large e-commerce implementation.

---

# 1. NON-NEGOTIABLE CONTEXT

You are working on the **SALESTORM SYSCRAFTERS 2026 Design-First AI-Assisted System Design Hackathon**.

The official problem is:

- High-scale e-commerce flash sale.
- 10,000 concurrent purchase attempts.
- Only 100 units available.
- Prevent overselling.
- Prevent duplicate reservations/orders.
- Maintain reliable payment and order workflows.
- Demonstrate graceful failure/recovery.
- Use AI only as an accelerator for optional prototype/simulation work.

The hackathon explicitly says the prototype/simulation is **optional, small, targeted, and directly linked to a design assumption or practical scenario**.

Therefore:

> **Do not build a complete e-commerce application. Build a validation harness around the critical architecture decisions.**

The central invariant is:

```text
successful reservations/orders for Product X <= initial inventory

initial inventory = 100
```

The system must never produce:

```text
available_quantity < 0
```

and must not create duplicate successful business transactions for the same idempotency key.

---

# 2. SOURCE OF TRUTH — TEAM COLLABORATION CONTRACT

This repository is shared by four students.

Do NOT invent an alternative architecture inside this prototype.

The prototype must consume the team's already-approved design artefacts.

## Student ownership

### Student 1 — System Architect

Owns:

- Requirements & assumptions
- System Context Diagram
- HLD Architecture
- Container Diagram
- Component Diagram
- Deployment Diagram
- ADR
- Overall architecture integration

### Student 2 — LLD & Design Engineer

Owns:

- Class Diagram
- Purchase / Reservation Sequence Diagram
- Payment Sequence Diagram
- Order Sequence Diagram
- Order / Reservation State Diagram
- SOLID Mapping
- Design Pattern Mapping

### Student 3 — Data / API / Event Engineer

Owns:

- Database / ER Diagram
- API Specification
- Service Integration
- Event Specification
- API request/response contracts
- Event ownership and consumer contracts

### Student 4 — Reliability Engineer

Owns:

- Scalability & Reliability Design
- Security & Observability Design
- Concurrency Design
- Failure / Recovery Scenarios
- Optional AI-assisted simulation evidence

---

# 3. NO REDUNDANCY RULE

The four students must not independently redefine the same design decision.

The prototype agent must follow the same rule.

## Never redefine these inside simulation code

Do not independently choose:

- service boundaries
- database ownership
- API names
- event names
- concurrency strategy
- order states
- reservation states
- payment states
- cache architecture
- deployment topology
- security model

Instead:

1. Read the team's source-of-truth documents.
2. Reuse the approved contracts.
3. If a required decision is missing, **do not silently invent it**.
4. Record the missing decision in `docs/OPEN_DESIGN_DECISIONS.md`.
5. Ask the team/agent owner to resolve it before treating the decision as final.

---

# 4. REQUIRED SOURCE-OF-TRUTH FILES

Before writing implementation code, inspect the repository.

Look for files such as:

```text
README.md

docs/
  requirements/
  architecture/
  hld/
  lld/
  database/
  api/
  events/
  scalability/
  security/
  adr/

01_Requirements/
02_HLD/
03_LLD/
04_Database/
05_API/
06_SOLID/
07_Design_Patterns/
08_Scalability_Reliability/
09_Security_Observability/
10_ADR/
```

The exact paths may differ.

The agent must discover the actual repository structure rather than assuming paths.

---

# 5. REQUIRED PRE-CODING CHECK

Before implementing the simulator, produce a short internal mapping:

| Simulation concern | Source of truth |
|---|---|
| Purchase workflow | Student 2 sequence diagram + Student 3 API specification |
| Inventory fields | Student 3 database design |
| Reservation lifecycle | Student 2 state diagram + Student 3 schema |
| API endpoint | Student 3 OpenAPI specification |
| Events | Student 3 event specification |
| Concurrency mechanism | Student 4 concurrency design |
| Failure cases | Student 4 failure/recovery design |
| Scalability targets | Student 4 scalability design + Student 1 requirements |
| Deployment assumptions | Student 1 deployment diagram |
| Observability | Student 4 observability design |

If any row cannot be mapped to a source-of-truth artefact, flag it.

---

# 6. WHAT THE PROTOTYPE MUST DEMONSTRATE

The web prototype must demonstrate the **critical flash-sale path**, not the entire product catalogue.

Primary flow:

```text
Virtual Customer
      |
      v
Purchase Request
      |
      v
API / Simulation Entry Point
      |
      v
Inventory Check
      |
      v
Inventory Reservation
      |
      +---- success ----> Payment
      |                     |
      |                     +---- success ----> Order
      |                     |
      |                     +---- failure ----> Reservation Release
      |
      +---- out of stock
      |
      +---- duplicate request
      |
      +---- timeout / failure
```

Use the team's actual approved architecture names where they exist.

---

# 7. TWO EXECUTION MODES

Implement two modes if practical.

## Mode A — Connected API Mode

Use this when the team's API/service prototype is available.

The simulation engine sends real HTTP requests to the team's APIs.

The API target must come from the approved OpenAPI/Swagger specification.

Example:

```text
Web Dashboard
     |
     v
Simulation Controller
     |
     v
Locust / Load Runner
     |
     v
SALESTORM API
     |
     v
Actual prototype services
```

Do not hard-code endpoints that contradict the OpenAPI specification.

---

## Mode B — Deterministic Simulation Mode

Use this when the complete backend is not available.

The simulator executes the approved concurrency/business rules in a controlled simulation model.

This mode must still model:

- inventory quantity
- reservation
- idempotency
- reservation expiry
- payment success/failure
- order creation
- failure/retry behaviour

The deterministic simulation is not allowed to claim that it proves production performance.

It only validates business invariants and failure behaviour.

---

# 8. VIRTUAL USER / LOAD GENERATION

Use **Locust as the preferred virtual-user generator** because it is suitable for programmable user behaviour and can be integrated with a web-based control/monitoring workflow.

The project may additionally support:

- JMeter
- Postman Collection Runner

Do not build three separate simulation systems.

## Preferred architecture

```text
                    +----------------------+
                    | Simulation Web UI    |
                    |----------------------|
                    | Configure scenario   |
                    | Start / stop run     |
                    | Live metrics         |
                    | Results / verdict    |
                    +----------+-----------+
                               |
                               v
                    +----------------------+
                    | Simulation Controller|
                    +----------+-----------+
                               |
                  +------------+-------------+
                  |                          |
                  v                          v
          Deterministic Model          Locust Runner
                  |                          |
                  |                          v
                  |                    SALESTORM API
                  |                          |
                  +------------+-------------+
                               |
                               v
                       Result Aggregator
                               |
                               v
                        Validation Engine
                               |
                               v
                         Dashboard Results
```

---

# 9. WEB DASHBOARD REQUIREMENTS

Build a simple professional dashboard.

Do not spend time on visual polish before correctness.

## Page sections

### A. Scenario Configuration

Allow the user to configure:

```text
Product ID
Initial Inventory
Virtual Users
Requests per User
Test Duration
Ramp-up Duration
Payment Success Rate
Duplicate Request Rate
Reservation TTL
Execution Mode
Target API Base URL
```

Defaults:

```text
Product: PRODUCT-X
Initial Inventory: 100
Virtual Users: 10,000
Payment Success Rate: 95%
Duplicate Request Rate: 2%
```

Do not silently change these values.

---

### B. Test Presets

Provide presets:

#### Preset 1 — Last Item

```text
Initial stock = 1
Concurrent purchase attempts = 2
Expected successful reservations = 1
Expected overselling = 0
```

#### Preset 2 — Flash Sale

```text
Initial stock = 100
Concurrent purchase attempts = 10,000
Expected successful reservations <= 100
Expected overselling = 0
```

#### Preset 3 — Duplicate Request

```text
Same idempotency key submitted multiple times
Expected successful business transaction = 1
```

#### Preset 4 — Payment Failure

```text
Reservation succeeds
Payment fails
Reservation is released
No confirmed order for failed payment
```

#### Preset 5 — Order Service Failure

```text
Payment succeeds
Order service temporarily unavailable
Recovery mechanism executes
Final state must be explainable according to the approved failure design
```

Only implement scenarios that match the team's approved design.

---

# 10. VIRTUAL USER BEHAVIOUR

A virtual customer should execute the business workflow rather than simply spam one endpoint.

Preferred workflow:

```text
1. Create/authenticate customer if required
2. Discover/select Product X
3. Generate unique idempotency key
4. Submit Buy Now / reservation request
5. Record response
6. If reservation succeeds:
     attempt checkout/payment
7. If payment succeeds:
     observe/order confirmation
8. If payment fails:
     verify reservation release
9. Record final outcome
```

Where APIs do not exist, use the deterministic simulation model.

---

# 11. IDENTITY OF VIRTUAL USERS

Each virtual user needs:

```text
virtual_user_id
request_id
idempotency_key
product_id
timestamp
```

Do not reuse idempotency keys across independent business transactions.

For duplicate-request tests, deliberately reuse the same idempotency key.

---

# 12. REQUIRED INVARIANTS

The validation engine must explicitly check these.

## Invariant 1 — No overselling

```text
successful_reserved_quantity <= initial_inventory
```

For the flash-sale scenario:

```text
successful_reserved_quantity <= 100
```

---

## Invariant 2 — Inventory never negative

At every observed state:

```text
available_quantity >= 0
```

---

## Invariant 3 — Reservation accounting

Where applicable:

```text
available_quantity
+ reserved_quantity
+ sold_quantity
= total_inventory
```

Use the team's database/state model if its accounting differs.

Do not alter the team's approved invariant without recording a design decision.

---

## Invariant 4 — Duplicate idempotency

For the same idempotency key:

```text
successful_business_transactions <= 1
```

---

## Invariant 5 — Payment failure

A failed payment must not produce a confirmed/sold order.

The exact recovery state must follow the approved state diagram.

---

## Invariant 6 — Reservation expiry

Expired reservations must eventually stop holding inventory according to the approved reservation design.

---

## Invariant 7 — Order recovery

If the design supports recovery from temporary Order Service failure:

```text
Payment success
+
temporary order failure
=
recoverable workflow
```

Do not claim "exactly once" unless the architecture explicitly provides and validates it.

Prefer precise language such as:

```text
at-least-once event delivery + idempotent consumer
```

if that is what the design specifies.

---

# 13. REQUIRED TEST OUTPUTS

Every run must produce a machine-readable result.

Example:

```json
{
  "scenario": "flash_sale",
  "initial_inventory": 100,
  "virtual_users": 10000,
  "purchase_attempts": 10000,
  "successful_reservations": 100,
  "failed_reservations": 9900,
  "oversold_units": 0,
  "duplicate_business_transactions": 0,
  "payment_successes": 95,
  "payment_failures": 5,
  "orders_created": 95,
  "invariant_pass": true
}
```

These are example fields only.

Use the actual business states defined by the team's design.

Do not fabricate results.

---

# 14. DASHBOARD RESULTS

Show at minimum:

## Traffic

```text
Virtual Users
Requests Sent
Requests/sec
Test Duration
```

## Latency

```text
Average
P50
P95
P99
Maximum
```

## Business outcomes

```text
Purchase Attempts
Reservation Success
Reservation Failure
Payment Success
Payment Failure
Orders Created
Reservations Released
Duplicates Detected
```

## Correctness

Display clear PASS/FAIL status for:

```text
No Overselling
No Negative Inventory
Idempotency
Reservation Accounting
Payment Failure Recovery
Reservation Expiry
Order Recovery
```

Only display a correctness check if the simulator has actually collected the necessary evidence.

---

# 15. VISUALIZATION

The dashboard should make the flash-sale result obvious.

Include:

1. Inventory lifecycle
2. Successful vs failed purchase attempts
3. Request throughput
4. Latency distribution
5. Reservation outcome
6. Payment outcome
7. Validation checklist

The most important visual:

```text
10,000 purchase attempts
          |
          v
   +---------------+
   | 100 available |
   +---------------+
          |
          v
   Successful <= 100
          |
          v
     Overselling = 0
```

---

# 16. LOAD TEST DESIGN

Do not immediately start with 10,000 users.

Use staged validation.

## Stage 1 — Functional

```text
1–2 users
```

Verify the basic workflow.

## Stage 2 — Concurrency correctness

```text
2 users
1 unit
```

This is the smallest useful concurrency test.

Expected:

```text
one success
one failure
zero overselling
```

## Stage 3 — Moderate load

```text
100 users
10–100 units
```

## Stage 4 — Larger load

```text
1,000 users
100 units
```

## Stage 5 — Required scenario

```text
10,000 concurrent purchase attempts
100 units
```

Do not claim that a single developer laptop has demonstrated production capacity of 10,000 or 500,000 requests/sec.

Separate:

```text
correctness validation
```

from:

```text
performance capacity measurement
```

---

# 17. 500,000 REQUESTS/SECOND

The architecture discusses extreme flash-sale scaling.

The prototype should **not falsely claim** that it has reproduced production-scale 500,000 requests/sec unless the actual environment can support and measure it.

Instead, if infrastructure is insufficient:

```text
Validate the concurrency invariant locally.

Measure the actual achieved throughput.

Explain that production-scale capacity requires distributed load generators and horizontally scaled services.
```

The dashboard should show actual measured values, not theoretical values.

---

# 18. LOCUST INTEGRATION

If Locust is available:

Create a load-test suite such as:

```text
simulation/
  locust/
    locustfile.py
    scenarios/
    config/
```

The Locust users should model the approved purchase workflow.

The simulator must collect:

- request count
- success/failure
- response time
- HTTP status
- business outcome
- idempotency outcome where available

Do not make Locust the business validation engine.

Locust generates traffic.

The **validation engine checks business invariants**.

This separation is important.

---

# 19. OPTIONAL JMeter / POSTMAN SUPPORT

Do not duplicate the entire simulator.

If practical:

### Postman

Maintain a Postman collection generated from the approved OpenAPI specification.

Use it for:

- API smoke tests
- workflow validation
- small functional runs

### JMeter

Use only if the team needs an alternative load-test runner.

The architecture should remain:

```text
Load Generator
      |
      v
SALESTORM API
      |
      v
Result Collector
      |
      v
Validation Engine
```

The load generator is replaceable.

---

# 20. SIMULATION CONTROLLER API

If implementing a backend controller, expose simple endpoints such as:

```text
POST /simulation/runs
GET  /simulation/runs/{runId}
POST /simulation/runs/{runId}/stop
GET  /simulation/runs/{runId}/results
GET  /simulation/runs/{runId}/events
```

Do not create these as part of the SALESTORM business API.

These belong to the **simulation control plane**.

Keep simulation-control APIs separate from SALESTORM production/business APIs.

---

# 21. SIMULATION CONTROL PLANE vs SALESTORM DATA PLANE

This separation is mandatory.

```text
                SIMULATION CONTROL PLANE
                ------------------------
                Web Dashboard
                     |
                     v
              Simulation Controller
                     |
          +----------+----------+
          |                     |
          v                     v
   Locust Runner       Deterministic Model
          |
          v

                SALESTORM DATA PLANE
                --------------------
                API Gateway
                     |
                     v
              SALESTORM Services
                     |
              +------+------+
              |             |
          Database       Message Broker
```

The simulation controller must not become a new business service in the SALESTORM architecture.

---

# 22. DATABASE USE

The team's actual database design is owned by Student 3.

The simulator must not create a second competing data model.

If the prototype connects to MySQL:

- use the approved schema
- use the approved entity names
- use the approved constraints
- use the approved concurrency mechanism
- never bypass inventory consistency rules just to make the test pass

For deterministic simulation mode, use an isolated simulation state store.

Do not modify production-like data.

---

# 23. API CONTRACT

Student 3's OpenAPI specification is the contract.

If the simulator requires an endpoint that does not exist:

1. Do not silently invent one.
2. Add an entry to `docs/OPEN_DESIGN_DECISIONS.md`.
3. Explain why it is needed.
4. Propose the smallest contract addition.
5. Get the API owner to approve it.
6. Then implement.

The simulator must be a **consumer of the API contract**, not the owner of the API contract.

---

# 24. EVENT CONTRACT

Use Student 3's event specification.

For each event consumed by the simulator, record:

```text
event_name
producer
consumer
event_id
correlation_id
idempotency_key
timestamp
payload
```

Only include fields that exist in the approved event contract.

Do not invent production events merely to simplify the simulation.

---

# 25. FAILURE INJECTION

Implement controlled failure scenarios only where they match Student 4's approved failure/recovery design.

Potential controls:

```text
Payment failure %
Order Service unavailable for N seconds
Artificial API latency
Reservation timeout
Duplicate request %
Duplicate event %
```

Failure injection must be:

- deterministic
- configurable
- isolated
- visible in test results

Never make failures random without recording the seed/configuration.

---

# 26. PAYMENT SIMULATION

For prototype purposes, the payment provider may be simulated.

Default scenario:

```text
95% success
5% failure
```

The payment simulator must support:

```text
SUCCESS
FAILURE
TIMEOUT
```

Only implement TIMEOUT recovery if the team's payment design defines the recovery behaviour.

Never store real payment credentials.

---

# 27. ORDER SERVICE FAILURE SCENARIO

The prototype should support the official scenario:

```text
Payment succeeds
        |
        v
Order Service unavailable
        |
        v
Recovery mechanism
        |
        v
Final valid order state
```

The implementation must match Student 4's approved recovery design.

If the design uses:

```text
event persistence
+
retry
+
idempotent order consumer
```

then demonstrate those mechanisms.

If the design uses another mechanism, use that instead.

---

# 28. OBSERVABILITY

The simulation itself must produce structured logs.

Every important request should have:

```text
run_id
virtual_user_id
request_id
correlation_id
idempotency_key
timestamp
operation
result
latency
```

Use correlation IDs to connect:

```text
Purchase
→ Reservation
→ Payment
→ Order
```

Do not log secrets or sensitive payment information.

---

# 29. SECURITY REQUIREMENTS

The simulation dashboard is a developer tool.

Do not expose it as an unrestricted public production dashboard.

At minimum:

- bind safely for local/dev use
- configurable target URL
- validate input
- prevent arbitrary command execution
- do not allow arbitrary shell commands from the browser
- do not store credentials in source code
- use environment variables for secrets
- restrict dangerous load settings if appropriate

---

# 30. SAFETY GUARDS FOR LOAD TESTING

Add configurable limits.

For example:

```text
MAX_VIRTUAL_USERS
MAX_TEST_DURATION
MAX_RAMP_RATE
ALLOWED_TARGET_HOSTS
```

The browser must not be able to launch an unlimited test accidentally.

Show a confirmation before a large run.

For example:

```text
You are about to start:
10,000 virtual users
100 units
Target: <configured environment>

Continue?
```

---

# 31. REPOSITORY STRUCTURE

Use a structure similar to:

```text
simulation/
│
├── web/
│   ├── frontend/
│   └── backend/
│
├── locust/
│   ├── locustfile.py
│   ├── scenarios/
│   └── config/
│
├── deterministic/
│   ├── engine/
│   ├── scenarios/
│   └── validation/
│
├── validation/
│   ├── invariants/
│   ├── result_aggregator/
│   └── verdict/
│
├── postman/
│   └── SALESTORM.postman_collection.json
│
├── results/
│   ├── sample/
│   └── schemas/
│
├── docs/
│   ├── SIMULATION_DESIGN.md
│   ├── TEST_SCENARIOS.md
│   ├── VALIDATION_RESULTS.md
│   └── OPEN_DESIGN_DECISIONS.md
│
└── README.md
```

Adapt the structure to the existing repository instead of creating duplicate top-level projects.

---

# 32. SIMULATION DESIGN DOCUMENT

Create:

```text
docs/SIMULATION_DESIGN.md
```

It must explain:

## Purpose

Why this simulation exists.

## Architecture under test

Reference the team's HLD.

## Scenario

10,000 purchase attempts / 100 units.

## Generator

Locust or selected tool.

## Business model

Only the relevant purchase/reservation/payment/order path.

## Invariants

List the exact correctness checks.

## Metrics

List measured performance and business metrics.

## Limitations

Explicitly state what the prototype does not prove.

---

# 33. TEST SCENARIO DOCUMENT

Create:

```text
docs/TEST_SCENARIOS.md
```

For every scenario:

```text
Scenario ID
Name
Purpose
Initial State
Configuration
Steps
Expected Result
Validation Rules
Observed Result
Pass/Fail
```

Required scenarios:

```text
TS-001 Last Item Concurrency
TS-002 Flash Sale 100 / 10,000
TS-003 Duplicate Purchase Request
TS-004 Payment Failure
TS-005 Reservation Expiry
TS-006 Order Service Temporary Failure
```

Add more only if they are supported by the architecture.

---

# 34. VALIDATION RESULT DOCUMENT

Create:

```text
docs/VALIDATION_RESULTS.md
```

This should contain actual results from executed tests.

Never write fake measurements.

Include:

```text
Environment
Machine
CPU
Memory
Database version
Load generator
Number of users
Duration
Ramp-up
Target endpoint
```

Then:

```text
Requests
Throughput
Latency
Success/failure
Business outcomes
Invariant results
```

---

# 35. FINAL HACKATHON EVIDENCE

The simulation evidence should answer:

> "Your architecture has 100 units remaining and 10,000 customers are simultaneously clicking Buy Now. Walk us through exactly what happens."

The evidence should show:

```text
10,000 attempts
       ↓
Inventory concurrency mechanism
       ↓
At most 100 successful reservations
       ↓
Payment processing
       ↓
Failed payments release inventory
       ↓
Successful payments lead to valid orders
       ↓
No duplicate business transactions
       ↓
No overselling
```

The implementation must be traceable to the architecture diagrams and design decisions.

---

# 36. AI USAGE

AI may be used to accelerate:

- boilerplate
- simulation scripts
- load-test scripts
- test data
- dashboard components
- API clients
- documentation
- validation tests

AI must NOT replace:

- architecture selection
- service boundaries
- concurrency reasoning
- inventory consistency decisions
- payment/order state modelling
- trade-off decisions
- security/reliability decisions

Every generated component must be reviewed and understood.

Maintain:

```text
docs/AI_USAGE_NOTE.md
```

Include:

```text
AI tool
Prompt
Purpose
Generated artefact
Human validation
Changes made
Final owner
```

---

# 37. DO NOT OVER-ENGINEER

Do NOT implement:

- full product catalogue
- real payment integration
- real shipping integration
- real notification provider
- full customer account system
- recommendation engine
- production Kubernetes deployment
- unnecessary microservices
- unnecessary frontend pages
- unrelated business functionality

The simulation exists to validate the architecture.

---

# 38. DEFINITION OF DONE

The prototype is complete only when:

### Architecture consistency

- [ ] Uses approved HLD
- [ ] Uses approved API specification
- [ ] Uses approved database design
- [ ] Uses approved event specification
- [ ] Uses approved concurrency design
- [ ] Uses approved failure/recovery design

### Simulation

- [ ] Web dashboard works
- [ ] Virtual users can be generated
- [ ] Locust integration works where API mode is available
- [ ] Deterministic mode works when backend is unavailable
- [ ] Test scenarios are reproducible
- [ ] Results are persisted

### Correctness

- [ ] No overselling
- [ ] Inventory never negative
- [ ] Duplicate requests are handled correctly
- [ ] Payment failures behave correctly
- [ ] Reservation expiry behaves correctly
- [ ] Order recovery behaves according to design

### Observability

- [ ] Request IDs
- [ ] Correlation IDs
- [ ] Business outcomes
- [ ] Latency
- [ ] Throughput
- [ ] Error metrics

### Documentation

- [ ] Simulation design
- [ ] Test scenarios
- [ ] Validation results
- [ ] Open design decisions
- [ ] AI usage note
- [ ] README instructions

---

# 39. FINAL AGENT WORKFLOW

Follow this exact order.

## Phase 1 — Inspect

1. Inspect repository.
2. Read existing README.
3. Locate architecture/design documents.
4. Locate OpenAPI specification.
5. Locate database schema.
6. Locate event specification.
7. Locate concurrency design.
8. Locate failure/recovery design.

## Phase 2 — Build the contract map

Create:

```text
docs/SIMULATION_SOURCE_MAP.md
```

Map every simulation behaviour to its source-of-truth document.

## Phase 3 — Identify gaps

Create:

```text
docs/OPEN_DESIGN_DECISIONS.md
```

Only record genuine missing/contradictory decisions.

Do not silently resolve architecture conflicts.

## Phase 4 — Implement deterministic validation

Build the smallest correctness model first.

Prove:

```text
1 unit / 2 users
```

Then:

```text
100 units / 10,000 attempts
```

## Phase 5 — Implement API mode

Connect to the team's approved API.

Do not modify business contracts without approval.

## Phase 6 — Integrate Locust

Add virtual-user generation.

Separate:

```text
traffic generation
```

from:

```text
business invariant validation
```

## Phase 7 — Build web dashboard

Add:

- configuration
- run control
- progress
- metrics
- business outcomes
- invariant verdicts

## Phase 8 — Execute staged tests

Run:

```text
1–2 users
2 users / 1 unit
100 users
1,000 users
10,000 users
```

Only report actual measured results.

## Phase 9 — Generate evidence

Produce:

```text
results/
docs/VALIDATION_RESULTS.md
```

## Phase 10 — Architecture feedback

If simulation reveals a design problem:

```text
Simulation result
      ↓
Architecture issue
      ↓
Open design decision / ADR
      ↓
Student owner review
      ↓
Architecture revision
      ↓
Re-run simulation
```

Do NOT patch the simulator to hide a design failure.

---

# 40. FINAL PRINCIPLE

The most important rule for this repository is:

> **The architecture comes first. The simulation tests the architecture. The simulation does not define the architecture.**

The final demonstration must allow the team to show, with actual evidence:

```text
10,000 concurrent purchase attempts
             ↓
       100 units only
             ↓
  concurrency-safe reservation
             ↓
       no overselling
             ↓
      payment handling
             ↓
     order reliability
             ↓
   duplicate protection
             ↓
    failure/recovery
             ↓
       measurable result
```

Every implementation choice must remain traceable to the team's shared design.

**Do not create competing architecture. Do not duplicate another student's responsibility. Do not invent contracts silently. Do not fabricate performance results.**
