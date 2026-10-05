"""
locustfile.py

Locust Virtual Customer Load Generator for SALESTORM Flash-Sale Architecture.
Executes the approved purchase workflow:
  1. Submit Buy Now / Reservation request with unique Idempotency Key
  2. If reservation succeeds -> Process Payment checkout
  3. If payment succeeds -> Submit Order confirmation
  4. If out of stock (HTTP 409) -> Log expected capacity exhaustion without skewing failure metrics
"""

import time
import uuid
from locust import HttpUser, task, between, events

class FlashSaleCustomer(HttpUser):
    wait_time = between(0.01, 0.05)  # Fast concurrent burst

    @task
    def buy_product(self):
        user_id = f"USER_{uuid.uuid4().hex[:8]}"
        idempotency_key = f"IDEMP_{uuid.uuid4()}"
        correlation_id = f"CORR_{uuid.uuid4().hex[:12]}"
        
        headers = {
            "Content-Type": "application/json",
            "X-Idempotency-Key": idempotency_key,
            "X-Correlation-Id": correlation_id,
            "X-Request-Id": f"REQ_{uuid.uuid4().hex[:8]}"
        }

        # Step 1: Attempt stock reservation
        payload = {
            "productId": "PRODUCT-X",
            "userId": user_id,
            "quantity": 1
        }

        with self.client.post("/api/v1/reservations", json=payload, headers=headers, catch_response=True) as res_response:
            if res_response.status_code == 201:
                res_data = res_response.json().get("data", {})
                reservation_id = res_data.get("reservationId")
                res_response.success()
            elif res_response.status_code == 409:
                # 409 Out of Stock is an expected capacity rejection, not an operational failure
                res_response.success()
                return
            elif res_response.status_code == 200:
                # Deduplicated response
                res_response.success()
                return
            else:
                res_response.failure(f"Unexpected reservation status: {res_response.status_code}")
                return

        # Step 2: Attempt Payment
        pay_payload = {
            "reservationId": reservation_id,
            "amount": 100
        }

        with self.client.post("/api/v1/payments", json=pay_payload, headers=headers, catch_response=True) as pay_response:
            if pay_response.status_code == 200:
                pay_response.success()
            elif pay_response.status_code == 402:
                # Controlled payment failure compensation
                pay_response.success()
                return
            else:
                pay_response.failure(f"Unexpected payment status: {pay_response.status_code}")
                return

        # Step 3: Confirm Order
        order_payload = {
            "reservationId": reservation_id,
            "userId": user_id
        }

        with self.client.post("/api/v1/orders", json=order_payload, headers=headers, catch_response=True) as order_response:
            if order_response.status_code == 201:
                order_response.success()
            else:
                order_response.failure(f"Unexpected order status: {order_response.status_code}")
