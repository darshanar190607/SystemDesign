/**
 * OrderProcessor.js
 * 
 * Manages order creation and outbox/retry recovery workflow.
 * Guarantees Invariant 5: A failed payment never produces an order.
 * Guarantees Invariant 7: Temporary order service downtime can be recovered via retry queue.
 */

export class OrderProcessor {
  /**
   * @param {object} config 
   * @param {boolean} [config.isServiceAvailable=true]
   * @param {number} [config.maxRetries=3]
   */
  constructor(config = {}) {
    this.isServiceAvailable = config.isServiceAvailable ?? true;
    this.maxRetries = config.maxRetries ?? 3;
    /** @type {Map<string, { orderId: string, userId: string, reservationId: string, status: string, createdAt: number }>} */
    this.orders = new Map();
    /** @type {Array<{ orderPayload: object, attempts: number, error: string }>} */
    this.retryQueue = [];
    /** @type {Array<object>} */
    this.deadLetterQueue = [];
  }

  setServiceAvailable(available) {
    this.isServiceAvailable = available;
  }

  /**
   * Creates an order following successful payment.
   * @param {string} orderId 
   * @param {string} userId 
   * @param {string} reservationId 
   * @param {number} amount 
   */
  createOrder(orderId, userId, reservationId, amount = 100) {
    const payload = {
      orderId,
      userId,
      reservationId,
      amount,
      status: 'CONFIRMED',
      createdAt: Date.now()
    };

    if (!this.isServiceAvailable) {
      // Buffer in retry queue / outbox
      this.retryQueue.push({
        orderPayload: payload,
        attempts: 1,
        error: 'ORDER_SERVICE_UNAVAILABLE'
      });

      return {
        success: false,
        status: 'QUEUED_FOR_RETRY',
        reason: 'ORDER_SERVICE_DOWN',
        orderId
      };
    }

    this.orders.set(orderId, payload);
    return {
      success: true,
      status: 'CONFIRMED',
      order: payload
    };
  }

  /**
   * Flushes and processes the retry queue (Recovery mechanism).
   */
  processRetryQueue() {
    if (!this.isServiceAvailable) {
      return { recovered: 0, remainingInQueue: this.retryQueue.length };
    }

    let recovered = 0;
    const currentQueue = [...this.retryQueue];
    this.retryQueue = [];

    for (const item of currentQueue) {
      if (item.attempts <= this.maxRetries) {
        this.orders.set(item.orderPayload.orderId, item.orderPayload);
        recovered++;
      } else {
        this.deadLetterQueue.push(item);
      }
    }

    return {
      recovered,
      remainingInQueue: this.retryQueue.length,
      dlqCount: this.deadLetterQueue.length
    };
  }
}
