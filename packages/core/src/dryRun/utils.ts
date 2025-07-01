/**
 * Dry Run Utilities
 * Convenience functions for common dry run operations
 */

import { getDryRunManager } from './dryRunManager';
import { getFileSystemInterceptor } from './fileSystemInterceptor';
import type { DryRunContext, DryRunConfig, DryRunResult } from './dryRunManager';

/**
 * Start a dry run session with file system interception
 */
export function startDryRun(
  metadata: DryRunContext['metadata'],
  config?: Partial<DryRunConfig>
): string {
  const manager = getDryRunManager();
  const interceptor = getFileSystemInterceptor();

  // Start the session
  const sessionId = manager.startSession(metadata, config);

  // Enable file system interception
  interceptor.updateOptions({ enabled: true });
  interceptor.install();

  return sessionId;
}

/**
 * End the current dry run session and get results
 */
export function endDryRun(sessionId?: string): DryRunResult {
  const manager = getDryRunManager();
  const interceptor = getFileSystemInterceptor();

  // Uninstall file system interception
  interceptor.uninstall();
  interceptor.updateOptions({ enabled: false });

  // End the session and return results
  return manager.endSession(sessionId);
}

/**
 * Execute a function in dry run mode
 */
export async function withDryRun<T>(
  metadata: DryRunContext['metadata'],
  fn: () => Promise<T> | T,
  config?: Partial<DryRunConfig>
): Promise<{ result: T; dryRunResult: DryRunResult }> {
  const sessionId = startDryRun(metadata, config);
  
  try {
    const result = await fn();
    const dryRunResult = endDryRun(sessionId);
    
    return { result, dryRunResult };
  } catch (error) {
    // Ensure cleanup even if the function throws
    try {
      endDryRun(sessionId);
    } catch (cleanupError) {
      // Log cleanup error but don't mask the original error
      console.warn('Failed to cleanup dry run session:', cleanupError);
    }
    throw error;
  }
}

/**
 * Check if dry run mode is currently active
 */
export function isDryRunActive(): boolean {
  const manager = getDryRunManager();
  return manager.isActive();
}

/**
 * Get the current dry run context if active
 */
export function getCurrentDryRunContext(): DryRunContext | null {
  const manager = getDryRunManager();
  
  try {
    return manager.getActiveContext();
  } catch {
    return null;
  }
}

/**
 * Record a custom operation in the current dry run session
 */
export function recordDryRunOperation(
  type: DryRunContext['operations'][0]['type'],
  target: string,
  description: string,
  data?: any
): string | null {
  const manager = getDryRunManager();
  
  if (!manager.isActive()) {
    return null;
  }

  return manager.recordOperation({
    type,
    target,
    description,
    data,
  });
}

/**
 * Create a dry run configuration for different scenarios
 */
export function createDryRunConfig(scenario: 'development' | 'production' | 'testing'): DryRunConfig {
  const baseConfig: DryRunConfig = {
    enabled: true,
    logOperations: true,
    validateOperations: true,
    maxOperations: 10000,
    includeFileSystemChecks: true,
    simulateLatency: false,
    operationTimeout: 5000,
  };

  switch (scenario) {
    case 'development':
      return {
        ...baseConfig,
        logOperations: true,
        validateOperations: true,
        simulateLatency: false,
        maxOperations: 5000,
      };

    case 'production':
      return {
        ...baseConfig,
        logOperations: false,
        validateOperations: true,
        simulateLatency: true,
        maxOperations: 50000,
        operationTimeout: 10000,
      };

    case 'testing':
      return {
        ...baseConfig,
        logOperations: true,
        validateOperations: false, // Faster for tests
        simulateLatency: false,
        maxOperations: 1000,
        operationTimeout: 1000,
      };

    default:
      return baseConfig;
  }
}

/**
 * Format dry run results for display
 */
export function formatDryRunSummary(result: DryRunResult): string {
  const { summary, duration, totalOperations } = result;
  
  const lines = [
    '=== Dry Run Summary ===',
    `Session Duration: ${Math.round(duration)}ms`,
    `Total Operations: ${totalOperations}`,
    '',
    'File Operations:',
    `  Would Create: ${summary.filesWouldBeCreated} files`,
    `  Would Modify: ${summary.filesWouldBeModified} files`,
    `  Would Delete: ${summary.filesWouldBeDeleted} files`,
    '',
    'Directory Operations:',
    `  Would Create: ${summary.directoriesWouldBeCreated} directories`,
    `  Would Delete: ${summary.directoriesWouldBeDeleted} directories`,
    '',
    'Impact:',
    `  Size Change: ${formatBytes(summary.totalSizeImpact)}`,
    `  Estimated Duration: ${Math.round(summary.estimatedDuration)}ms`,
    `  Potential Errors: ${summary.potentialErrors}`,
  ];

  if (summary.potentialErrors > 0) {
    lines.push('', '⚠️  Review potential errors before proceeding');
  }

  return lines.join('\n');
}

/**
 * Helper function to format bytes
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  
  const value = bytes / Math.pow(k, i);
  const sign = bytes < 0 ? '-' : '+';
  
  return `${sign}${parseFloat(value.toFixed(2))} ${sizes[i]}`;
}

/**
 * Validate dry run results for safety
 */
export function validateDryRunSafety(result: DryRunResult): {
  safe: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  const { summary, operationsByType } = result;

  // Check for dangerous operations
  if (summary.filesWouldBeDeleted > 100) {
    warnings.push(`Large number of file deletions: ${summary.filesWouldBeDeleted}`);
  }

  if (summary.directoriesWouldBeDeleted > 10) {
    warnings.push(`Large number of directory deletions: ${summary.directoriesWouldBeDeleted}`);
  }

  // Check for potential errors
  if (summary.potentialErrors > 0) {
    errors.push(`${summary.potentialErrors} operations may fail`);
  }

  // Check for size impact
  const sizeMB = Math.abs(summary.totalSizeImpact) / (1024 * 1024);
  if (sizeMB > 100) {
    warnings.push(`Large size impact: ${formatBytes(summary.totalSizeImpact)}`);
  }

  // Check for system file operations
  const systemPaths = ['/etc/', '/usr/', '/bin/', '/sbin/', '/var/', '/tmp/'];
  const systemOperations = Object.values(operationsByType)
    .flat()
    .filter(op => systemPaths.some(path => op.target.startsWith(path)));

  if (systemOperations.length > 0) {
    errors.push(`Operations targeting system directories: ${systemOperations.length}`);
  }

  return {
    safe: errors.length === 0,
    warnings,
    errors,
  };
}