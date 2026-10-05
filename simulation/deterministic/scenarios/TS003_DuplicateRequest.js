/**
 * TS003_DuplicateRequest.js
 * 
 * Scenario: Duplicate Purchase Request Idempotency
 * Verifies that duplicate requests sharing the same idempotency key
 * result in <= 1 business transaction and return cached responses.
 */

import { SimulationEngine } from '../engine/SimulationEngine.js';

export async function runTS003() {
  console.log('\n========================================');
  console.log('RUNNING TS-003: Duplicate Purchase Request');
  console.log('Verifying Idempotency Key deduplication');
  console.log('========================================');

  const engine = new SimulationEngine({
    productId: 'PRODUCT-IDEMP-TEST',
    initialInventory: 50,
    virtualUsers: 500,
    paymentSuccessRate: 1.0,
    duplicateRate: 0.30 // 30% duplicates
  });

  const result = await engine.run('TS-003 Duplicate Purchase Request');
  console.log(`Total Attempts: ${result.business.totalPurchaseAttempts}`);
  console.log(`Duplicates Detected & Deduplicated: ${result.business.duplicateRequestsDetected}`);
  console.log(`Successful Orders: ${result.business.ordersCreated}`);
  console.log(`Invariants Passed: ${result.invariantResult.allPassed ? '✅ ALL PASSED' : '❌ FAIL'}`);

  return result;
}

if (process.argv[1]?.endsWith('TS003_DuplicateRequest.js')) {
  runTS003();
}
