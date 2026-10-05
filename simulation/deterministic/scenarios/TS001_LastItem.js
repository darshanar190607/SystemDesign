/**
 * TS001_LastItem.js
 * 
 * Scenario: Last Item Concurrency
 * Initial Stock: 1 unit
 * Concurrent attempts: 2 users
 * Expected: Exactly 1 reservation success, 1 rejection, 0 overselling.
 */

import { SimulationEngine } from '../engine/SimulationEngine.js';

export async function runTS001() {
  console.log('\n========================================');
  console.log('RUNNING TS-001: Last Item Concurrency');
  console.log('Stock: 1 | Users: 2');
  console.log('========================================');

  const engine = new SimulationEngine({
    productId: 'PRODUCT-LAST-1',
    initialInventory: 1,
    virtualUsers: 2,
    paymentSuccessRate: 1.0,
    duplicateRate: 0.0
  });

  const result = await engine.run('TS-001 Last Item Concurrency');
  console.log(`Duration: ${result.performance.durationSeconds}s | RPS: ${result.performance.requestsPerSecond}`);
  console.log(`Successful Reservations: ${result.business.successfulReservations}`);
  console.log(`Failed (Out of stock): ${result.business.failedReservationsOutOfStock}`);
  console.log(`Orders Created: ${result.business.ordersCreated}`);
  console.log(`Oversold Units: ${result.business.oversoldUnits}`);
  console.log(`Invariants Passed: ${result.invariantResult.allPassed ? '✅ YES' : '❌ NO'}`);

  return result;
}

if (process.argv[1]?.endsWith('TS001_LastItem.js')) {
  runTS001();
}
