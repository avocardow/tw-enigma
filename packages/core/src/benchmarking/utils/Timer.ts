import { performance } from 'perf_hooks';

/**
 * High-precision timer for benchmarking operations
 */
export class BenchmarkTimer {
  private startTime?: number;
  private endTime?: number;
  private isRunning = false;

  /**
   * Start the timer
   */
  start(): void {
    if (this.isRunning) {
      throw new Error('Timer is already running');
    }
    
    this.startTime = performance.now();
    this.endTime = undefined;
    this.isRunning = true;
  }

  /**
   * Stop the timer
   */
  stop(): number {
    if (!this.isRunning) {
      throw new Error('Timer is not running');
    }
    
    this.endTime = performance.now();
    this.isRunning = false;
    
    return this.getDuration();
  }

  /**
   * Get elapsed time in milliseconds
   */
  getDuration(): number {
    if (this.startTime === undefined) {
      return 0;
    }
    
    const end = this.endTime ?? performance.now();
    return end - this.startTime;
  }

  /**
   * Get elapsed time as human-readable string
   */
  getFormattedDuration(): string {
    const duration = this.getDuration();
    
    if (duration < 1) {
      return `${(duration * 1000).toFixed(2)}μs`;
    } else if (duration < 1000) {
      return `${duration.toFixed(2)}ms`;
    } else if (duration < 60000) {
      return `${(duration / 1000).toFixed(2)}s`;
    } else {
      const minutes = Math.floor(duration / 60000);
      const seconds = ((duration % 60000) / 1000).toFixed(2);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * Reset the timer
   */
  reset(): void {
    this.startTime = undefined;
    this.endTime = undefined;
    this.isRunning = false;
  }

  /**
   * Check if timer is currently running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get current elapsed time without stopping the timer
   */
  getCurrentDuration(): number {
    if (!this.isRunning || this.startTime === undefined) {
      return 0;
    }
    
    return performance.now() - this.startTime;
  }

  /**
   * Create a new timer instance
   */
  static create(): BenchmarkTimer {
    return new BenchmarkTimer();
  }

  /**
   * Time a function execution
   */
  static async time<T>(fn: () => Promise<T> | T): Promise<{ result: T; duration: number }> {
    const timer = new BenchmarkTimer();
    timer.start();
    
    try {
      const result = await fn();
      const duration = timer.stop();
      return { result, duration };
    } catch (error) {
      timer.stop();
      throw error;
    }
  }

  /**
   * Time a synchronous function execution
   */
  static timeSync<T>(fn: () => T): { result: T; duration: number } {
    const timer = new BenchmarkTimer();
    timer.start();
    
    try {
      const result = fn();
      const duration = timer.stop();
      return { result, duration };
    } catch (error) {
      timer.stop();
      throw error;
    }
  }
}