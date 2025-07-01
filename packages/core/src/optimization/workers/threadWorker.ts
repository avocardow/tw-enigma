/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { parentPort, workerData, isMainThread } from 'worker_threads';
import { z } from 'zod';

if (isMainThread) {
  throw new Error('This script should only be run in a worker thread');
}

/**
 * Worker message schema
 */
const WorkerMessageSchema = z.object({
  type: z.enum(['task', 'shutdown', 'health-check']),
  task: z.object({
    id: z.string(),
    type: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    data: z.any(),
    dependencies: z.array(z.string()).optional(),
    maxRetries: z.number().optional(),
    timeout: z.number().optional(),
    requiresLock: z.array(z.string()).optional(),
    metadata: z.record(z.any()).optional(),
  }).optional(),
});

/**
 * Task execution context
 */
interface TaskExecutionContext {
  startTime: number;
  memoryBefore: number;
  cpuBefore: NodeJS.CpuUsage;
}

/**
 * Worker performance metrics
 */
interface WorkerMetrics {
  tasksCompleted: number;
  tasksDeferred: number;
  tasksFailed: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  memoryUsage: {
    current: number;
    peak: number;
    average: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  lastActivity: number;
}

class ThreadWorker {
  private workerId: string;
  private isShuttingDown = false;
  private metrics: WorkerMetrics;
  private taskQueue: any[] = [];
  private currentTask: any = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.workerId = workerData?.workerId || `worker-${process.pid}`;
    this.metrics = this.initializeMetrics();
    this.setupMessageHandler();
    this.startHealthMonitoring();
  }

  private initializeMetrics(): WorkerMetrics {
    return {
      tasksCompleted: 0,
      tasksDeferred: 0,
      tasksFailed: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      memoryUsage: {
        current: process.memoryUsage().heapUsed,
        peak: process.memoryUsage().heapUsed,
        average: process.memoryUsage().heapUsed,
      },
      cpuUsage: {
        user: 0,
        system: 0,
      },
      lastActivity: Date.now(),
    };
  }

  private setupMessageHandler(): void {
    if (!parentPort) {
      throw new Error('Parent port not available');
    }

    parentPort.on('message', async (message) => {
      try {
        const validatedMessage = WorkerMessageSchema.parse(message);
        await this.handleMessage(validatedMessage);
      } catch (error) {
        this.sendResponse({
          type: 'error',
          error: error instanceof Error ? error.message : 'Invalid message format',
          workerId: this.workerId,
        });
      }
    });

    parentPort.on('error', (error) => {
      this.sendResponse({
        type: 'error',
        error: error.message,
        workerId: this.workerId,
      });
    });
  }

  private async handleMessage(message: z.infer<typeof WorkerMessageSchema>): Promise<void> {
    switch (message.type) {
      case 'task':
        if (message.task) {
          await this.executeTask(message.task);
        }
        break;
      
      case 'shutdown':
        await this.shutdown();
        break;
      
      case 'health-check':
        this.sendHealthStatus();
        break;
    }
  }

