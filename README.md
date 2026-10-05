# SALESTORM — High-Scale Flash-Sale Architecture Simulation & Validation Harness

[![License: MIT](https://img.shields.io/badge/License-MIT-indigo.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v22.14-green.svg)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-3.10-blue.svg)](https://python.org)
[![Aesthetics](https://img.shields.io/badge/UI-Dark%20Mode%20Only-purple.svg)]()

> **SysCrafters 2026 Hackathon Prototype**  
> AI-assisted, design-first validation harness for testing and demonstrating the **SALESTORM** flash-sale architecture under 10,000 concurrent purchase attempts for 100 available units.

---

## ⚡ Quick Start

### 1. Launch Web Dashboard & API Server
```bash
npm run start:server
```
Visit the dark-mode interactive dashboard:
👉 **[http://localhost:8000](http://localhost:8000)**

### 2. Run All Deterministic Scenario Tests (TS-001 to TS-006)
```bash
npm run test:deterministic
```

### 3. Run Official 5-Stage Load Progression
```bash
node simulation/deterministic/run_staged_tests.js
```

### 4. Run Connected HTTP API Load Test
```bash
npm run test:load
```

---

## 🛡️ The 7 Core Architectural Invariants Verified

| ID | Invariant Name | Rule | Status |
|---|---|---|---|
| **INV-1** | **No Overselling** | $\text{Reserved} + \text{Sold} \le \text{Initial Stock}$ | ✅ Verified (0 oversold) |
| **INV-2** | **Non-Negative Inventory** | $\text{Available} \ge 0$ at all transition states | ✅ Verified |
| **INV-3** | **Conservation Accounting** | $\text{Available} + \text{Reserved} + \text{Sold} \equiv \text{Total}$ | ✅ Verified |
| **INV-4** | **Idempotency Protection** | $\le 1$ successful transaction per idempotency key | ✅ Verified |
| **INV-5** | **Payment Failure Safety** | Failed payment $\Rightarrow 0$ orders; releases stock | ✅ Verified |
| **INV-6** | **Reservation Expiry TTL** | Expired reservations are swept & returned to pool | ✅ Verified |
| **INV-7** | **Order Service Recovery** | Outages buffer to retry queue; zero DLQ drops | ✅ Verified |

---

## 📂 Documentation Directory

- [`docs/SIMULATION_DESIGN.md`](docs/SIMULATION_DESIGN.md) — Comprehensive simulation architecture and subsystems.
- [`docs/TEST_SCENARIOS.md`](docs/TEST_SCENARIOS.md) — Detailed catalog of all 6 test scenarios (TS-001 to TS-006).
- [`docs/SIMULATION_SOURCE_MAP.md`](docs/SIMULATION_SOURCE_MAP.md) — Contract mapping linking simulation features to student owner roles.
- `docs/Requirements.docx` — Team requirements specification document.

---

## 🏗️ Repository Architecture

```text
├── docs/                      # Architectural & validation documentation
├── results/
│   ├── sample/                # Staged run JSON output artifacts
│   └── schemas/               # Result JSON Schema specification
├── simulation/
│   ├── api/                   # REST Data Plane service handlers
│   ├── deterministic/         # In-memory concurrency validation engine
│   │   ├── engine/            # InventoryStore, Idempotency, Reservation, Payment, Order
│   │   ├── scenarios/         # TS-001 to TS-006 test scripts
│   │   └── validation/        # InvariantChecker & MetricsCollector
│   ├── locust/                # Locust virtual user definitions & load runners
│   ├── postman/               # Postman collection for API smoke testing
│   ├── server/                # Unified HTTP server (Port 8000)
│   └── web/public/            # Dark-mode web dashboard (HTML/CSS/JS)
├── package.json
└── README.md
```
