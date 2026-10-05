"""
run_load_test.py

Automated Connected API Mode Load Runner & Invariant Auditor.
Sends concurrent HTTP requests to the active SALESTORM Data Plane API
and verifies business invariants via the audit endpoint.
"""

import urllib.request
import urllib.parse
import json
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = "http://localhost:8000"

def make_request(method, path, data=None, headers=None):
    url = f"{BASE_URL}{path}"
    headers = headers or {}
    encoded_data = json.dumps(data).encode('utf-8') if data else None
    
    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    req.add_header('Content-Type', 'application/json')

    try:
        with urllib.request.urlopen(req) as response:
            return response.getcode(), json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = {}
        try:
            body = json.loads(e.read().decode('utf-8'))
        except Exception:
            pass
        return e.code, body
    except Exception as e:
        return 500, {"error": str(e)}

def simulate_customer(user_index):
    user_id = f"USER_API_{user_index:05d}"
    idempotency_key = f"IDEMP_API_{user_index:05d}"
    headers = {
        "X-Idempotency-Key": idempotency_key,
        "X-Request-Id": f"REQ_API_{user_index:05d}"
    }

    t0 = time.time()
    
    # 1. Reservation
    status, res_body = make_request("POST", "/api/v1/reservations", {
        "productId": "PRODUCT-X",
        "userId": user_id,
        "quantity": 1
    }, headers)

    if status != 201:
        return {
            "user_id": user_id,
            "status": "RESERVATION_REJECTED" if status == 409 else "FAILED",
            "latency": time.time() - t0
        }

    reservation_id = res_body["data"]["reservationId"]

    # 2. Payment
    status, pay_body = make_request("POST", "/api/v1/payments", {
        "reservationId": reservation_id,
        "amount": 100
    }, headers)

    if status != 200:
        return {
            "user_id": user_id,
            "status": "PAYMENT_FAILED",
            "latency": time.time() - t0
        }

    # 3. Order
    status, order_body = make_request("POST", "/api/v1/orders", {
        "reservationId": reservation_id,
        "userId": user_id
    }, headers)

    return {
        "user_id": user_id,
        "status": "COMPLETED" if status == 201 else "ORDER_FAILED",
        "latency": time.time() - t0
    }

def run_connected_api_test(num_users=500, initial_stock=50, concurrency=50):
    print("==================================================================")
    print(f"RUNNING CONNECTED API MODE: {num_users} Users vs {initial_stock} Units")
    print(f"Target API: {BASE_URL} | Concurrency: {concurrency} Threads")
    print("==================================================================")

    # Reset server state
    make_request("POST", "/api/v1/inventory/reset", {"stock": initial_stock})

    start_time = time.time()
    results = []

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(simulate_customer, i) for i in range(num_users)]
        for future in as_completed(futures):
            results.append(future.result())

    total_duration = time.time() - start_time
    rps = num_users / total_duration

    completed = sum(1 for r in results if r["status"] == "COMPLETED")
    rejected = sum(1 for r in results if r["status"] == "RESERVATION_REJECTED")
    pay_failed = sum(1 for r in results if r["status"] == "PAYMENT_FAILED")

    print(f"\nExecution Duration: {total_duration:.2f}s | RPS: {rps:.2f}")
    print(f"Successful Completed Orders: {completed}")
    print(f"Out of Stock (409 Rejections): {rejected}")
    print(f"Payment Failures & Released: {pay_failed}")

    # Fetch Server Invariant Audit
    status, audit = make_request("GET", "/api/v1/audit/invariants")
    print("\n--- SERVER INVARIANT AUDIT REPORT ---")
    print(f"Inventory: {json.dumps(audit.get('inventory', {}))}")
    print(f"All Invariants Passed: {'[PASS] YES' if audit.get('invariantsPassed') else '[FAIL] NO'}")

    for check in audit.get('checks', []):
        print(f"  {'[PASS]' if check['passed'] else '[FAIL]'} {check['name']}: {check['details']}")
    print("==================================================================\n")

if __name__ == "__main__":
    run_connected_api_test(num_users=500, initial_stock=50, concurrency=50)
