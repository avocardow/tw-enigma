/**
 * Generic Batch Worker for Tailwind Enigma Core
 * 
 * This worker handles various types of CPU-intensive tasks in a separate thread
 * including CSS parsing, file analysis, and batch processing operations.
 */

import { parentPort, workerData } from 'worker_threads';
import { performance } from 'perf_hooks';

/**
 * Task message interface
 */
interface TaskMessage {
  type: 'task';
  id: string;
  taskType: string;
  data: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Result message interface
 */
interface ResultMessage {
  type: 'taskComplete';
  id: string;
  result?: unknown;
  error?: { message: string; stack?: string };
  executionTime: number;
  memoryUsage: number;
}

/**
 * Task handlers for different operation types
 */
const taskHandlers = {
  /**
   * CSS parsing and analysis task
   */
  async cssAnalysis(data: {
    content: string;
    filePath: string;
    extractClasses?: boolean;
    extractVariables?: boolean;
  }) {
    const startTime = performance.now();
    
    // Basic CSS class extraction (can be enhanced with proper CSS parser)
    const classMatches = data.extractClasses 
      ? Array.from(data.content.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g))
          .map(match => match[1])
          .filter((className, index, array) => array.indexOf(className) === index)
      : [];

    // CSS variable extraction
    const variableMatches = data.extractVariables
      ? Array.from(data.content.matchAll(/--([a-zA-Z_-][a-zA-Z0-9_-]*)/g))
          .map(match => match[1])
          .filter((varName, index, array) => array.indexOf(varName) === index)
      : [];

    // Basic metrics
    const lines = data.content.split('\n').length;
    const size = Buffer.byteLength(data.content, 'utf8');
    const rules = (data.content.match(/\{[^}]*\}/g) || []).length;

