/**
 * TS002_FlashSale10k.js
 * 
 * Scenario: Flash Sale 10k Concurrency
 * Initial Stock: 100 units
 * Concurrent attempts: 10,000 users
 * Expected: Successful reservations <= 100, out of stock failures = 9,900, oversold = 0.
 */

import { SimulationEngine } from '../engine/SimulationEngine.js';

export async function runTS002() {
  console.log('\n========================================');
  console.log('RUNNING TS-002: Flash Sale 10k Concurrency');
  console.log('Stock: 100 | Users: 10,000');
  console.log('========================================');

  const engine = new SimulationEngine({
    productId: 'PRODUCT-FLASH-100',
    initialInventory: 100,
    virtualUsers: 10000,
    paymentSuccessRate: 0.95,
    duplicateRate: 0.02
  });

  const result = await engine.run('TS-002 Flash Sale 10k');
  console.log(`Duration: ${result.performance.durationSeconds}s | RPS: ${result.performance.requestsPerSecond}`);
  console.log(`Latency - Avg: ${result.performance.latency.avgMs}ms | p50: ${result.performance.latency.p50Ms}ms | p95: ${result.performance.latency.p95Ms}ms | p99: ${result.performance.latency.p99Ms}ms`);
  console.log(`Successful Reservations: ${result.business.successfulReservations}`);
  console.log(`Failed (Out of Stock): ${result.business.failedReservationsOutOfStock}`);
  console.log(`Duplicates Handled: ${result.business.duplicateRequestsDetected}`);
  console.log(`Payment Successes: ${result.business.paymentSuccesses}`);
  console.log(`Payment Failures: ${result.business.paymentFailures}`);
  console.log(`Orders Created: ${result.business.ordersCreated}`);
  console.log(`Oversold Units: ${result.business.oversoldUnits}`);
  console.log(`Final Available Stock: ${result.business.finalInventory.available}`);
  console.log(`Invariants Passed: ${result.invariantResult.allPassed ? '✅ ALL PASSED' : '❌ FAIL'}`);

  return result;
}

if (process.argv[1]?.endsWith('TS002_FlashSale10k.js')) {
  runTS002();
}
