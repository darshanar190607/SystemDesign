/**
 * TS005_ReservationExpiry.js
 * 
 * Scenario: Reservation Expiry TTL
 * Verifies that reservations not paid within the TTL window are swept
 * and their reserved stock is safely returned to the available inventory pool.
 */

import { InventoryStore } from '../engine/InventoryStore.js';
import { ReservationManager } from '../engine/ReservationManager.js';
import { InvariantChecker } from '../validation/InvariantChecker.js';
import { IdempotencyRegistry } from '../engine/IdempotencyRegistry.js';
import { OrderProcessor } from '../engine/OrderProcessor.js';

export async function runTS005() {
  console.log('\n========================================');
  console.log('RUNNING TS-005: Reservation Expiry TTL');
  console.log('Stock: 10 | 10 Reservations created with 50ms TTL');
  console.log('========================================');

  const store = new InventoryStore('PRODUCT-TTL', 10);
  const resManager = new ReservationManager(store, 50); // 50ms TTL
  const idempRegistry = new IdempotencyRegistry();
  const orderProcessor = new OrderProcessor();

  // Create 10 reservations
  for (let i = 1; i <= 10; i++) {
    resManager.createReservation(`RES_${i}`, `USER_${i}`, 'PRODUCT-TTL', 1);
  }

  console.log(`Stock after reservations -> Available: ${store.availableQuantity}, Reserved: ${store.reservedQuantity}`);

  // Wait for TTL expiry
  await new Promise(resolve => setTimeout(resolve, 80));

  // Sweep expired reservations
  const expiredCount = resManager.sweepExpiredReservations();
  console.log(`Swept Expired Reservations: ${expiredCount}`);
  console.log(`Stock after sweep -> Available: ${store.availableQuantity}, Reserved: ${store.reservedQuantity}`);

  const evaluation = InvariantChecker.evaluate({
    inventoryStore: store,
    idempotencyRegistry: idempRegistry,
    reservationManager: resManager,
    orderProcessor: orderProcessor,
    initialInventory: 10,
    transactions: []
  });

  console.log(`Invariants Passed: ${evaluation.allPassed ? '✅ ALL PASSED' : '❌ FAIL'}`);

  return {
    scenario: 'TS-005 Reservation Expiry',
    expiredCount,
    availableStockRestored: store.availableQuantity === 10,
    invariantsPassed: evaluation.allPassed
  };
}

if (process.argv[1]?.endsWith('TS005_ReservationExpiry.js')) {
  runTS005();
}
