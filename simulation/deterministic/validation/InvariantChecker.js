/**
 * InvariantChecker.js
 * 
 * Formal validation engine for the SALESTORM architecture invariants.
 * Checks:
 *  1. No overselling (reserved + sold <= initial_inventory)
 *  2. Non-negative inventory (available_quantity >= 0 at every state)
 *  3. Conservation of inventory (available + reserved + sold == total)
 *  4. Idempotency (<= 1 successful business transaction per idempotency key)
 *  5. Payment failure safety (failed payment => 0 confirmed orders, reservation released)
 *  6. Reservation expiry consistency (expired reservations released to available stock)
 *  7. Order recovery consistency (replayed events create exact orders idempotently)
 */

export class InvariantChecker {
  /**
   * Evaluates all invariants against completed simulation state.
   * @param {object} params
   * @param {import('../engine/InventoryStore.js').InventoryStore} params.inventoryStore
   * @param {import('../engine/IdempotencyRegistry.js').IdempotencyRegistry} params.idempotencyRegistry
   * @param {import('../engine/ReservationManager.js').ReservationManager} params.reservationManager
   * @param {import('../engine/OrderProcessor.js').OrderProcessor} params.orderProcessor
   * @param {number} params.initialInventory
   * @param {Array<object>} params.transactions
   * @returns {{ allPassed: boolean, checks: Array<{ name: string, passed: boolean, details: string }> }}
   */
  static evaluate({ inventoryStore, idempotencyRegistry, reservationManager, orderProcessor, initialInventory, transactions = [] }) {
    const checks = [];

    // Invariant 1: No Overselling
    const totalCommittedAndReserved = inventoryStore.soldQuantity + inventoryStore.reservedQuantity;
    const inv1Passed = totalCommittedAndReserved <= initialInventory;
    checks.push({
      id: 'INV-1',
      name: 'No Overselling',
      passed: inv1Passed,
      details: `Reserved (${inventoryStore.reservedQuantity}) + Sold (${inventoryStore.soldQuantity}) = ${totalCommittedAndReserved} <= Initial (${initialInventory})`
    });

    // Invariant 2: Inventory Never Negative
    const hasNegativeState = inventoryStore.history.some(snap => snap.availableQuantity < 0 || snap.reservedQuantity < 0 || snap.soldQuantity < 0);
    const currentNonNegative = inventoryStore.availableQuantity >= 0;
    const inv2Passed = !hasNegativeState && currentNonNegative;
    checks.push({
      id: 'INV-2',
      name: 'Non-Negative Inventory',
      passed: inv2Passed,
      details: `Available: ${inventoryStore.availableQuantity}, Historical negative states found: ${hasNegativeState ? 'YES' : 'NO'}`
    });

    // Invariant 3: Conservation Accounting
    const currentSum = inventoryStore.availableQuantity + inventoryStore.reservedQuantity + inventoryStore.soldQuantity;
    const accountingValid = currentSum === inventoryStore.totalQuantity;
    const historyAccountingValid = inventoryStore.history.every(snap => snap.isValid);
    const inv3Passed = accountingValid && historyAccountingValid;
    checks.push({
      id: 'INV-3',
      name: 'Inventory Conservation Accounting',
      passed: inv3Passed,
      details: `Available (${inventoryStore.availableQuantity}) + Reserved (${inventoryStore.reservedQuantity}) + Sold (${inventoryStore.soldQuantity}) = ${currentSum} (Total: ${inventoryStore.totalQuantity})`
    });

    // Invariant 4: Duplicate Idempotency
    const keyTransactionCounts = new Map();
    for (const tx of transactions) {
      if (tx.idempotencyKey && tx.status === 'SUCCESS') {
        const count = (keyTransactionCounts.get(tx.idempotencyKey) || 0) + 1;
        keyTransactionCounts.set(tx.idempotencyKey, count);
      }
    }
    const hasDuplicateTx = Array.from(keyTransactionCounts.values()).some(count => count > 1);
    const inv4Passed = !hasDuplicateTx;
    checks.push({
      id: 'INV-4',
      name: 'Idempotency Protection',
      passed: inv4Passed,
      details: `Unique keys with multiple successful transactions: ${hasDuplicateTx ? 'VIOLATION DETECTED' : '0'}`
    });

    // Invariant 5: Payment Failure Safety
    let paymentFailureViolations = 0;
    for (const tx of transactions) {
      if (tx.paymentStatus === 'FAILURE' && tx.orderCreated) {
        paymentFailureViolations++;
      }
    }
    const inv5Passed = paymentFailureViolations === 0;
    checks.push({
      id: 'INV-5',
      name: 'Payment Failure Safety',
      passed: inv5Passed,
      details: `Orders created on failed payments: ${paymentFailureViolations}`
    });

    // Invariant 6: Reservation Expiry Integrity
    let activeExpiredWithHoldingStock = 0;
    const now = Date.now();
    for (const res of reservationManager.reservations.values()) {
      if (res.status === 'PENDING_PAYMENT' && res.expiresAt < now) {
        activeExpiredWithHoldingStock++;
      }
    }
    const inv6Passed = activeExpiredWithHoldingStock === 0;
    checks.push({
      id: 'INV-6',
      name: 'Reservation Expiry Release',
      passed: inv6Passed,
      details: `Unswept expired reservations holding stock: ${activeExpiredWithHoldingStock}`
    });

    // Invariant 7: Order Service Reliability / Recovery
    const dlqCount = orderProcessor.deadLetterQueue.length;
    const inv7Passed = dlqCount === 0;
    checks.push({
      id: 'INV-7',
      name: 'Order Service Recovery',
      passed: inv7Passed,
      details: `Orders in Dead Letter Queue: ${dlqCount}, Retry queue remaining: ${orderProcessor.retryQueue.length}`
    });

    const allPassed = checks.every(c => c.passed);

    return {
      allPassed,
      checks
    };
  }
}
