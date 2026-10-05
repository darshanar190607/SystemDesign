/**
 * dataPlaneRoutes.js
 * 
 * SALESTORM Data Plane REST API Handlers.
 * Implements approved endpoints for flash-sale transactions:
 *  - POST /api/v1/reservations
 *  - POST /api/v1/payments
 *  - POST /api/v1/orders
 *  - GET  /api/v1/inventory/:productId
 *  - POST /api/v1/inventory/reset
 *  - GET  /api/v1/audit/invariants
 */

import { InventoryStore } from '../deterministic/engine/InventoryStore.js';
import { IdempotencyRegistry } from '../deterministic/engine/IdempotencyRegistry.js';
import { ReservationManager } from '../deterministic/engine/ReservationManager.js';
import { OrderProcessor } from '../deterministic/engine/OrderProcessor.js';
import { InvariantChecker } from '../deterministic/validation/InvariantChecker.js';

export class DataPlaneService {
  constructor(initialStock = 100) {
    this.initialStock = initialStock;
    this.productId = 'PRODUCT-X';
    this.resetState(initialStock);
  }

  resetState(stock = 100) {
    this.initialStock = stock;
    this.inventoryStore = new InventoryStore(this.productId, stock);
    this.idempotencyRegistry = new IdempotencyRegistry();
    this.reservationManager = new ReservationManager(this.inventoryStore);
    this.orderProcessor = new OrderProcessor();
    this.transactions = [];
  }

  handleReservation(body, headers) {
    const idempotencyKey = headers['x-idempotency-key'] || body.idempotencyKey || `IDEMP_AUTO_${Date.now()}_${Math.random()}`;
    const requestId = headers['x-request-id'] || `REQ_${Date.now()}_${Math.random()}`;
    const userId = body.userId || `USER_${Math.floor(Math.random() * 100000)}`;
    const productId = body.productId || this.productId;
    const quantity = body.quantity || 1;

    // 1. Idempotency Check
    const idempCheck = this.idempotencyRegistry.checkAndAcquire(idempotencyKey);
    if (idempCheck.isDuplicate) {
      return {
        statusCode: 200,
        body: {
          status: 'CACHED_RESULT',
          message: 'Duplicate request deduplicated by idempotency filter',
          idempotencyKey,
          data: idempCheck.cachedRecord.response
        }
      };
    }

    // 2. Atomic Reservation
    const reservationId = `RES_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const result = this.reservationManager.createReservation(reservationId, userId, productId, quantity);

    if (!result.success) {
      this.idempotencyRegistry.finalize(idempotencyKey, 'FAILED', { reason: result.reason });
      this.transactions.push({
        requestId,
        idempotencyKey,
        userId,
        status: 'RESERVATION_FAILED',
        reservationStatus: result.reason,
        paymentStatus: null,
        orderCreated: false
      });

      return {
        statusCode: result.reason === 'OUT_OF_STOCK' ? 409 : 400,
        body: {
          status: 'FAILED',
          reason: result.reason,
          message: result.reason === 'OUT_OF_STOCK' ? 'Product is sold out or insufficient stock.' : 'Reservation failed.',
          availableQuantity: this.inventoryStore.availableQuantity
        }
      };
    }

    const responsePayload = {
      reservationId,
      userId,
      productId,
      quantity,
      status: 'RESERVED',
      expiresAt: result.reservation.expiresAt
    };

    this.idempotencyRegistry.finalize(idempotencyKey, 'RESERVED', responsePayload);
    this.transactions.push({
      requestId,
      idempotencyKey,
      userId,
      reservationId,
      status: 'RESERVED',
      reservationStatus: 'RESERVED',
      paymentStatus: null,
      orderCreated: false
    });

    return {
      statusCode: 201,
      body: {
        status: 'SUCCESS',
        data: responsePayload
      }
    };
  }

  handlePayment(body, headers) {
    const { reservationId, amount, forceOutcome } = body;
    const paymentId = `PAY_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const res = this.reservationManager.reservations.get(reservationId);
    if (!res) {
      return {
        statusCode: 404,
        body: { status: 'FAILED', reason: 'RESERVATION_NOT_FOUND' }
      };
    }

    if (res.status !== 'PENDING_PAYMENT') {
      return {
        statusCode: 400,
        body: { status: 'FAILED', reason: `INVALID_STATE_${res.status}` }
      };
    }

    // Determine outcome (default: 95% success unless forced)
    let isSuccess = true;
    if (forceOutcome === 'FAILURE') {
      isSuccess = false;
    } else if (forceOutcome === 'SUCCESS') {
      isSuccess = true;
    } else {
      isSuccess = Math.random() < 0.95;
    }

    if (isSuccess) {
      this.reservationManager.confirmReservation(reservationId);
      const tx = this.transactions.find(t => t.reservationId === reservationId);
      if (tx) tx.paymentStatus = 'SUCCESS';

      return {
        statusCode: 200,
        body: {
          status: 'SUCCESS',
          paymentId,
          reservationId,
          amount: amount || 100,
          transactionStatus: 'COMPLETED'
        }
      };
    } else {
      // Payment failed -> Compensate
      this.reservationManager.releaseReservation(reservationId, 'PAYMENT_FAILED');
      const tx = this.transactions.find(t => t.reservationId === reservationId);
      if (tx) tx.paymentStatus = 'FAILURE';

      return {
        statusCode: 402,
        body: {
          status: 'PAYMENT_FAILED',
          paymentId,
          reservationId,
          reason: 'DECLINED_BY_ISSUER',
          message: 'Payment failed. Reservation has been released.'
        }
      };
    }
  }

