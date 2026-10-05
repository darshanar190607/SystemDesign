/**
 * IdempotencyRegistry.js
 * 
 * Enforces Invariant 4: For the same idempotency key, successful business transactions <= 1.
 * Prevents double bookings and duplicate reservations when network retries occur.
 */

export class IdempotencyRegistry {
  constructor() {
    /** @type {Map<string, { status: string, response: any, timestamp: number, duplicateCount: number }>} */
    this.records = new Map();
    this.duplicateAttempts = 0;
  }

  /**
   * Checks if an idempotency key exists or registers it in 'IN_FLIGHT' state.
   * @param {string} key 
   * @returns {{ isDuplicate: boolean, cachedRecord?: object }}
   */
  checkAndAcquire(key) {
    if (!key) {
      return { isDuplicate: false };
    }

    if (this.records.has(key)) {
      const record = this.records.get(key);
      record.duplicateCount += 1;
      this.duplicateAttempts += 1;
      return {
        isDuplicate: true,
        cachedRecord: record
      };
    }

    // Register in-flight
    this.records.set(key, {
      status: 'IN_FLIGHT',
      response: null,
      timestamp: Date.now(),
      duplicateCount: 0
    });

    return { isDuplicate: false };
  }

  /**
   * Finalizes the business transaction result for a given idempotency key.
   * @param {string} key 
   * @param {string} status 
   * @param {any} response 
   */
  finalize(key, status, response) {
    if (!key) return;
    const existing = this.records.get(key) || { duplicateCount: 0, timestamp: Date.now() };
    this.records.set(key, {
      ...existing,
      status,
      response,
      finalizedAt: Date.now()
    });
  }

  getStats() {
    let totalKeys = this.records.size;
    let duplicateHits = this.duplicateAttempts;
    return {
      totalUniqueKeys: totalKeys,
      duplicateHits
    };
  }
}
