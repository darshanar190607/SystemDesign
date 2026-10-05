/**
 * SimulationEngine.js
 * 
 * Core deterministic simulation orchestrator for SALESTORM.
 * Simulates high-concurrency purchase attempts without external network dependencies.
 */

import { InventoryStore } from './InventoryStore.js';
import { IdempotencyRegistry } from './IdempotencyRegistry.js';
import { ReservationManager } from './ReservationManager.js';
import { PaymentSimulator } from './PaymentSimulator.js';
import { OrderProcessor } from './OrderProcessor.js';
import { InvariantChecker } from '../validation/InvariantChecker.js';
import { MetricsCollector } from '../validation/MetricsCollector.js';

export class SimulationEngine {
  /**
   * @param {object} config
   * @param {string} [config.productId='PRODUCT-X']
   * @param {number} [config.initialInventory=100]
   * @param {number} [config.virtualUsers=10000]
   * @param {number} [config.paymentSuccessRate=0.95]
   * @param {number} [config.duplicateRate=0.02]
   * @param {number} [config.reservationTtlMs=300000]
   * @param {boolean} [config.orderServiceAvailable=true]
   */
  constructor(config = {}) {
    this.productId = config.productId || 'PRODUCT-X';
    this.initialInventory = config.initialInventory ?? 100;
    this.virtualUsers = config.virtualUsers ?? 10000;
    this.paymentSuccessRate = config.paymentSuccessRate ?? 0.95;
    this.duplicateRate = config.duplicateRate ?? 0.02;
    this.reservationTtlMs = config.reservationTtlMs ?? 300000;
    this.orderServiceAvailable = config.orderServiceAvailable ?? true;

    // Subsystems
    this.inventoryStore = new InventoryStore(this.productId, this.initialInventory);
    this.idempotencyRegistry = new IdempotencyRegistry();
    this.reservationManager = new ReservationManager(this.inventoryStore, this.reservationTtlMs);
    this.paymentSimulator = new PaymentSimulator({ successRate: this.paymentSuccessRate });
    this.orderProcessor = new OrderProcessor({ isServiceAvailable: this.orderServiceAvailable });
    this.metricsCollector = new MetricsCollector();

    // Transactions log
    this.transactions = [];
  }

