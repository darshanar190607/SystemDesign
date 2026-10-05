/**
 * TS006_OrderRecovery.js
 * 
 * Scenario: Order Service Temporary Downtime & Retry Recovery
 * Simulates Order Service downtime during successful payments, buffering into retry queue,
 * then restoring the service and processing the queue to full consistency.
 */

import { OrderProcessor } from '../engine/OrderProcessor.js';
import { InventoryStore } from '../engine/InventoryStore.js';
import { IdempotencyRegistry } from '../engine/IdempotencyRegistry.js';
import { ReservationManager } from '../engine/ReservationManager.js';
import { InvariantChecker } from '../validation/InvariantChecker.js';

export async function runTS006() {
  console.log('\n========================================');
  console.log('RUNNING TS-006: Order Service Temporary Failure');
  console.log('Simulating service outage & retry recovery');
  console.log('========================================');

  const store = new InventoryStore('PRODUCT-RECOVERY', 5);
  const idemp = new IdempotencyRegistry();
  const resManager = new ReservationManager(store);
  const orderProcessor = new OrderProcessor({ isServiceAvailable: false }); // Service DOWN

  // Attempt to create 5 orders while service is DOWN
  console.log('1. Attempting 5 orders while Order Service is DOWN:');
  for (let i = 1; i <= 5; i++) {
    const res = orderProcessor.createOrder(`ORD_${i}`, `USER_${i}`, `RES_${i}`, 100);
    console.log(`   Order ORD_${i} -> Status: ${res.status}`);
  }

  console.log(`2. Queue status: ${orderProcessor.retryQueue.length} items buffered in retry queue.`);
  console.log(`   Orders committed to database: ${orderProcessor.orders.size}`);

  // Bring Order Service back online
  console.log('3. Bringing Order Service back ONLINE...');
  orderProcessor.setServiceAvailable(true);

  // Trigger Recovery
  const recoveryResult = orderProcessor.processRetryQueue();
  console.log(`4. Recovery executed: ${recoveryResult.recovered} orders successfully recovered and committed.`);
  console.log(`   Orders in database: ${orderProcessor.orders.size}, DLQ: ${recoveryResult.dlqCount}`);

  const evaluation = InvariantChecker.evaluate({
    inventoryStore: store,
    idempotencyRegistry: idemp,
    reservationManager: resManager,
    orderProcessor: orderProcessor,
    initialInventory: 5,
    transactions: []
  });

  console.log(`Invariants Passed: ${evaluation.allPassed ? '✅ ALL PASSED' : '❌ FAIL'}`);

  return {
    scenario: 'TS-006 Order Recovery',
    buffered: 5,
    recovered: recoveryResult.recovered,
    finalOrders: orderProcessor.orders.size,
    invariantsPassed: evaluation.allPassed
  };
}

if (process.argv[1]?.endsWith('TS006_OrderRecovery.js')) {
  runTS006();
}
