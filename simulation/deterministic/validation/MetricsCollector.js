/**
 * MetricsCollector.js
 * 
 * Aggregates performance and business metrics for simulation runs:
 *  - Virtual users, total requests, throughput (req/sec)
 *  - Latency percentiles: avg, p50, p95, p99, max
 *  - Business counts: reservation success/failure, payment success/failure, orders, duplicates
 */

export class MetricsCollector {
  constructor() {
    this.latencies = [];
    this.startTime = 0;
    this.endTime = 0;
  }

  start() {
    this.startTime = performance.now();
    this.latencies = [];
  }

  recordLatency(ms) {
    this.latencies.push(ms);
  }

  stop() {
    this.endTime = performance.now();
  }

  getSummary(businessStats = {}) {
    const durationSec = Math.max((this.endTime - this.startTime) / 1000, 0.001);
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const totalRequests = sorted.length;

    const getPercentile = (p) => {
      if (totalRequests === 0) return 0;
      const index = Math.min(Math.floor((p / 100) * totalRequests), totalRequests - 1);
      return sorted[index];
    };

    const avgLatency = totalRequests > 0 
      ? sorted.reduce((a, b) => a + b, 0) / totalRequests 
      : 0;

    return {
      performance: {
        totalRequests,
        durationSeconds: Number(durationSec.toFixed(3)),
        requestsPerSecond: Number((totalRequests / durationSec).toFixed(2)),
        latency: {
          avgMs: Number(avgLatency.toFixed(2)),
          p50Ms: Number(getPercentile(50).toFixed(2)),
          p95Ms: Number(getPercentile(95).toFixed(2)),
          p99Ms: Number(getPercentile(99).toFixed(2)),
          maxMs: Number((sorted[totalRequests - 1] || 0).toFixed(2))
        }
      },
      business: {
        ...businessStats
      }
    };
  }
}
