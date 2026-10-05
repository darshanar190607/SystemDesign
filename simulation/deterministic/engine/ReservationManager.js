/**
 * ReservationManager.js
 * 
 * Coordinates reservation lifecycle and state transitions:
 *  - PENDING_PAYMENT -> CONFIRMED (on payment success)
 *  - PENDING_PAYMENT -> RELEASED (on payment failure or user cancel)
 *  - PENDING_PAYMENT -> EXPIRED (when reservation TTL elapsed)
 */

export class ReservationManager {
  /**
   * @param {import('./InventoryStore.js').InventoryStore} inventoryStore 
   * @param {number} defaultTtlMs 
   */
  constructor(inventoryStore, defaultTtlMs = 300000) {
    this.inventoryStore = inventoryStore;
    this.defaultTtlMs = defaultTtlMs;
    /** @type {Map<string, { reservationId: string, userId: string, productId: string, quantity: number, status: string, expiresAt: number, createdAt: number }>} */
    this.reservations = new Map();
  }

  /**
   * Creates a new stock reservation.
   * @param {string} reservationId 
   * @param {string} userId 
   * @param {string} productId 
   * @param {number} quantity 
   * @param {number} customTtlMs 
   */
  createReservation(reservationId, userId, productId, quantity = 1, customTtlMs = null) {
    const ttl = customTtlMs ?? this.defaultTtlMs;
    const reserveResult = this.inventoryStore.reserve(quantity);

    if (!reserveResult.success) {
      return {
        success: false,
        reason: reserveResult.reason,
        reservation: null
      };
    }

    const reservation = {
      reservationId,
      userId,
      productId,
      quantity,
      status: 'PENDING_PAYMENT',
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl
    };

    this.reservations.set(reservationId, reservation);

    return {
      success: true,
      reservation
    };
  }

  /**
   * Confirms reservation upon successful payment.
   * @param {string} reservationId 
   */
  confirmReservation(reservationId) {
    const res = this.reservations.get(reservationId);
    if (!res) {
      return { success: false, reason: 'RESERVATION_NOT_FOUND' };
    }

    if (res.status !== 'PENDING_PAYMENT') {
      return { success: false, reason: `INVALID_STATE_${res.status}` };
    }

    // Commit inventory to sold
    const commitResult = this.inventoryStore.commit(res.quantity);
    if (!commitResult.success) {
      return { success: false, reason: commitResult.reason };
    }

    res.status = 'CONFIRMED';
    res.confirmedAt = Date.now();

    return { success: true, reservation: res };
  }

  /**
   * Cancels and releases reservation due to payment failure or explicit cancel.
   * @param {string} reservationId 
   * @param {string} reason 
   */
  releaseReservation(reservationId, reason = 'PAYMENT_FAILED') {
    const res = this.reservations.get(reservationId);
    if (!res) {
      return { success: false, reason: 'RESERVATION_NOT_FOUND' };
    }

    if (res.status !== 'PENDING_PAYMENT') {
      return { success: false, reason: `ALREADY_${res.status}` };
    }

    this.inventoryStore.release(res.quantity, reason);
    res.status = 'RELEASED';
    res.releasedReason = reason;
    res.releasedAt = Date.now();

    return { success: true, reservation: res };
  }

  /**
   * Scans and expires reservations whose TTL has passed.
   * @param {number} currentTime 
   */
  sweepExpiredReservations(currentTime = Date.now()) {
    let expiredCount = 0;
    for (const res of this.reservations.values()) {
      if (res.status === 'PENDING_PAYMENT' && res.expiresAt <= currentTime) {
        this.inventoryStore.release(res.quantity, 'TTL_EXPIRED');
        res.status = 'EXPIRED';
        res.expiredAt = currentTime;
        expiredCount++;
      }
    }
    return expiredCount;
  }
}
