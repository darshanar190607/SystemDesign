# SALESTORM — AI Usage Note

> **Status:** Maintained (Phase 4)  
> **Reference:** `SALESTORM_SIMULATION_AGENT_INSTRUCTIONS.md` (Section 36)

---

## AI Collaboration Log

| Entry ID | AI Tool / Model | Purpose | Generated Artefact | Human / Agent Validation | Changes & Refinements | Owner |
|---|---|---|---|---|---|---|
| **AI-001** | Antigravity AI Assistant | Phase 1–3 Setup | `docs/SIMULATION_SOURCE_MAP.md`, `docs/OPEN_DESIGN_DECISIONS.md` | Verified against instruction requirements | Mapped all 10 simulation concerns to student roles | Student 1 & 4 |
| **AI-002** | Antigravity AI Assistant | Phase 4 Deterministic Engine | `simulation/deterministic/engine/*`, `simulation/deterministic/validation/*` | Executed end-to-end suite with 10k users | Confirmed 0 overselling, non-negative inventory, idempotency | Student 4 (Reliability) |
| **AI-003** | Antigravity AI Assistant | Phase 4 Test Scenarios & Design Docs | `simulation/deterministic/scenarios/TS*.js`, `docs/SIMULATION_DESIGN.md`, `docs/TEST_SCENARIOS.md` | Executed TS-001 through TS-006 test suite (`node simulation/deterministic/run_all.js`) | Validated all 6 scenarios returned PASS | Student 4 (Reliability) |
| **AI-004** | Antigravity AI Assistant | Phase 5 Connected API Mode & Data Plane | `simulation/api/dataPlaneRoutes.js`, `simulation/server/server.js` | Tested REST endpoints, concurrency, and audit endpoint | Verified Invariant validation across HTTP API boundary | Student 3 (Data/API) |
| **AI-005** | Antigravity AI Assistant | Phase 6 Locust Load Generator & Postman | `simulation/locust/locustfile.py`, `simulation/locust/run_load_test.py`, `simulation/postman/*` | Executed concurrent HTTP burst (500 users / 50 workers) | Measured 769 RPS with 100% invariant compliance | Student 4 (Reliability) |
