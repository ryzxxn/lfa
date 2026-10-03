import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * Comprehensive metrics collection for function invocations
 * Tracks: CPU, memory, duration, throughput, errors, costs
 */

export interface FunctionMetrics {
  invocationId: string;
  functionId: string;
  functionVersion: string;
  timestamp: number;

  // Execution metrics
  duration: number; // ms
  startTime: number;
  endTime: number;

  // Resource usage
  cpuUsagePercent: number; // 0-100 per vCPU
  memoryUsedMB: number; // MB
  memoryLimitMB: number; // MB
  memoryUtilizationPercent: number; // Used/Limit * 100

  // Status
  status: "success" | "error" | "timeout";
  errorMessage?: string;
  errorType?: string;

  // I/O metrics
  networkBytesIn: number;
  networkBytesOut: number;

  // Cost estimation
  estimatedCostUSD: number;

  // Performance
  coldStart: boolean;
  queueWaitTime: number; // ms
}

export interface AggregatedMetrics {
  functionId: string;
  period: "minute" | "hour" | "day";
  timestamp: number;

  // Counts
  invocationCount: number;
  errorCount: number;
  timeoutCount: number;

  // Duration stats
  avgDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  minDuration: number;
  maxDuration: number;

  // CPU stats
  avgCpuUsage: number;
  maxCpuUsage: number;
  p95CpuUsage: number;

  // Memory stats
  avgMemoryUsed: number;
  maxMemoryUsed: number;
  p95MemoryUsed: number;

  // Network stats
  totalNetworkIn: number;
  totalNetworkOut: number;

  // Error rate
  errorRate: number; // 0-1
  timeoutRate: number; // 0-1

  // Cost
  totalCostUSD: number;
  costPerInvocation: number;

  // Cold starts
  coldStartCount: number;
  coldStartRate: number; // 0-1
  avgColdStartDuration: number;
}

export interface MetricsQueryOptions {
  functionId?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
  includeErrors?: boolean;
}

export interface AnomalyDetection {
  anomalies: Anomaly[];
  timestamp: number;
}

export interface Anomaly {
  type: "latency" | "memory" | "cpu" | "errorRate";
  severity: "low" | "medium" | "high";
  value: number;
  expectedValue: number;
  deviation: number; // percentage
  invocationId: string;
  functionId: string;
  message: string;
}