  /**
   * Runs the complete simulation.
   * @param {string} scenarioName 
   */
  async run(scenarioName = 'Flash Sale 10k') {
    this.metricsCollector.start();
    const runId = `RUN_${Date.now()}`;
    const keyPool = [];

    // Pre-generate requests or run concurrent loop
    for (let i = 0; i < this.virtualUsers; i++) {
      const t0 = performance.now();
      const userId = `USER_${(i + 1).toString().padStart(6, '0')}`;
      const requestId = `REQ_${runId}_${i + 1}`;
      
      // Determine if this request reuses an idempotency key (duplicate simulation)
      let idempotencyKey;
      const isDuplicateAttempt = (keyPool.length > 0 && Math.random() < this.duplicateRate);
      
      if (isDuplicateAttempt) {
        idempotencyKey = keyPool[Math.floor(Math.random() * keyPool.length)];
      } else {
        idempotencyKey = `IDEMP_${runId}_${i + 1}`;
        keyPool.push(idempotencyKey);
      }

      const txRecord = {
        runId,
        virtualUserId: userId,
        requestId,
        idempotencyKey,
        isDuplicateAttempt,
        reservationId: null,
        status: 'PENDING',
        reservationStatus: null,
        paymentStatus: null,
        orderCreated: false,
        latencyMs: 0
      };

      // 1. Check Idempotency
      const idempCheck = this.idempotencyRegistry.checkAndAcquire(idempotencyKey);
      if (idempCheck.isDuplicate) {
        txRecord.status = 'DUPLICATE_DETECTED';
        txRecord.reservationStatus = 'CACHED_RESULT';
        this.transactions.push(txRecord);
        this.metricsCollector.recordLatency(performance.now() - t0);
        continue;
      }

      // 2. Attempt Reservation
      const reservationId = `RES_${runId}_${i + 1}`;
      txRecord.reservationId = reservationId;

      const resResult = this.reservationManager.createReservation(
        reservationId,
        userId,
        this.productId,
        1
      );

      if (!resResult.success) {
        txRecord.status = 'RESERVATION_FAILED';
        txRecord.reservationStatus = resResult.reason;
        this.idempotencyRegistry.finalize(idempotencyKey, 'FAILED', { reason: resResult.reason });
        this.transactions.push(txRecord);
        this.metricsCollector.recordLatency(performance.now() - t0);
        continue;
      }

      txRecord.reservationStatus = 'RESERVED';

      // 3. Process Payment
      const paymentId = `PAY_${runId}_${i + 1}`;
      const payResult = await this.paymentSimulator.processPayment(paymentId, reservationId, 100);
      txRecord.paymentStatus = payResult.status;

      if (payResult.status === 'SUCCESS') {
        // Confirm reservation
        this.reservationManager.confirmReservation(reservationId);

        // 4. Create Order
        const orderId = `ORD_${runId}_${i + 1}`;
        const orderResult = this.orderProcessor.createOrder(orderId, userId, reservationId, 100);

        txRecord.status = 'SUCCESS';
        txRecord.orderCreated = orderResult.success;
        txRecord.orderStatus = orderResult.status;

        this.idempotencyRegistry.finalize(idempotencyKey, 'SUCCESS', { orderId, reservationId });
      } else {
        // Payment failed or timed out -> Compensating transaction (Release stock)
        this.reservationManager.releaseReservation(reservationId, payResult.status);
        txRecord.status = 'PAYMENT_FAILED';
        this.idempotencyRegistry.finalize(idempotencyKey, 'FAILED', { reason: payResult.status });
      }

      txRecord.latencyMs = performance.now() - t0;
      this.metricsCollector.recordLatency(txRecord.latencyMs);
      this.transactions.push(txRecord);
    }

    this.metricsCollector.stop();

    // Invariant Verification
    const invariantResult = InvariantChecker.evaluate({
      inventoryStore: this.inventoryStore,
      idempotencyRegistry: this.idempotencyRegistry,
      reservationManager: this.reservationManager,
      orderProcessor: this.orderProcessor,
      initialInventory: this.initialInventory,
      transactions: this.transactions
    });

    // Business Stats Aggregation
    const businessStats = {
      scenario: scenarioName,
      initialInventory: this.initialInventory,
      virtualUsers: this.virtualUsers,
      totalPurchaseAttempts: this.transactions.length,
      successfulReservations: this.transactions.filter(t => t.reservationStatus === 'RESERVED').length,
      failedReservationsOutOfStock: this.transactions.filter(t => t.reservationStatus === 'OUT_OF_STOCK').length,
      duplicateRequestsDetected: this.transactions.filter(t => t.status === 'DUPLICATE_DETECTED').length,
      paymentSuccesses: this.transactions.filter(t => t.paymentStatus === 'SUCCESS').length,
      paymentFailures: this.transactions.filter(t => t.paymentStatus === 'FAILURE' || t.paymentStatus === 'TIMEOUT').length,
      ordersCreated: this.transactions.filter(t => t.orderCreated).length,
      finalInventory: {
        available: this.inventoryStore.availableQuantity,
        reserved: this.inventoryStore.reservedQuantity,
        sold: this.inventoryStore.soldQuantity,
        total: this.inventoryStore.totalQuantity
      },
      oversoldUnits: Math.max(0, (this.inventoryStore.soldQuantity + this.inventoryStore.reservedQuantity) - this.initialInventory),
      invariantsVerdict: invariantResult.allPassed ? 'PASS' : 'FAIL',
      invariantChecks: invariantResult.checks
    };

    const metricsSummary = this.metricsCollector.getSummary(businessStats);

    return {
      runId,
      scenario: scenarioName,
      ...metricsSummary,
      invariantResult
    };
  }
}
