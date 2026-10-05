/**
 * server.js
 * 
 * Lightweight SALESTORM HTTP Server providing:
 *  - SALESTORM Data Plane APIs (/api/v1/...)
 *  - Simulation Control Plane APIs (/simulation/...)
 */

import http from 'node:http';
import { DataPlaneService } from '../api/dataPlaneRoutes.js';
import { SimulationEngine } from '../deterministic/engine/SimulationEngine.js';

const PORT = process.env.PORT || 8000;
const dataPlane = new DataPlaneService(100);

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Idempotency-Key, X-Request-Id, X-Correlation-Id'
  });
  res.end(JSON.stringify(data, null, 2));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    return sendJson(res, 204, {});
  }

  try {
    // ----------------------------------------------------
    // SALESTORM DATA PLANE APIS
    // ----------------------------------------------------
    if (pathname === '/api/v1/health' && method === 'GET') {
      return sendJson(res, 200, { status: 'HEALTHY', timestamp: Date.now() });
    }

    if (pathname === '/api/v1/inventory/reset' && method === 'POST') {
      const body = await parseJsonBody(req);
      const stock = body.stock ?? 100;
      dataPlane.resetState(stock);
      return sendJson(res, 200, { status: 'RESET_SUCCESS', initialStock: stock });
    }

    if (pathname.startsWith('/api/v1/inventory/') && method === 'GET') {
      const productId = pathname.replace('/api/v1/inventory/', '');
      const resp = dataPlane.getInventoryStatus(productId);
      return sendJson(res, resp.statusCode, resp.body);
    }

    if (pathname === '/api/v1/reservations' && method === 'POST') {
      const body = await parseJsonBody(req);
      const resp = dataPlane.handleReservation(body, req.headers);
      return sendJson(res, resp.statusCode, resp.body);
    }

    if (pathname === '/api/v1/payments' && method === 'POST') {
      const body = await parseJsonBody(req);
      const resp = dataPlane.handlePayment(body, req.headers);
      return sendJson(res, resp.statusCode, resp.body);
    }

    if (pathname === '/api/v1/orders' && method === 'POST') {
      const body = await parseJsonBody(req);
      const resp = dataPlane.handleOrder(body, req.headers);
      return sendJson(res, resp.statusCode, resp.body);
    }

    if (pathname === '/api/v1/audit/invariants' && method === 'GET') {
      const resp = dataPlane.getInvariantsAudit();
      return sendJson(res, resp.statusCode, resp.body);
    }

    // ----------------------------------------------------
    // SIMULATION CONTROL PLANE APIS
    // ----------------------------------------------------
    if (pathname === '/simulation/runs' && method === 'POST') {
      const body = await parseJsonBody(req);
      const engine = new SimulationEngine({
        productId: body.productId || 'PRODUCT-X',
        initialInventory: body.initialInventory ?? 100,
        virtualUsers: body.virtualUsers ?? 10000,
        paymentSuccessRate: body.paymentSuccessRate ?? 0.95,
        duplicateRate: body.duplicateRate ?? 0.02
      });

      const result = await engine.run(body.scenarioName || 'Flash Sale 10k');
      return sendJson(res, 200, { status: 'COMPLETED', result });
    }

    sendJson(res, 404, { error: 'Not Found', path: pathname });
  } catch (err) {
    console.error('Server error:', err);
    sendJson(res, 500, { error: 'Internal Server Error', message: err.message });
  }
});

if (process.argv[1]?.endsWith('server.js')) {
  server.listen(PORT, () => {
    console.log(`SALESTORM Prototype API Server listening on http://localhost:${PORT}`);
  });
}

export { server, dataPlane };
