/**
 * run_staged_tests.js
 * 
 * Executes the official staged validation progression:
 *  - Stage 1: Functional (2 users, 2 units)
 *  - Stage 2: Concurrency Correctness (2 users, 1 unit)
 *  - Stage 3: Moderate Load (100 users, 20 units)
 *  - Stage 4: Larger Load (1,000 users, 100 units)
 *  - Stage 5: Required Scenario (10,000 users, 100 units)
 * 
 * Persists machine-readable results to results/sample/
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SimulationEngine } from './engine/SimulationEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RESULTS_DIR = path.join(__dirname, '../../results/sample');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

async function runStagedProgression() {
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║       SALESTORM — OFFICIAL 5-STAGE ARCHITECTURE VALIDATION SUITE         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  const stages = [
    {
      id: 'stage1_functional',
      name: 'Stage 1 — Functional Baseline',
      users: 2,
      stock: 2,
      payRate: 1.0,
      dupRate: 0.0
    },
    {
      id: 'stage2_concurrency',
      name: 'Stage 2 — Concurrency Correctness (Smallest Test)',
      users: 2,
      stock: 1,
      payRate: 1.0,
      dupRate: 0.0
    },
    {
      id: 'stage3_moderate',
      name: 'Stage 3 — Moderate Load',
      users: 100,
      stock: 20,
      payRate: 0.95,
      dupRate: 0.05
    },
    {
      id: 'stage4_large',
      name: 'Stage 4 — Large Load',
      users: 1000,
      stock: 100,
      payRate: 0.95,
      dupRate: 0.02
    },
    {
      id: 'stage5_flash_sale_10k',
      name: 'Stage 5 — Official Flash Sale Scenario (10,000 vs 100)',
      users: 10000,
      stock: 100,
      payRate: 0.95,
      dupRate: 0.02
    }
  ];

  const overallResults = [];

  for (const stage of stages) {
    console.log(`▶ Executing: ${stage.name}`);
    console.log(`  Parameters: ${stage.users.toLocaleString()} Users | ${stage.stock.toLocaleString()} Units | Pay Success: ${(stage.payRate * 100)}% | Dups: ${(stage.dupRate * 100)}%`);

    const engine = new SimulationEngine({
      productId: `PROD_${stage.id.toUpperCase()}`,
      initialInventory: stage.stock,
      virtualUsers: stage.users,
      paymentSuccessRate: stage.payRate,
      duplicateRate: stage.dupRate
    });

    const result = await engine.run(stage.name);

    // Save sample result JSON
    const resultFilePath = path.join(RESULTS_DIR, `${stage.id}.json`);
    fs.writeFileSync(resultFilePath, JSON.stringify(result, null, 2), 'utf-8');

    console.log(`  ⏱️  Duration: ${result.performance.durationSeconds}s | RPS: ${result.performance.requestsPerSecond.toLocaleString()} | Avg Latency: ${result.performance.latency.avgMs}ms`);
    console.log(`  📦 Business: ${result.business.ordersCreated} Orders Confirmed | ${result.business.oversoldUnits} Oversold Units`);
    console.log(`  🛡️  Invariants: ${result.invariantResult.allPassed ? '✅ [PASS] ALL INVARIANTS SATISFIED' : '❌ [FAIL] VIOLATION'}\n`);

    overallResults.push({
      id: stage.id,
      name: stage.name,
      users: stage.users,
      stock: stage.stock,
      duration: result.performance.durationSeconds,
      rps: result.performance.requestsPerSecond,
      orders: result.business.ordersCreated,
      oversold: result.business.oversoldUnits,
      invariantsPass: result.invariantResult.allPassed,
      jsonFile: `${stage.id}.json`
    });
  }

  // Save overall summary index
  const summaryFilePath = path.join(RESULTS_DIR, 'summary_index.json');
  fs.writeFileSync(summaryFilePath, JSON.stringify({
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    },
    stages: overallResults
  }, null, 2), 'utf-8');

  console.log('======================================================================');
  console.log('                5-STAGE STAGED PROGRESSION SUMMARY                    ');
  console.log('======================================================================');
  overallResults.forEach(r => {
    console.log(`${r.invariantsPass ? '✅' : '❌'} ${r.name}: ${r.users} users -> ${r.orders} orders | ${r.oversold} oversold | ${r.rps.toLocaleString()} RPS`);
  });
  console.log('======================================================================');
  console.log(`All sample result artifacts written to: ${RESULTS_DIR}`);
  console.log('======================================================================\n');
}

runStagedProgression();
