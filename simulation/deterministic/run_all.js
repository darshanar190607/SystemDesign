/**
 * run_all.js
 * 
 * Deterministic Test Suite Runner.
 * Executes TS-001 through TS-006 and verifies complete architectural invariant compliance.
 */

import { runTS001 } from './scenarios/TS001_LastItem.js';
import { runTS002 } from './scenarios/TS002_FlashSale10k.js';
import { runTS003 } from './scenarios/TS003_DuplicateRequest.js';
import { runTS004 } from './scenarios/TS004_PaymentFailure.js';
import { runTS005 } from './scenarios/TS005_ReservationExpiry.js';
import { runTS006 } from './scenarios/TS006_OrderRecovery.js';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║       SALESTORM — DETERMINISTIC SIMULATION & VALIDATION SUITE    ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  const startTime = Date.now();
  const summary = [];

  try {
    const res1 = await runTS001();
    summary.push({ id: 'TS-001', name: 'Last Item Concurrency (1 unit, 2 users)', pass: res1.invariantResult.allPassed });

    const res2 = await runTS002();
    summary.push({ id: 'TS-002', name: 'Flash Sale (100 units, 10k users)', pass: res2.invariantResult.allPassed });

    const res3 = await runTS003();
    summary.push({ id: 'TS-003', name: 'Duplicate Request Idempotency', pass: res3.invariantResult.allPassed });

    const res4 = await runTS004();
    summary.push({ id: 'TS-004', name: 'Payment Failure Compensation', pass: res4.invariantResult.allPassed });

    const res5 = await runTS005();
    summary.push({ id: 'TS-005', name: 'Reservation Expiry TTL', pass: res5.invariantsPassed });

    const res6 = await runTS006();
    summary.push({ id: 'TS-006', name: 'Order Service Failure & Recovery', pass: res6.invariantsPassed });

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n======================================================================');
    console.log('                   DETERMINISTIC SUITE SUMMARY REPORT                 ');
    console.log('======================================================================');
    summary.forEach(item => {
      console.log(`${item.pass ? '✅ [PASS]' : '❌ [FAIL]'} ${item.id}: ${item.name}`);
    });
    console.log('----------------------------------------------------------------------');
    console.log(`Total Scenarios: ${summary.length} | Passed: ${summary.filter(s => s.pass).length} | Failed: ${summary.filter(s => !s.pass).length}`);
    console.log(`Execution Time: ${totalDuration}s`);
    console.log('======================================================================\n');

    const allPassed = summary.every(s => s.pass);
    if (!allPassed) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during simulation execution:', err);
    process.exit(1);
  }
}

main();
