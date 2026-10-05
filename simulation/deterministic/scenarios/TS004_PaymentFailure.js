/**
 * TS004_PaymentFailure.js
 * 
 * Scenario: Payment Failure and Stock Compensation
 * Verifies that when a payment fails, the reservation is released back to available stock
 * and no confirmed order is created for that transaction.
 */

import { SimulationEngine } from '../engine/SimulationEngine.js';

export async function runTS004() {
  console.log('\n========================================');
  console.log('RUNNING TS-004: Payment Failure & Compensation');
  console.log('Stock: 20 | Users: 20 | Payment Success: 50%');
  console.log('========================================');

  const engine = new SimulationEngine({
    productId: 'PRODUCT-PAY-FAIL',
    initialInventory: 20,
    virtualUsers: 20,
    paymentSuccessRate: 0.50, // 50% fail
    duplicateRate: 0.0
  });

  const result = await engine.run('TS-004 Payment Failure');
  console.log(`Successful Reservations: ${result.business.successfulReservations}`);
  console.log(`Payment Successes: ${result.business.paymentSuccesses}`);
  console.log(`Payment Failures: ${result.business.paymentFailures}`);
  console.log(`Orders Created: ${result.business.ordersCreated}`);
  console.log(`Final Available Stock (after compensation): ${result.business.finalInventory.available}`);
  console.log(`Invariants Passed: ${result.invariantResult.allPassed ? '✅ ALL PASSED' : '❌ FAIL'}`);

  return result;
}

if (process.argv[1]?.endsWith('TS004_PaymentFailure.js')) {
  runTS004();
}