    return {
      filePath: data.filePath,
      classes: classMatches,
      variables: variableMatches,
      metrics: {
        lines,
        size,
        rules,
        processingTime: performance.now() - startTime,
      },
    };
  },

  /**
   * File content analysis task
   */
  async fileAnalysis(data: {
    content: string;
    filePath: string;
    fileType: string;
    patterns?: string[];
  }) {
    const startTime = performance.now();
    
    // Extract various patterns based on file type
    const results: Record<string, string[]> = {};
    
    if (data.patterns) {
      for (const pattern of data.patterns) {
        try {
          const regex = new RegExp(pattern, 'g');
          const matches = Array.from(data.content.matchAll(regex))
            .map(match => match[0])
            .filter((match, index, array) => array.indexOf(match) === index);
          results[pattern] = matches;
        } catch (error) {
          // Invalid regex, skip
          results[pattern] = [];
        }
      }
    }

    // File-type specific analysis
    let typeSpecificResults = {};
    
    switch (data.fileType) {
      case 'html':
        typeSpecificResults = {
          classes: Array.from(data.content.matchAll(/class="([^"]*)"/g))
            .map(match => match[1].split(/\s+/))
            .flat()
            .filter(Boolean),
          ids: Array.from(data.content.matchAll(/id="([^"]*)"/g))
            .map(match => match[1]),
          tags: Array.from(data.content.matchAll(/<(\w+)/g))
            .map(match => match[1])
            .filter((tag, index, array) => array.indexOf(tag) === index),
        };
        break;
        
      case 'jsx':
      case 'tsx':
        typeSpecificResults = {
          className: Array.from(data.content.matchAll(/className="([^"]*)"/g))
            .map(match => match[1].split(/\s+/))
            .flat()
            .filter(Boolean),
          components: Array.from(data.content.matchAll(/<([A-Z]\w*)/g))
            .map(match => match[1])
            .filter((comp, index, array) => array.indexOf(comp) === index),
        };
        break;
        
      case 'vue':
        typeSpecificResults = {
          classes: Array.from(data.content.matchAll(/(?:class|:class)="([^"]*)"/g))
            .map(match => match[1].split(/\s+/))
            .flat()
            .filter(Boolean),
          vueDirectives: Array.from(data.content.matchAll(/v-(\w+)/g))
            .map(match => match[1])
            .filter((dir, index, array) => array.indexOf(dir) === index),
        };
        break;
    }

    return {
      filePath: data.filePath,
      fileType: data.fileType,
      patterns: results,
      typeSpecific: typeSpecificResults,
      metrics: {
        lines: data.content.split('\n').length,
        size: Buffer.byteLength(data.content, 'utf8'),
        processingTime: performance.now() - startTime,
      },
    };
  },

  /**
   * Batch processing task for multiple items
   */
  async batchProcess(data: {
    items: unknown[];
    operation: string;
    options?: Record<string, unknown>;
  }) {
    const startTime = performance.now();
    const results = [];
    
    for (const item of data.items) {
      try {
        // Process each item based on operation type
        let result;
        
        switch (data.operation) {
          case 'validate':
            result = await validateItem(item, data.options);
            break;
          case 'transform':
            result = await transformItem(item, data.options);
            break;
          case 'analyze':
            result = await analyzeItem(item, data.options);
            break;
          default:
            result = { error: `Unknown operation: ${data.operation}` };
        }
        
        results.push(result);
      } catch (error) {
        results.push({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      results,
      totalItems: data.items.length,
      successCount: results.filter(r => !r.error).length,
      errorCount: results.filter(r => r.error).length,
      processingTime: performance.now() - startTime,
    };
  },

  /**
   * Generic data processing task
   */
  async dataProcessing(data: {
    input: unknown;
    algorithm: string;
    parameters?: Record<string, unknown>;
  }) {
    const startTime = performance.now();
    
    let result;
    
    switch (data.algorithm) {
      case 'sort':
        result = Array.isArray(data.input) 
          ? [...data.input].sort()
          : { error: 'Input must be an array for sorting' };
        break;
        
      case 'filter':
        if (Array.isArray(data.input) && data.parameters?.condition) {
          try {
            // Simple filter based on string condition
            const condition = data.parameters.condition as string;
            result = data.input.filter(item => 
              typeof item === 'string' && item.includes(condition)
            );
          } catch (error) {
            result = { error: 'Invalid filter condition' };
          }
        } else {
          result = { error: 'Invalid input or missing condition for filtering' };
        }
        break;
        
      case 'deduplicate':
        result = Array.isArray(data.input)
          ? [...new Set(data.input)]
          : { error: 'Input must be an array for deduplication' };
        break;
        
      default:
        result = { error: `Unknown algorithm: ${data.algorithm}` };
    }

    return {
      result,
      processingTime: performance.now() - startTime,
    };
  },
};

/**
 * Helper functions for batch processing
 */
async function validateItem(item: unknown, options?: Record<string, unknown>) {
  // Basic validation logic
  if (typeof item === 'string' && item.length > 0) {
    return { valid: true, item };
  }
  return { valid: false, item, reason: 'Invalid item' };
}

async function transformItem(item: unknown, options?: Record<string, unknown>) {
  // Basic transformation logic
  if (typeof item === 'string') {
    const transform = options?.transform as string || 'uppercase';
    switch (transform) {
      case 'uppercase':
        return { transformed: item.toUpperCase(), original: item };
      case 'lowercase':
        return { transformed: item.toLowerCase(), original: item };
      case 'trim':
        return { transformed: item.trim(), original: item };
      default:
        return { transformed: item, original: item };
    }
  }
  return { error: 'Can only transform strings' };
}

async function analyzeItem(item: unknown, options?: Record<string, unknown>) {
  // Basic analysis logic
  if (typeof item === 'string') {
    return {
      type: 'string',
      length: item.length,
      words: item.split(/\s+/).length,
      characters: item.length,
      lines: item.split('\n').length,
    };
  } else if (Array.isArray(item)) {
    return {
      type: 'array',
      length: item.length,
      types: [...new Set(item.map(i => typeof i))],
    };
  } else if (typeof item === 'object' && item !== null) {
    return {
      type: 'object',
      keys: Object.keys(item).length,
      keyNames: Object.keys(item),
    };
  }
  return {
    type: typeof item,
    value: item,
  };
}

/**
 * Get current memory usage
 */
function getMemoryUsage(): number {
  return process.memoryUsage().heapUsed;
}

/**
 * Main worker message handler
 */
if (parentPort) {
  parentPort.on('message', async (message: TaskMessage) => {
    const startTime = performance.now();
    const startMemory = getMemoryUsage();
    
    try {
      if (message.type === 'task') {
        // Find and execute the appropriate task handler
        const handler = taskHandlers[message.taskType as keyof typeof taskHandlers];
        
        if (!handler) {
          throw new Error(`Unknown task type: ${message.taskType}`);
        }
        
        const result = await handler(message.data as any);
        const executionTime = performance.now() - startTime;
        const memoryUsage = getMemoryUsage() - startMemory;
        
        const response: ResultMessage = {
          type: 'taskComplete',
          id: message.id,
          result,
          executionTime,
          memoryUsage,
        };
        
        parentPort!.postMessage(response);
      }
    } catch (error) {
      const executionTime = performance.now() - startTime;
      const memoryUsage = getMemoryUsage() - startMemory;
      
      const response: ResultMessage = {
        type: 'taskComplete',
        id: message.id,
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        executionTime,
        memoryUsage,
      };
      
      parentPort!.postMessage(response);
    }
  });

  // Send ready signal
  parentPort.postMessage({ type: 'ready' });
}

// Handle worker termination
process.on('SIGTERM', () => {
  process.exit(0);
});

process.on('SIGINT', () => {
  process.exit(0);
}); 