  handleOrder(body, headers) {
    const { reservationId, userId } = body;
    const res = this.reservationManager.reservations.get(reservationId);

    if (!res || res.status !== 'CONFIRMED') {
      return {
        statusCode: 400,
        body: {
          status: 'FAILED',
          reason: 'RESERVATION_NOT_CONFIRMED',
          message: 'An order cannot be created without a confirmed, paid reservation.'
        }
      };
    }

    const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const orderResult = this.orderProcessor.createOrder(orderId, userId || res.userId, reservationId);

    const tx = this.transactions.find(t => t.reservationId === reservationId);
    if (tx && orderResult.success) {
      tx.orderCreated = true;
      tx.status = 'COMPLETED';
    }

    return {
      statusCode: orderResult.success ? 201 : 503,
      body: {
        status: orderResult.status,
        order: orderResult.order || null,
        orderId
      }
    };
  }

  getInventoryStatus(productId) {
    return {
      statusCode: 200,
      body: {
        productId: productId || this.productId,
        totalQuantity: this.inventoryStore.totalQuantity,
        availableQuantity: this.inventoryStore.availableQuantity,
        reservedQuantity: this.inventoryStore.reservedQuantity,
        soldQuantity: this.inventoryStore.soldQuantity,
        inStock: this.inventoryStore.availableQuantity > 0
      }
    };
  }

  getInvariantsAudit() {
    const evaluation = InvariantChecker.evaluate({
      inventoryStore: this.inventoryStore,
      idempotencyRegistry: this.idempotencyRegistry,
      reservationManager: this.reservationManager,
      orderProcessor: this.orderProcessor,
      initialInventory: this.initialStock,
      transactions: this.transactions
    });

    return {
      statusCode: 200,
      body: {
        inventory: {
          total: this.inventoryStore.totalQuantity,
          available: this.inventoryStore.availableQuantity,
          reserved: this.inventoryStore.reservedQuantity,
          sold: this.inventoryStore.soldQuantity
        },
        transactionsTotal: this.transactions.length,
        invariantsPassed: evaluation.allPassed,
        checks: evaluation.checks
      }
    };
  }
}
