/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FileOperation } from "./mockFileSystem";

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Statistical summary of dry run operations
 */
export interface DryRunStatistics {
  /** Total number of operations */
  totalOperations: number;
  /** Number of files that would be created */
  filesCreated: number;
  /** Number of files that would be modified */
  filesModified: number;
  /** Number of files that would be deleted */
  filesDeleted: number;
  /** Number of directories that would be created */
  directoriesCreated: number;
  /** Number of read operations */
  readOperations: number;
  /** Number of write operations */
  writeOperations: number;
  /** Total bytes that would be written */
  totalBytesWritten: number;
  /** Total bytes that would be read */
  totalBytesRead: number;
  /** Number of successful operations */
  successfulOperations: number;
  /** Number of failed operations */
  failedOperations: number;
  /** Most frequently accessed paths */
  frequentPaths: Array<{ path: string; count: number }>;
  /** Operations by type breakdown */
  operationsByType: Record<string, number>;
  /** Average operation duration (if timing data available) */
  averageOperationDuration?: number;
  /** Peak memory usage estimate */
  estimatedMemoryUsage: number;
  /** File type distribution */
  fileTypeDistribution: Record<string, number>;
  /** Size impact analysis */
  sizeImpact: {
    /** Total size of files that would be created */
    totalCreatedSize: number;
    /** Total size of files that would be modified */
    totalModifiedSize: number;
    /** Net size change */
    netSizeChange: number;
    /** Largest file operation */
    largestOperation: { path: string; size: number; type: string };
  };
}

/**
 * Performance metrics for dry run operations
 */
export interface DryRunPerformanceMetrics {
  /** Operations per second */
  operationsPerSecond: number;
  /** Bytes processed per second */
  bytesPerSecond: number;
  /** Most expensive operations */
  expensiveOperations: Array<{
    operation: FileOperation;
    estimatedCost: number;
  }>;
  /** Bottleneck analysis */
  bottlenecks: string[];
  /** Optimization suggestions */
  optimizationSuggestions: string[];
}

// =============================================================================
// STATISTICS CALCULATION
// =============================================================================

/**
 * Calculate comprehensive statistics from file operations
 */
export function createDryRunStatistics(
  operations: FileOperation[],
): DryRunStatistics {
  const stats: DryRunStatistics = {
    totalOperations: operations.length,
    filesCreated: 0,
    filesModified: 0,
    filesDeleted: 0,
    directoriesCreated: 0,
    readOperations: 0,
    writeOperations: 0,
    totalBytesWritten: 0,
    totalBytesRead: 0,
    successfulOperations: 0,
    failedOperations: 0,
    frequentPaths: [],
    operationsByType: {},
    estimatedMemoryUsage: 0,
    fileTypeDistribution: {},
    sizeImpact: {
      totalCreatedSize: 0,
      totalModifiedSize: 0,
      netSizeChange: 0,
      largestOperation: { path: "", size: 0, type: "" },
    },
  };

  const pathCounts = new Map<string, number>();
  const fileTypes = new Map<string, number>();
  const totalOperationTime = 0;
  let operationCount = 0;

  // Process each operation
  for (const operation of operations) {
    // Basic counts
    if (operation.success) {
      stats.successfulOperations++;
    } else {
      stats.failedOperations++;
    }

    // Operation type tracking
    stats.operationsByType[operation.type] =
      (stats.operationsByType[operation.type] || 0) + 1;

    // Path frequency tracking
    pathCounts.set(operation.path, (pathCounts.get(operation.path) || 0) + 1);

    // File type analysis
    const fileExtension = getFileExtension(operation.path);
    if (fileExtension) {
      fileTypes.set(fileExtension, (fileTypes.get(fileExtension) || 0) + 1);
    }

    // Operation-specific analysis
    switch (operation.type) {
      case "create":
        stats.filesCreated++;
        if (operation.newContent) {
          const size = calculateContentSize(operation.newContent);
          stats.totalBytesWritten += size;
          stats.sizeImpact.totalCreatedSize += size;
          stats.sizeImpact.netSizeChange += size;

          if (size > stats.sizeImpact.largestOperation.size) {
            stats.sizeImpact.largestOperation = {
              path: operation.path,
              size,
              type: "create",
            };
          }
        }
        break;

      case "write":
        stats.filesModified++;
        stats.writeOperations++;
        if (operation.newContent) {
          const newSize = calculateContentSize(operation.newContent);
          const oldSize = operation.previousContent
            ? calculateContentSize(operation.previousContent)
            : 0;

          stats.totalBytesWritten += newSize;
          stats.sizeImpact.totalModifiedSize += newSize;
          stats.sizeImpact.netSizeChange += newSize - oldSize;

          if (newSize > stats.sizeImpact.largestOperation.size) {
            stats.sizeImpact.largestOperation = {
              path: operation.path,
              size: newSize,
              type: "write",
            };
          }
        }
        break;

      case "read":
        stats.readOperations++;
        if (operation.previousContent) {
          stats.totalBytesRead += calculateContentSize(
            operation.previousContent,
          );
        }
        break;

      case "delete":
        stats.filesDeleted++;
        if (operation.previousContent) {
          const size = calculateContentSize(operation.previousContent);
          stats.sizeImpact.netSizeChange -= size;
        }
        break;

      case "mkdir":
        stats.directoriesCreated++;
        break;
    }

    // Performance timing (if available)
    if (operation.timestamp) {
      operationCount++;
    }
  }

  // Calculate frequent paths
  stats.frequentPaths = Array.from(pathCounts.entries())
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 most frequent

  // File type distribution
  stats.fileTypeDistribution = Object.fromEntries(fileTypes);

  // Memory usage estimation (rough calculation)
  stats.estimatedMemoryUsage = stats.totalBytesWritten + stats.totalBytesRead;

  // Average operation duration (if timing data available)
  if (operationCount > 0 && totalOperationTime > 0) {
    stats.averageOperationDuration = totalOperationTime / operationCount;
  }

  return stats;
}

