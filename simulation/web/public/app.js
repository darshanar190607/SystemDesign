/**
 * app.js
 * 
 * SALESTORM Simulation Dashboard Frontend Logic
 */

// Preset Configurations
const PRESETS = {
  'flash-sale': {
    scenarioName: 'TS-002: Flash Sale 10k Concurrency',
    productId: 'PRODUCT-X',
    initialInventory: 100,
    virtualUsers: 10000,
    paymentSuccessRate: 95,
    duplicateRate: 2,
    mode: 'deterministic'
  },
  'last-item': {
    scenarioName: 'TS-001: Last Item Concurrency',
    productId: 'PRODUCT-LAST-1',
    initialInventory: 1,
    virtualUsers: 2,
    paymentSuccessRate: 100,
    duplicateRate: 0,
    mode: 'deterministic'
  },
  'duplicate': {
    scenarioName: 'TS-003: Duplicate Purchase Request (Idempotency)',
    productId: 'PRODUCT-IDEMP',
    initialInventory: 50,
    virtualUsers: 500,
    paymentSuccessRate: 100,
    duplicateRate: 30,
    mode: 'deterministic'
  },
  'payment-fail': {
    scenarioName: 'TS-004: Payment Failure & Compensation',
    productId: 'PRODUCT-PAY-FAIL',
    initialInventory: 20,
    virtualUsers: 20,
    paymentSuccessRate: 50,
    duplicateRate: 0,
    mode: 'deterministic'
  },
  'expiry': {
    scenarioName: 'TS-005: Reservation Expiry TTL Sweeper',
    productId: 'PRODUCT-TTL',
    initialInventory: 10,
    virtualUsers: 10,
    paymentSuccessRate: 0,
    duplicateRate: 0,
    mode: 'deterministic'
  },
  'order-recovery': {
    scenarioName: 'TS-006: Order Service Temporary Failure & Retry',
    productId: 'PRODUCT-RECOVERY',
    initialInventory: 5,
    virtualUsers: 5,
    paymentSuccessRate: 100,
    duplicateRate: 0,
    mode: 'deterministic'
  }
};

let currentPresetKey = 'flash-sale';
let pendingRunConfig = null;

// DOM Elements
const form = document.getElementById('scenarioForm');
const runBtn = document.getElementById('runBtn');
const presetButtons = document.querySelectorAll('.btn-preset');
const confirmModal = document.getElementById('confirmModal');
const modalUsers = document.getElementById('modalUsers');
const modalStock = document.getElementById('modalStock');
const modalMode = document.getElementById('modalMode');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');

// Initialize Presets
presetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    presetButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPresetKey = btn.dataset.preset;
    applyPreset(PRESETS[currentPresetKey]);
  });
});

function applyPreset(preset) {
  document.getElementById('productId').value = preset.productId;
  document.getElementById('initialInventory').value = preset.initialInventory;
  document.getElementById('virtualUsers').value = preset.virtualUsers;
  document.getElementById('paymentSuccessRate').value = preset.paymentSuccessRate;
  document.getElementById('duplicateRate').value = preset.duplicateRate;
  document.getElementById('executionMode').value = preset.mode;
  document.getElementById('scenarioHeading').textContent = preset.scenarioName;
}

// Form Submission with Safety Guard
form.addEventListener('submit', (e) => {
  e.preventDefault();

  const config = {
    scenarioName: PRESETS[currentPresetKey]?.scenarioName || 'Custom Simulation Run',
    productId: document.getElementById('productId').value.trim(),
    initialInventory: parseInt(document.getElementById('initialInventory').value, 10),
    virtualUsers: parseInt(document.getElementById('virtualUsers').value, 10),
    paymentSuccessRate: parseFloat(document.getElementById('paymentSuccessRate').value) / 100,
    duplicateRate: parseFloat(document.getElementById('duplicateRate').value) / 100,
    mode: document.getElementById('executionMode').value,
    targetUrl: document.getElementById('targetUrl').value.trim()
  };

  // Safety confirmation for large runs (>= 5,000 users)
  if (config.virtualUsers >= 5000) {
    pendingRunConfig = config;
    modalUsers.textContent = config.virtualUsers.toLocaleString();
    modalStock.textContent = config.initialInventory.toLocaleString();
    modalMode.textContent = config.mode === 'deterministic' ? 'Mode B — Deterministic In-Memory' : 'Mode A — Connected HTTP API';
    confirmModal.classList.remove('hidden');
  } else {
    executeRun(config);
  }
});

modalCancelBtn.addEventListener('click', () => {
  confirmModal.classList.add('hidden');
  pendingRunConfig = null;
});

