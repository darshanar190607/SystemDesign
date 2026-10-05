/**
 * PaymentSimulator.js
 * 
 * Simulates 3rd-party Payment Gateway behavior with configurable outcomes.
 * Default: 95% success, 5% failure.
 * Supports: SUCCESS, FAILURE, TIMEOUT.
 */

export class PaymentSimulator {
  /**
   * @param {object} config 
   * @param {number} [config.successRate=0.95] 0.0 to 1.0
   * @param {number} [config.timeoutRate=0.0] 0.0 to 1.0
   * @param {number} [config.baseLatencyMs=10]
   */
  constructor(config = {}) {
    this.successRate = config.successRate ?? 0.95;
    this.timeoutRate = config.timeoutRate ?? 0.0;
    this.baseLatencyMs = config.baseLatencyMs ?? 10;
    this.forcedOutcome = config.forcedOutcome ?? null; // 'SUCCESS' | 'FAILURE' | 'TIMEOUT' | null
    
    this.stats = {
      totalAttempts: 0,
      successCount: 0,
      failureCount: 0,
      timeoutCount: 0
    };
  }

  /**
   * Executes a simulated payment transaction.
   * @param {string} paymentId 
   * @param {string} reservationId 
   * @param {number} amount 
   * @returns {Promise<{ status: 'SUCCESS' | 'FAILURE' | 'TIMEOUT', transactionId: string, latencyMs: number }>}
   */
  async processPayment(paymentId, reservationId, amount = 100) {
    this.stats.totalAttempts++;
    const startTime = Date.now();

    let outcome;
    if (this.forcedOutcome) {
      outcome = this.forcedOutcome;
    } else {
      const rand = Math.random();
      if (rand < this.timeoutRate) {
        outcome = 'TIMEOUT';
      } else if (rand < this.timeoutRate + this.successRate) {
        outcome = 'SUCCESS';
      } else {
        outcome = 'FAILURE';
      }
    }

    if (outcome === 'SUCCESS') {
      this.stats.successCount++;
    } else if (outcome === 'FAILURE') {
      this.stats.failureCount++;
    } else {
      this.stats.timeoutCount++;
    }

    return {
      status: outcome,
      transactionId: `TXN_${paymentId}`,
      reservationId,
      amount,
      latencyMs: this.baseLatencyMs
    };
  }
}