/**
 * Calculate performance metrics from operations
 */
export function calculatePerformanceMetrics(
  operations: FileOperation[],
  executionTime: number,
): DryRunPerformanceMetrics {
  // For performance calculations, ensure minimum 1ms to avoid division by zero
  // and to provide meaningful metrics for very fast operations
  const minExecutionTime = Math.max(executionTime, 1);

  const totalBytes = operations.reduce((sum, op) => {
    const newSize = op.newContent ? calculateContentSize(op.newContent) : 0;
    const oldSize = op.previousContent
      ? calculateContentSize(op.previousContent)
      : 0;
    return sum + newSize + oldSize;
  }, 0);

  const metrics: DryRunPerformanceMetrics = {
    operationsPerSecond:
      operations.length > 0 ? (operations.length / minExecutionTime) * 1000 : 0,
    bytesPerSecond: totalBytes > 0 ? (totalBytes / minExecutionTime) * 1000 : 0,
    expensiveOperations: [],
    bottlenecks: [],
    optimizationSuggestions: [],
  };

  // Identify expensive operations
  const expensiveOps = operations
    .map((op) => ({
      operation: op,
      estimatedCost: estimateOperationCost(op),
    }))
    .sort((a, b) => b.estimatedCost - a.estimatedCost)
    .slice(0, 5);

  metrics.expensiveOperations = expensiveOps;

  // Bottleneck analysis
  const writeOps = operations.filter(
    (op) => op.type === "write" || op.type === "create",
  ).length;
  const readOps = operations.filter((op) => op.type === "read").length;

  if (writeOps > readOps * 2) {
    metrics.bottlenecks.push(
      "High write-to-read ratio may indicate inefficient file processing",
    );
  }

  const frequentPaths = new Map<string, number>();
  operations.forEach((op) => {
    frequentPaths.set(op.path, (frequentPaths.get(op.path) || 0) + 1);
  });

  const hotspots = Array.from(frequentPaths.entries()).filter(
    ([, count]) => count > 3,
  );
  if (hotspots.length > 0) {
    metrics.bottlenecks.push(
      `${hotspots.length} files accessed multiple times (potential hotspots)`,
    );
  }

  // Optimization suggestions
  if (operations.length > 100) {
    metrics.optimizationSuggestions.push(
      "Consider batching file operations for better performance",
    );
  }

  if (totalBytes > 10 * 1024 * 1024) {
    // > 10MB
    metrics.optimizationSuggestions.push(
      "Large amount of data being processed - consider streaming for memory efficiency",
    );
  }

  const largeFiles = operations.filter((op) => {
    const size = op.newContent ? calculateContentSize(op.newContent) : 0;
    return size > 1024 * 1024; // > 1MB
  });

  if (largeFiles.length > 0) {
    metrics.optimizationSuggestions.push(
      `${largeFiles.length} large files detected - consider compression or chunking`,
    );
  }

  return metrics;
}

/**
 * Generate summary statistics text
 */