modalConfirmBtn.addEventListener('click', () => {
  confirmModal.classList.add('hidden');
  if (pendingRunConfig) {
    executeRun(pendingRunConfig);
    pendingRunConfig = null;
  }
});

async function executeRun(config) {
  runBtn.disabled = true;
  runBtn.innerHTML = '<span class="btn-icon">⏳</span> Executing Simulation...';

  const verdictEl = document.getElementById('overallVerdict');
  verdictEl.className = 'verdict-badge verdict-pending';
  verdictEl.textContent = 'RUNNING...';

  const t0 = performance.now();

  try {
    let result;
    if (config.mode === 'deterministic') {
      const response = await fetch('/simulation/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await response.json();
      result = data.result;
    } else {
      // Connected API run
      result = await runConnectedApiSuite(config);
    }

    renderResults(result);
  } catch (err) {
    console.error('Simulation execution failed:', err);
    verdictEl.className = 'verdict-badge verdict-fail';
    verdictEl.textContent = 'EXECUTION ERROR';
    alert(`Simulation failed: ${err.message}`);
  } finally {
    runBtn.disabled = false;
    runBtn.innerHTML = '<span class="btn-icon">🚀</span> Launch Simulation Run';
  }
}

async function runConnectedApiSuite(config) {
  const target = config.targetUrl || 'http://localhost:8000';
  
  // 1. Reset Inventory
  await fetch(`${target}/api/v1/inventory/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stock: config.initialInventory })
  });

  const t0 = performance.now();
  let completed = 0;
  let outOfStock = 0;
  let payFailures = 0;
  const latencies = [];

  const requests = Array.from({ length: config.virtualUsers }, async (_, i) => {
    const reqT0 = performance.now();
    const userId = `USER_${(i + 1).toString().padStart(6, '0')}`;
    const idempotencyKey = `IDEMP_WEB_${i + 1}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
      'X-Request-Id': `REQ_WEB_${i + 1}`
    };

    // Step 1: Reservation
    const resResp = await fetch(`${target}/api/v1/reservations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ productId: config.productId, userId, quantity: 1 })
    });

    if (resResp.status === 409) {
      outOfStock++;
      latencies.push(performance.now() - reqT0);
      return;
    }

    if (!resResp.ok) {
      latencies.push(performance.now() - reqT0);
      return;
    }

    const resData = await resResp.json();
    const reservationId = resData.data?.reservationId;

    // Step 2: Payment
    const payResp = await fetch(`${target}/api/v1/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reservationId, amount: 100 })
    });

    if (!payResp.ok) {
      payFailures++;
      latencies.push(performance.now() - reqT0);
      return;
    }

    // Step 3: Order
    const ordResp = await fetch(`${target}/api/v1/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reservationId, userId })
    });

    if (ordResp.ok) {
      completed++;
    }
    latencies.push(performance.now() - reqT0);
  });

  await Promise.all(requests);
  const durationSec = Math.max((performance.now() - t0) / 1000, 0.001);

  // Fetch audit
  const auditResp = await fetch(`${target}/api/v1/audit/invariants`);
  const auditData = await auditResp.json();

  latencies.sort((a, b) => a - b);
  const avgLat = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);

  return {
    runId: `API_RUN_${Date.now()}`,
    scenario: config.scenarioName,
    performance: {
      totalRequests: config.virtualUsers,
      durationSeconds: parseFloat(durationSec.toFixed(3)),
      requestsPerSecond: parseFloat((config.virtualUsers / durationSec).toFixed(2)),
      latency: {
        avgMs: parseFloat(avgLat.toFixed(2)),
        p50Ms: parseFloat((latencies[Math.floor(latencies.length * 0.5)] || 0).toFixed(2)),
        p95Ms: parseFloat((latencies[Math.floor(latencies.length * 0.95)] || 0).toFixed(2)),
        p99Ms: parseFloat((latencies[Math.floor(latencies.length * 0.99)] || 0).toFixed(2)),
        maxMs: parseFloat((latencies[latencies.length - 1] || 0).toFixed(2))
      }
    },
    business: {
      initialInventory: config.initialInventory,
      virtualUsers: config.virtualUsers,
      totalPurchaseAttempts: config.virtualUsers,
      successfulReservations: completed + payFailures,
      failedReservationsOutOfStock: outOfStock,
      duplicateRequestsDetected: 0,
      paymentSuccesses: completed,
      paymentFailures: payFailures,
      ordersCreated: completed,
      oversoldUnits: 0,
      finalInventory: auditData.inventory,
      invariantsVerdict: auditData.invariantsPassed ? 'PASS' : 'FAIL',
      invariantChecks: auditData.checks
    },
    invariantResult: {
      allPassed: auditData.invariantsPassed,
      checks: auditData.checks
    }
  };
}

function renderResults(result) {
  document.getElementById('runIdTag').textContent = `Run ID: ${result.runId}`;
  
  // Banner Verdict
  const verdictEl = document.getElementById('overallVerdict');
  const allPassed = result.invariantResult?.allPassed;
  verdictEl.className = `verdict-badge ${allPassed ? 'verdict-pass' : 'verdict-fail'}`;
  verdictEl.textContent = allPassed ? '✅ ALL INVARIANTS PASSED' : '❌ INVARIANT FAILED';

  // Metrics
  document.getElementById('valAttempts').textContent = result.business.totalPurchaseAttempts.toLocaleString();
  document.getElementById('valRps').innerHTML = `${result.performance.requestsPerSecond.toLocaleString()} <span class="unit">RPS</span>`;
  document.getElementById('valDuration').textContent = `Duration: ${result.performance.durationSeconds}s`;
  document.getElementById('valOrders').textContent = result.business.ordersCreated.toLocaleString();
  document.getElementById('valOversold').textContent = result.business.oversoldUnits;

  // Funnel
  const total = Math.max(result.business.totalPurchaseAttempts, 1);
  const attemptsWidth = 100;
  const reservedWidth = Math.min((result.business.successfulReservations / total) * 100, 100);
  const paidWidth = Math.min((result.business.ordersCreated / total) * 100, 100);
  const dupsWidth = Math.min((result.business.duplicateRequestsDetected / total) * 100, 100);

  document.getElementById('funnelAttempts').style.width = `${attemptsWidth}%`;
  document.getElementById('barValAttempts').textContent = result.business.totalPurchaseAttempts.toLocaleString();

  document.getElementById('funnelReserved').style.width = `${Math.max(reservedWidth, 5)}%`;
  document.getElementById('barValReserved').textContent = `${result.business.successfulReservations} (Max ≤ ${result.business.initialInventory})`;

  document.getElementById('funnelPaid').style.width = `${Math.max(paidWidth, 4)}%`;
  document.getElementById('barValPaid').textContent = `${result.business.ordersCreated} Orders Confirmed`;

  document.getElementById('funnelDuplicates').style.width = `${Math.max(dupsWidth, 3)}%`;
  document.getElementById('barValDuplicates').textContent = `${result.business.duplicateRequestsDetected} Intercepted`;

  // Latency
  document.getElementById('latAvg').textContent = `${result.performance.latency.avgMs} ms`;
  document.getElementById('latP50').textContent = `${result.performance.latency.p50Ms} ms`;
  document.getElementById('latP95').textContent = `${result.performance.latency.p95Ms} ms`;
  document.getElementById('latP99').textContent = `${result.performance.latency.p99Ms} ms`;
  document.getElementById('latMax').textContent = `${result.performance.latency.maxMs} ms`;

  // Inventory Accounting
  const inv = result.business.finalInventory || {};
  document.getElementById('invTotal').textContent = inv.total ?? result.business.initialInventory;
  document.getElementById('invAvailable').textContent = inv.available ?? 0;
  document.getElementById('invReserved').textContent = inv.reserved ?? 0;
  document.getElementById('invSold').textContent = inv.sold ?? result.business.ordersCreated;

  // Invariants list
  const container = document.getElementById('invariantsContainer');
  container.innerHTML = '';
  
  const checks = result.invariantResult?.checks || [];
  checks.forEach(check => {
    const card = document.createElement('div');
    card.className = `invariant-card ${check.passed ? 'pass' : 'fail'}`;
    card.innerHTML = `
      <div class="invariant-meta">
        <div class="invariant-title">${check.id ? check.id + ': ' : ''}${check.name}</div>
        <div class="invariant-details">${check.details}</div>
      </div>
      <div class="invariant-badge ${check.passed ? 'text-emerald' : 'text-crimson'}">
        ${check.passed ? '✅ PASS' : '❌ FAIL'}
      </div>
    `;
    container.appendChild(card);
  });
}

// Check server status on load
fetch('/api/v1/health')
  .then(res => res.json())
  .then(data => {
    if (data.status === 'HEALTHY') {
      document.getElementById('serverStatusText').textContent = 'Live Control Plane (Port 8000)';
    }
  })
  .catch(() => {
    document.getElementById('serverStatusText').textContent = 'Offline';
  });

// Auto-run flash-sale preset preview on initial load
executeRun({
  scenarioName: PRESETS['flash-sale'].scenarioName,
  productId: 'PRODUCT-X',
  initialInventory: 100,
  virtualUsers: 10000,
  paymentSuccessRate: 0.95,
  duplicateRate: 0.02,
  mode: 'deterministic'
});
