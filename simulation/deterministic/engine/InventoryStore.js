/**
 * InventoryStore.js
 * 
 * Manages atomic inventory state for flash-sale products.
 * Guarantees Invariants:
 *  - available_quantity >= 0
 *  - available_quantity + reserved_quantity + sold_quantity === total_quantity
 *  - No overselling under high concurrency
 */

export class InventoryStore {
  /**
   * @param {string} productId 
   * @param {number} totalQuantity 
   */
  constructor(productId, totalQuantity) {
    this.productId = productId;
    this.totalQuantity = totalQuantity;
    this.availableQuantity = totalQuantity;
    this.reservedQuantity = 0;
    this.soldQuantity = 0;
    
    // History log of state transitions for invariant verification
    this.history = [this.getSnapshot('INITIAL_STATE')];
  }

  getSnapshot(reason = 'CHECKPOINT') {
    return {
      timestamp: Date.now(),
      reason,
      totalQuantity: this.totalQuantity,
      availableQuantity: this.availableQuantity,
      reservedQuantity: this.reservedQuantity,
      soldQuantity: this.soldQuantity,
      isValid: (this.availableQuantity + this.reservedQuantity + this.soldQuantity === this.totalQuantity) &&
               (this.availableQuantity >= 0)
    };
  }

  /**
   * Atomically reserves stock for a product.
   * Equivalent to atomic Redis Lua script `if redis.call('get', key) >= qty then ...`
   * @param {number} quantity 
   * @returns {{ success: boolean, reason?: string, snapshot: object }}
   */
  reserve(quantity = 1) {
    if (quantity <= 0) {
      return { success: false, reason: 'INVALID_QUANTITY', snapshot: this.getSnapshot('REJECT_INVALID_QTY') };
    }

    if (this.availableQuantity < quantity) {
      return { success: false, reason: 'OUT_OF_STOCK', snapshot: this.getSnapshot('REJECT_OUT_OF_STOCK') };
    }

    // Atomic state update
    this.availableQuantity -= quantity;
    this.reservedQuantity += quantity;

    const snapshot = this.getSnapshot(`RESERVED_${quantity}`);
    this.history.push(snapshot);

    return {
      success: true,
      snapshot
    };
  }

  /**
   * Confirms payment and permanently converts reserved stock into sold stock.
   * @param {number} quantity 
   * @returns {{ success: boolean, reason?: string, snapshot: object }}
   */
  commit(quantity = 1) {
    if (this.reservedQuantity < quantity) {
      return { success: false, reason: 'INSUFFICIENT_RESERVED_STOCK', snapshot: this.getSnapshot('REJECT_COMMIT') };
    }

    this.reservedQuantity -= quantity;
    this.soldQuantity += quantity;

    const snapshot = this.getSnapshot(`SOLD_${quantity}`);
    this.history.push(snapshot);

    return {
      success: true,
      snapshot
    };
  }

  /**
   * Releases reserved stock back to available pool (compensation on payment fail or TTL expiry).
   * @param {number} quantity 
   * @param {string} reason 
   * @returns {{ success: boolean, reason?: string, snapshot: object }}
   */
  release(quantity = 1, reason = 'PAYMENT_FAILED') {
    if (this.reservedQuantity < quantity) {
      return { success: false, reason: 'INSUFFICIENT_RESERVED_STOCK', snapshot: this.getSnapshot('REJECT_RELEASE') };
    }

    this.reservedQuantity -= quantity;
    this.availableQuantity += quantity;

    const snapshot = this.getSnapshot(`RELEASED_${reason}`);
    this.history.push(snapshot);

    return {
      success: true,
      snapshot
    };
  }
}