export function formatStatisticsSummary(stats: DryRunStatistics): string {
  let summary = "📊 Dry Run Statistics Summary\n\n";

  summary += `🔢 Operation Counts:\n`;
  summary += `- Total operations: ${stats.totalOperations}\n`;
  summary += `- Successful: ${stats.successfulOperations}\n`;
  summary += `- Failed: ${stats.failedOperations}\n\n`;

  summary += `📁 File Operations:\n`;
  summary += `- Files to create: ${stats.filesCreated}\n`;
  summary += `- Files to modify: ${stats.filesModified}\n`;
  summary += `- Files to delete: ${stats.filesDeleted}\n`;
  summary += `- Directories to create: ${stats.directoriesCreated}\n\n`;

  summary += `📊 Data Volume:\n`;
  summary += `- Total bytes to write: ${formatBytes(stats.totalBytesWritten)}\n`;
  summary += `- Total bytes to read: ${formatBytes(stats.totalBytesRead)}\n`;
  summary += `- Net size change: ${formatBytes(stats.sizeImpact.netSizeChange)}\n`;
  summary += `- Estimated memory usage: ${formatBytes(stats.estimatedMemoryUsage)}\n\n`;

  if (stats.sizeImpact.largestOperation.size > 0) {
    summary += `🎯 Largest Operation:\n`;
    summary += `- File: ${stats.sizeImpact.largestOperation.path}\n`;
    summary += `- Size: ${formatBytes(stats.sizeImpact.largestOperation.size)}\n`;
    summary += `- Type: ${stats.sizeImpact.largestOperation.type}\n\n`;
  }

  if (stats.frequentPaths.length > 0) {
    summary += `🔥 Most Frequent Paths:\n`;
    stats.frequentPaths.slice(0, 5).forEach((item) => {
      summary += `- ${item.path} (${item.count} operations)\n`;
    });
    summary += "\n";
  }

  if (Object.keys(stats.fileTypeDistribution).length > 0) {
    summary += `📄 File Types:\n`;
    Object.entries(stats.fileTypeDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .forEach(([type, count]) => {
        summary += `- ${type}: ${count} files\n`;
      });
  }

  return summary;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate the size of content in bytes
 */
function calculateContentSize(content: string | Buffer): number {
  if (Buffer.isBuffer(content)) {
    return content.length;
  }
  return Buffer.byteLength(content, "utf8");
}

/**
 * Get file extension from path
 */
function getFileExtension(path: string): string {
  const lastDot = path.lastIndexOf(".");
  const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));

  if (lastDot > lastSlash && lastDot < path.length - 1) {
    return path.substring(lastDot + 1).toLowerCase();
  }

  return "no-extension";
}

/**
 * Estimate the computational cost of an operation
 */
function estimateOperationCost(operation: FileOperation): number {
  let cost = 1; // Base cost

  // Size-based cost
  if (operation.newContent) {
    cost += calculateContentSize(operation.newContent) / 1024; // KB contribution
  }

  if (operation.previousContent) {
    cost += calculateContentSize(operation.previousContent) / 1024; // KB contribution
  }

  // Operation type multipliers
  switch (operation.type) {
    case "read":
      cost *= 1; // Base cost
      break;
    case "write":
    case "create":
      cost *= 2; // Write operations are more expensive
      break;
    case "delete":
      cost *= 1.5; // Deletion has moderate cost
      break;
    case "mkdir":
      cost *= 0.5; // Directory creation is cheap
      break;
    default:
      cost *= 1;
  }

  return cost;
}

/**
 * Format bytes as human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Compare two statistics objects and highlight differences
 */
export function compareStatistics(
  before: DryRunStatistics,
  after: DryRunStatistics,
): {
  differences: Record<
    string,
    { before: number; after: number; change: number }
  >;
  summary: string;
} {
  const differences: Record<
    string,
    { before: number; after: number; change: number }
  > = {};

  // Compare key metrics
  const metrics = [
    "totalOperations",
    "filesCreated",
    "filesModified",
    "filesDeleted",
    "totalBytesWritten",
    "totalBytesRead",
    "successfulOperations",
    "failedOperations",
  ];

  for (const metric of metrics) {
    const beforeVal = before[metric as keyof DryRunStatistics] as number;
    const afterVal = after[metric as keyof DryRunStatistics] as number;

    if (beforeVal !== afterVal) {
      differences[metric] = {
        before: beforeVal,
        after: afterVal,
        change: afterVal - beforeVal,
      };
    }
  }

  // Generate summary
  let summary = "📊 Statistics Comparison\n\n";

  if (Object.keys(differences).length === 0) {
    summary += "No significant changes detected.\n";
  } else {
    for (const [metric, data] of Object.entries(differences)) {
      const direction = data.change > 0 ? "↗️" : "↘️";
      summary += `${direction} ${metric}: ${data.before} → ${data.after} (${data.change > 0 ? "+" : ""}${data.change})\n`;
    }
  }

  return { differences, summary };
}