  private async executeTask(task: any): Promise<void> {
    const context = this.createExecutionContext();
    this.currentTask = task;
    this.metrics.lastActivity = Date.now();

    try {
      // Check if we can execute this task
      if (this.isShuttingDown) {
        this.sendResponse({
          type: 'taskDeferred',
          taskId: task.id,
          reason: 'Worker shutting down',
          workerId: this.workerId,
        });
        this.metrics.tasksDeferred++;
        return;
      }

      // Execute task with timeout
      const timeoutMs = task.timeout || 60000;
      const result = await Promise.race([
        this.performTaskExecution(task),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Task timeout')), timeoutMs)
        ),
      ]);

      const executionTime = Date.now() - context.startTime;
      this.updateMetrics(context, executionTime, true);

      this.sendResponse({
        type: 'taskComplete',
        taskId: task.id,
        result,
        metrics: {
          executionTime,
          memoryUsed: process.memoryUsage().heapUsed - context.memoryBefore,
          cpuUsed: this.calculateCpuDelta(context.cpuBefore),
        },
        workerId: this.workerId,
      });

      this.metrics.tasksCompleted++;
    } catch (error) {
      const executionTime = Date.now() - context.startTime;
      this.updateMetrics(context, executionTime, false);

      this.sendResponse({
        type: 'taskError',
        taskId: task.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        metrics: {
          executionTime,
          memoryUsed: process.memoryUsage().heapUsed - context.memoryBefore,
        },
        workerId: this.workerId,
      });

      this.metrics.tasksFailed++;
    } finally {
      this.currentTask = null;
    }
  }

  private createExecutionContext(): TaskExecutionContext {
    return {
      startTime: Date.now(),
      memoryBefore: process.memoryUsage().heapUsed,
      cpuBefore: process.cpuUsage(),
    };
  }

  private async performTaskExecution(task: any): Promise<any> {
    switch (task.type) {
      case 'css-optimization':
        return await this.optimizeCss(task.data);
      
      case 'pattern-analysis':
        return await this.analyzePatterns(task.data);
      
      case 'file-processing':
        return await this.processFiles(task.data);
      
      case 'utility-extraction':
        return await this.extractUtilities(task.data);
      
      case 'minification':
        return await this.minifyCss(task.data);
      
      case 'validation':
        return await this.validateCss(task.data);
      
      case 'work-stealing-task':
        return await this.executeWorkStealingTask(task.data);
      
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  private async optimizeCss(data: any): Promise<any> {
    // Simulate CSS optimization work
    const { css, options } = data;
    
    // Perform optimization steps
    let optimized = css;
    
    if (options.removeComments) {
      optimized = optimized.replace(/\/\*[\s\S]*?\*\//g, '');
    }
    
    if (options.minify) {
      optimized = optimized.replace(/\s+/g, ' ').trim();
    }
    
    if (options.removeUnused) {
      // Simulate unused CSS removal
      optimized = optimized.replace(/\.unused-\w+[^}]*}/g, '');
    }
    
    return {
      originalSize: css.length,
      optimizedSize: optimized.length,
      optimized,
      compressionRatio: (css.length - optimized.length) / css.length,
    };
  }

  private async analyzePatterns(data: any): Promise<any> {
    // Simulate pattern analysis
    const { patterns, options } = data;
    
    const analysis = {
      totalPatterns: patterns.length,
      uniquePatterns: new Set(patterns).size,
      frequency: {},
      recommendations: [],
    };
    
    // Count pattern frequency
    patterns.forEach((pattern: string) => {
      analysis.frequency[pattern] = (analysis.frequency[pattern] || 0) + 1;
    });
    
    // Generate recommendations
    const frequentPatterns = Object.entries(analysis.frequency)
      .filter(([_, count]) => count > 5)
      .map(([pattern, _]) => pattern);
    
    if (frequentPatterns.length > 0) {
      analysis.recommendations.push(
        `Consider creating utility classes for frequently used patterns: ${frequentPatterns.slice(0, 3).join(', ')}`
      );
    }
    
    return analysis;
  }

  private async processFiles(data: any): Promise<any> {
    // Simulate file processing
    const { files, operations } = data;
    
    const results = [];
    
    for (const file of files) {
      const result = {
        file: file.path,
        operations: [],
        size: file.content?.length || 0,
        processed: true,
      };
      
      for (const operation of operations) {
        // Simulate operation processing time
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        
        result.operations.push({
          type: operation,
          success: true,
          duration: Math.random() * 100,
        });
      }
      
      results.push(result);
    }
    
    return {
      processedFiles: results.length,
      totalOperations: results.reduce((sum, r) => sum + r.operations.length, 0),
      results,
    };
  }

  private async extractUtilities(data: any): Promise<any> {
    // Simulate utility extraction
    const { css, options } = data;
    
    const utilities = [];
    const utilityPattern = /\.([\w-]+)\s*\{[^}]+\}/g;
    let match;
    
    while ((match = utilityPattern.exec(css)) !== null) {
      utilities.push({
        className: match[1],
        definition: match[0],
        frequency: 1,
      });
    }
    
    return {
      extractedUtilities: utilities.length,
      utilities: utilities.slice(0, 50), // Limit output size
      coverage: utilities.length / (css.length / 100),
    };
  }

  private async minifyCss(data: any): Promise<any> {
    // Simulate CSS minification
    const { css } = data;
    
    let minified = css
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/;\s*}/g, '}') // Remove trailing semicolons
      .replace(/\s*{\s*/g, '{') // Clean brackets
      .replace(/\s*}\s*/g, '}')
      .replace(/\s*,\s*/g, ',') // Clean commas
      .replace(/\s*:\s*/g, ':') // Clean colons
      .replace(/\s*;\s*/g, ';') // Clean semicolons
      .trim();
    
    return {
      originalSize: css.length,
      minifiedSize: minified.length,
      minified,
      compressionRatio: (css.length - minified.length) / css.length,
      savings: css.length - minified.length,
    };
  }

  private async validateCss(data: any): Promise<any> {
    // Simulate CSS validation
    const { css, rules } = data;
    
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      score: 100,
    };
    
    // Check for common issues
    if (css.includes('!important')) {
      validation.warnings.push('Excessive use of !important detected');
      validation.score -= 10;
    }
    
    if (css.match(/\{[^}]{200,}/)) {
      validation.warnings.push('Very long CSS rules detected');
      validation.score -= 5;
    }
    
    // Validate against rules if provided
    if (rules) {
      rules.forEach((rule: any) => {
        if (rule.type === 'no-ids' && css.includes('#')) {
          validation.errors.push('ID selectors not allowed');
          validation.isValid = false;
          validation.score -= 20;
        }
      });
    }
    
    return validation;
  }

  private async executeWorkStealingTask(data: any): Promise<any> {
    // Simulate work-stealing compatible task
    const { items, operation } = data;
    
    const results = [];
    
    for (const item of items) {
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
      
      let result;
      switch (operation) {
        case 'transform':
          result = { ...item, transformed: true, timestamp: Date.now() };
          break;
        case 'validate':
          result = { ...item, valid: true, checked: Date.now() };
          break;
        case 'optimize':
          result = { ...item, optimized: true, score: Math.random() };
          break;
        default:
          result = { ...item, processed: true };
      }
      
      results.push(result);
    }
    
    return {
      processedItems: results.length,
      operation,
      results,
    };
  }

  private updateMetrics(context: TaskExecutionContext, executionTime: number, success: boolean): void {
    this.metrics.totalExecutionTime += executionTime;
    this.metrics.averageExecutionTime = this.metrics.totalExecutionTime / 
      (this.metrics.tasksCompleted + this.metrics.tasksFailed + 1);
    
    const currentMemory = process.memoryUsage().heapUsed;
    this.metrics.memoryUsage.current = currentMemory;
    this.metrics.memoryUsage.peak = Math.max(this.metrics.memoryUsage.peak, currentMemory);
    
    // Update average memory (simple moving average)
    const totalTasks = this.metrics.tasksCompleted + this.metrics.tasksFailed + 1;
    this.metrics.memoryUsage.average = 
      (this.metrics.memoryUsage.average * (totalTasks - 1) + currentMemory) / totalTasks;
    
    const cpuDelta = this.calculateCpuDelta(context.cpuBefore);
    this.metrics.cpuUsage.user += cpuDelta.user;
    this.metrics.cpuUsage.system += cpuDelta.system;
  }

  private calculateCpuDelta(before: NodeJS.CpuUsage): { user: number; system: number } {
    const current = process.cpuUsage();
    return {
      user: current.user - before.user,
      system: current.system - before.system,
    };
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.sendHealthStatus();
    }, 30000); // Every 30 seconds
  }

  private sendHealthStatus(): void {
    this.sendResponse({
      type: 'health',
      workerId: this.workerId,
      status: 'healthy',
      metrics: this.metrics,
      currentTask: this.currentTask?.id || null,
      uptime: Date.now() - (workerData?.startTime || Date.now()),
    });
  }

  private sendResponse(response: any): void {
    if (parentPort && !this.isShuttingDown) {
      parentPort.postMessage(response);
    }
  }

  private async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Wait for current task to complete or timeout
    if (this.currentTask) {
      const maxWait = 5000; // 5 seconds
      const start = Date.now();
      
      while (this.currentTask && (Date.now() - start) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    this.sendResponse({
      type: 'shutdown-complete',
      workerId: this.workerId,
      finalMetrics: this.metrics,
    });
    
    process.exit(0);
  }
}

// Initialize worker
new ThreadWorker();