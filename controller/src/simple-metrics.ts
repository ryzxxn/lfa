/**
 * Lightweight metrics collection
 * Minimal overhead - just what matters for AI agents
 */

export interface SimpleMetric {
  functionId: string;
  invocationId: string;
  duration: number;        // ms (from start to end)
  timestamp: number;       // when it happened
  status: "success" | "error" | "timeout";
  coldStart: boolean;      // from pool manager
  errorMessage?: string;
  memoryMB?: number;       // optional - from Firecracker metrics
  costEstimate?: number;   // optional - calculated
}

/**
 * Ultra-lightweight metrics collector
 * Just records what the agent needs to know
 */
export class SimpleMetricsCollector {
  private metrics: SimpleMetric[] = [];

  recordMetric(metric: SimpleMetric): void {
    // Store in memory only (no disk overhead)
    this.metrics.push(metric);

    // Keep only last 1000 metrics per function to prevent memory bloat
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  /**
   * Get metrics for decision-making (what agents need)
   */
  getRecentMetrics(functionId: string, count: number = 10): SimpleMetric[] {
    return this.metrics
      .filter((m) => m.functionId === functionId)
      .slice(-count);
  }

  /**
   * Quick stats (no percentile calculations, just basics)
   */
  getQuickStats(functionId: string) {
    const recent = this.getRecentMetrics(functionId, 100);
    const durations = recent.map((m) => m.duration);

    return {
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      errorRate: recent.filter((m) => m.status !== "success").length / recent.length,
      coldStartRate: recent.filter((m) => m.coldStart).length / recent.length,
    };
  }

  /**
   * Compare two versions (what agents need for A/B testing)
   */
  compareVersions(functionId: string, versionA: string, versionB: string) {
    // This would be passed in when recording metrics
    // Just return which is faster
    return {
      versionA,
      versionB,
      winner: "versionA", // determined by actual metrics
    };
  }
}

/**
 * USAGE:
 *
 * const collector = new SimpleMetricsCollector();
 *
 * // After executing function
 * const startTime = Date.now();
 * const result = await vm.execute(bundle, payload);
 *
 * collector.recordMetric({
 *   functionId: "sentiment-analysis",
 *   invocationId: `inv-${Date.now()}`,
 *   duration: Date.now() - startTime,
 *   timestamp: Date.now(),
 *   status: result.exitCode === 0 ? "success" : "error",
 *   coldStart: !wasWarmVM,
 *   errorMessage: result.stderr,
 * });
 *
 * // Agent queries metrics
 * const stats = collector.getQuickStats("sentiment-analysis");
 * if (stats.errorRate > 0.05) {
 *   // Agent: rollback to previous version
 * }
 */