export class MetricsCollector {
  private dataDir: string;
  private metricsIndex: Map<string, FunctionMetrics[]> = new Map();
  private aggregatedCache: Map<string, AggregatedMetrics> = new Map();

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(os.tmpdir(), "firecracker-metrics");
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    this.loadMetricsFromDisk();
  }

  /**
   * Record a function invocation metric
   */
  async recordMetric(metric: FunctionMetrics): Promise<void> {
    // Add to in-memory index
    if (!this.metricsIndex.has(metric.functionId)) {
      this.metricsIndex.set(metric.functionId, []);
    }
    this.metricsIndex.get(metric.functionId)!.push(metric);

    // Persist to disk
    this.saveMetricToDisk(metric);

    // Check for anomalies
    await this.detectAnomalies(metric);
  }

  /**
   * Get raw metrics for a function
   */
  async getMetrics(options: MetricsQueryOptions): Promise<FunctionMetrics[]> {
    let metrics = this.metricsIndex.get(options.functionId || "") || [];

    // Filter by time range
    if (options.startTime) {
      metrics = metrics.filter((m) => m.timestamp >= options.startTime!);
    }
    if (options.endTime) {
      metrics = metrics.filter((m) => m.timestamp <= options.endTime!);
    }

    // Filter errors if needed
    if (!options.includeErrors) {
      metrics = metrics.filter((m) => m.status === "success");
    }

    // Limit results
    if (options.limit) {
      metrics = metrics.slice(-options.limit);
    }

    return metrics;
  }

  /**
   * Get aggregated metrics (stats over time period)
   */
  async getAggregatedMetrics(
    functionId: string,
    period: "minute" | "hour" | "day" = "hour"
  ): Promise<AggregatedMetrics[]> {
    const metrics = this.metricsIndex.get(functionId) || [];
    const now = Date.now();

    // Group by period
    const periods = new Map<number, FunctionMetrics[]>();

    metrics.forEach((metric) => {
      const periodStart = this.getPeriodStart(metric.timestamp, period);
      if (!periods.has(periodStart)) {
        periods.set(periodStart, []);
      }
      periods.get(periodStart)!.push(metric);
    });

    // Calculate aggregates
    const aggregated: AggregatedMetrics[] = [];
    periods.forEach((metricsInPeriod, periodStart) => {
      aggregated.push(this.calculateAggregates(functionId, periodStart, metricsInPeriod, period));
    });

    return aggregated.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get performance statistics
   */
  async getPerformanceStats(functionId: string): Promise<{
    latency: LatencyStats;
    memory: MemoryStats;
    cpu: CPUStats;
    errors: ErrorStats;
    costAnalysis: CostAnalysis;
  }> {
    const metrics = this.metricsIndex.get(functionId) || [];
    const successMetrics = metrics.filter((m) => m.status === "success");

    return {
      latency: this.calculateLatencyStats(successMetrics),
      memory: this.calculateMemoryStats(successMetrics),
      cpu: this.calculateCPUStats(successMetrics),
      errors: this.calculateErrorStats(metrics),
      costAnalysis: this.calculateCostAnalysis(metrics),
    };
  }

  /**
   * Compare performance between versions
   */
  async compareVersions(
    functionId: string,
    versionA: string,
    versionB: string
  ): Promise<VersionComparison> {
    const metrics = this.metricsIndex.get(functionId) || [];
    const metricsA = metrics.filter((m) => m.functionVersion === versionA);
    const metricsB = metrics.filter((m) => m.functionVersion === versionB);

    const statsA = this.calculateLatencyStats(metricsA);
    const statsB = this.calculateLatencyStats(metricsB);

    return {
      versionA,
      versionB,
      metricsA: {
        avgDuration: statsA.avg,
        p95Duration: statsA.p95,
        errorRate: metricsA.filter((m) => m.status !== "success").length / metricsA.length,
      },
      metricsB: {
        avgDuration: statsB.avg,
        p95Duration: statsB.p95,
        errorRate: metricsB.filter((m) => m.status !== "success").length / metricsB.length,
      },
      winner: statsB.avg < statsA.avg ? versionB : versionA,
      improvement: {
        latency: ((statsA.avg - statsB.avg) / statsA.avg) * 100,
      },
    };
  }

  /**
   * Detect anomalies in metrics
   */
  private async detectAnomalies(metric: FunctionMetrics): Promise<Anomaly[]> {
    const functionMetrics = this.metricsIndex.get(metric.functionId) || [];
    const anomalies: Anomaly[] = [];

    const stats = this.calculateLatencyStats(functionMetrics.slice(-100));

    // Latency anomaly
    if (metric.duration > stats.avg * 3) {
      anomalies.push({
        type: "latency",
        severity: "high",
        value: metric.duration,
        expectedValue: stats.avg,
        deviation: ((metric.duration - stats.avg) / stats.avg) * 100,
        invocationId: metric.invocationId,
        functionId: metric.functionId,
        message: `Latency ${metric.duration}ms is 3x higher than average ${Math.round(stats.avg)}ms`,
      });
    }

    // Memory anomaly
    if (metric.memoryUtilizationPercent > 90) {
      anomalies.push({
        type: "memory",
        severity: "high",
        value: metric.memoryUsedMB,
        expectedValue: stats.avg,
        deviation: metric.memoryUtilizationPercent - 80,
        invocationId: metric.invocationId,
        functionId: metric.functionId,
        message: `Memory usage ${metric.memoryUtilizationPercent}% approaching limit`,
      });
    }

    // CPU anomaly
    if (metric.cpuUsagePercent > 95) {
      anomalies.push({
        type: "cpu",
        severity: "medium",
        value: metric.cpuUsagePercent,
        expectedValue: 50,
        deviation: metric.cpuUsagePercent - 50,
        invocationId: metric.invocationId,
        functionId: metric.functionId,
        message: `High CPU usage: ${metric.cpuUsagePercent}%`,
      });
    }

    return anomalies;
  }

  // Helper methods

  private calculateAggregates(
    functionId: string,
    periodStart: number,
    metrics: FunctionMetrics[],
    period: string
  ): AggregatedMetrics {
    const durations = metrics.map((m) => m.duration).sort((a, b) => a - b);
    const memoryUsed = metrics.map((m) => m.memoryUsedMB).sort((a, b) => a - b);
    const cpuUsage = metrics.map((m) => m.cpuUsagePercent).sort((a, b) => a - b);

    const errors = metrics.filter((m) => m.status !== "success");
    const timeouts = metrics.filter((m) => m.status === "timeout");
    const coldStarts = metrics.filter((m) => m.coldStart);

    return {
      functionId,
      period: period as any,
      timestamp: periodStart,
      invocationCount: metrics.length,
      errorCount: errors.length,
      timeoutCount: timeouts.length,
      avgDuration: this.avg(durations),
      p50Duration: this.percentile(durations, 50),
      p95Duration: this.percentile(durations, 95),
      p99Duration: this.percentile(durations, 99),
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      avgCpuUsage: this.avg(cpuUsage),
      maxCpuUsage: cpuUsage[cpuUsage.length - 1],
      p95CpuUsage: this.percentile(cpuUsage, 95),
      avgMemoryUsed: this.avg(memoryUsed),
      maxMemoryUsed: memoryUsed[memoryUsed.length - 1],
      p95MemoryUsed: this.percentile(memoryUsed, 95),
      totalNetworkIn: metrics.reduce((sum, m) => sum + m.networkBytesIn, 0),
      totalNetworkOut: metrics.reduce((sum, m) => sum + m.networkBytesOut, 0),
      errorRate: errors.length / metrics.length,
      timeoutRate: timeouts.length / metrics.length,
      totalCostUSD: metrics.reduce((sum, m) => sum + m.estimatedCostUSD, 0),
      costPerInvocation: metrics.reduce((sum, m) => sum + m.estimatedCostUSD, 0) / metrics.length,
      coldStartCount: coldStarts.length,
      coldStartRate: coldStarts.length / metrics.length,
      avgColdStartDuration: this.avg(coldStarts.map((m) => m.duration)),
    };
  }

  private calculateLatencyStats(metrics: FunctionMetrics[]): LatencyStats {
    const durations = metrics.map((m) => m.duration).sort((a, b) => a - b);
    return {
      count: metrics.length,
      avg: this.avg(durations),
      min: durations[0] || 0,
      max: durations[durations.length - 1] || 0,
      p50: this.percentile(durations, 50),
      p95: this.percentile(durations, 95),
      p99: this.percentile(durations, 99),
    };
  }

  private calculateMemoryStats(metrics: FunctionMetrics[]): MemoryStats {
    const memory = metrics.map((m) => m.memoryUsedMB).sort((a, b) => a - b);
    return {
      avg: this.avg(memory),
      min: memory[0] || 0,
      max: memory[memory.length - 1] || 0,
      p95: this.percentile(memory, 95),
      avgUtilization: this.avg(metrics.map((m) => m.memoryUtilizationPercent)),
    };
  }

  private calculateCPUStats(metrics: FunctionMetrics[]): CPUStats {
    const cpu = metrics.map((m) => m.cpuUsagePercent).sort((a, b) => a - b);
    return {
      avg: this.avg(cpu),
      max: cpu[cpu.length - 1] || 0,
      p95: this.percentile(cpu, 95),
    };
  }

  private calculateErrorStats(metrics: FunctionMetrics[]): ErrorStats {
    const errors = metrics.filter((m) => m.status !== "success");
    const timeouts = metrics.filter((m) => m.status === "timeout");
    const byType = new Map<string, number>();

    errors.forEach((m) => {
      if (m.errorType) {
        byType.set(m.errorType, (byType.get(m.errorType) || 0) + 1);
      }
    });

    return {
      totalErrors: errors.length,
      errorRate: errors.length / metrics.length,
      timeouts: timeouts.length,
      timeoutRate: timeouts.length / metrics.length,
      byType: Object.fromEntries(byType),
    };
  }

  private calculateCostAnalysis(metrics: FunctionMetrics[]): CostAnalysis {
    const totalCost = metrics.reduce((sum, m) => sum + m.estimatedCostUSD, 0);
    const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
    const totalMemory = metrics.reduce((sum, m) => sum + m.memoryUsedMB * m.duration, 0);

    return {
      totalCostUSD: totalCost,
      costPerInvocation: totalCost / metrics.length,
      costPerMillisecond: totalCost / totalDuration,
      estimatedMonthlyCost: (totalCost / metrics.length) * 2592000000, // Assuming 30 days
    };
  }

  private avg(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private getPeriodStart(timestamp: number, period: string): number {
    const date = new Date(timestamp);
    switch (period) {
      case "minute":
        date.setSeconds(0, 0);
        return date.getTime();
      case "hour":
        date.setMinutes(0, 0, 0);
        return date.getTime();
      case "day":
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      default:
        return timestamp;
    }
  }

  private saveMetricToDisk(metric: FunctionMetrics): void {
    const dir = path.join(this.dataDir, metric.functionId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const file = path.join(dir, `${metric.invocationId}.json`);
    fs.writeFileSync(file, JSON.stringify(metric, null, 2));
  }

  private loadMetricsFromDisk(): void {
    if (!fs.existsSync(this.dataDir)) return;

    const functionDirs = fs.readdirSync(this.dataDir);
    functionDirs.forEach((funcId) => {
      const funcDir = path.join(this.dataDir, funcId);
      if (!fs.statSync(funcDir).isDirectory()) return;

      const files = fs.readdirSync(funcDir);
      const metrics: FunctionMetrics[] = [];

      files.forEach((file) => {
        if (file.endsWith(".json")) {
          const content = fs.readFileSync(path.join(funcDir, file), "utf-8");
          metrics.push(JSON.parse(content));
        }
      });

      if (metrics.length > 0) {
        this.metricsIndex.set(funcId, metrics);
      }
    });
  }
}

// Type definitions
interface LatencyStats {
  count: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

interface MemoryStats {
  avg: number;
  min: number;
  max: number;
  p95: number;
  avgUtilization: number;
}

interface CPUStats {
  avg: number;
  max: number;
  p95: number;
}

interface ErrorStats {
  totalErrors: number;
  errorRate: number;
  timeouts: number;
  timeoutRate: number;
  byType: Record<string, number>;
}

interface CostAnalysis {
  totalCostUSD: number;
  costPerInvocation: number;
  costPerMillisecond: number;
  estimatedMonthlyCost: number;
}

interface VersionComparison {
  versionA: string;
  versionB: string;
  metricsA: {
    avgDuration: number;
    p95Duration: number;
    errorRate: number;
  };
  metricsB: {
    avgDuration: number;
    p95Duration: number;
    errorRate: number;
  };
  winner: string;
  improvement: {
    latency: number;
  };
}
