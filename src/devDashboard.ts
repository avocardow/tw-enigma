/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from "events";
import { createServer, Server } from "http";
import { createLogger, Logger } from "./logger";
import { EnigmaConfig } from "./config";
import { DevDiagnostics, DevPerformanceMetrics } from "./devDiagnostics";
import { DevPreview } from "./devPreview";
import { DebugUtils } from "./debugUtils";
import { SourceMapGenerator } from "./sourceMapGenerator";

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  enabled: boolean;
  port: number;
  host: string;
  updateInterval: number;
  maxLogEntries: number;
  showMetrics: boolean;
  showLogs: boolean;
  showPreview: boolean;
  showDebug: boolean;
  autoRefresh: boolean;
  theme: 'light' | 'dark' | 'auto';
}

/**
 * Dashboard metrics
 */
export interface DashboardMetrics {
  timestamp: Date;
  performance: DevPerformanceMetrics;
  optimization: {
    totalFiles: number;
    totalClasses: number;
    optimizedClasses: number;
    sizeReduction: number;
    processingTime: number;
  };
  system: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    activeConnections: number;
  };
}

/**
 * Dashboard log entry
 */
export interface DashboardLogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  module: string;
  data?: any;
}

/**
 * Dashboard events
 */
export interface DashboardEvents {
  'metrics-update': (metrics: DashboardMetrics) => void;
  'log-entry': (entry: DashboardLogEntry) => void;
  'client-connected': (clientId: string) => void;
  'client-disconnected': (clientId: string) => void;
  'error': (error: Error) => void;
}

/**
 * Developer dashboard with performance monitoring
 * Provides a web-based interface for development tools and real-time metrics
 */
export class DevDashboard extends EventEmitter {
  private config: DashboardConfig;
  private logger: Logger;
  private server?: Server;
  private diagnostics?: DevDiagnostics;
  private preview?: DevPreview;
  private debugUtils?: DebugUtils;
  private sourceMapGenerator?: SourceMapGenerator;
  private isRunning = false;
  private clients: Set<any> = new Set();
  private metricsHistory: DashboardMetrics[] = [];
  private logEntries: DashboardLogEntry[] = [];
  private metricsInterval?: NodeJS.Timeout;
  private startTime: number;

  constructor(
    config: Partial<DashboardConfig> = {},
    diagnostics?: DevDiagnostics,
    preview?: DevPreview,
    debugUtils?: DebugUtils,
    sourceMapGenerator?: SourceMapGenerator
  ) {
    super();
    
    this.config = {
      enabled: true,
      port: 3000,
      host: 'localhost',
      updateInterval: 1000,
      maxLogEntries: 1000,
      showMetrics: true,
      showLogs: true,
      showPreview: true,
      showDebug: true,
      autoRefresh: true,
      theme: 'dark',
      ...config,
    };

    this.logger = createLogger("DevDashboard");
    this.diagnostics = diagnostics;
    this.preview = preview;
    this.debugUtils = debugUtils;
    this.sourceMapGenerator = sourceMapGenerator;
    this.startTime = Date.now();

    this.setupEventListeners();

    this.logger.debug("Developer dashboard initialized", {
      config: this.config,
    });
  }

  /**
   * Start the dashboard server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn("Developer dashboard already running");
      return;
    }

    if (!this.config.enabled) {
      this.logger.info("Developer dashboard disabled");
      return;
    }

    this.isRunning = true;
    this.logger.info("Starting developer dashboard", {
      host: this.config.host,
      port: this.config.port,
    });

    // Create HTTP server
    this.server = createServer((req, res) => {
      this.handleRequest(req, res);
    });

    // Start server
    await new Promise<void>((resolve, reject) => {
      this.server!.listen(this.config.port, this.config.host, () => {
        this.logger.info("Developer dashboard started", {
          url: `http://${this.config.host}:${this.config.port}`,
        });
        resolve();
      });

      this.server!.on('error', (error) => {
        this.logger.error("Failed to start dashboard server", { error });
        reject(error);
      });
    });

    // Start metrics collection
    this.startMetricsCollection();

    this.logger.info("Developer dashboard ready");
  }

  /**
   * Stop the dashboard server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn("Developer dashboard not running");
      return;
    }

    this.isRunning = false;
    this.logger.info("Stopping developer dashboard");

    // Stop metrics collection
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }

    // Close server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => {
          this.logger.info("Developer dashboard stopped");
          resolve();
        });
      });
      this.server = undefined;
    }

    // Clear clients
    this.clients.clear();
  }

  /**
   * Add a log entry
   */
  addLogEntry(level: DashboardLogEntry['level'], message: string, module: string, data?: any): void {
    const entry: DashboardLogEntry = {
      timestamp: new Date(),
      level,
      message,
      module,
      data,
    };

    this.logEntries.push(entry);
    
    // Limit log entries
    if (this.logEntries.length > this.config.maxLogEntries) {
      this.logEntries.shift();
    }

    this.emit('log-entry', entry);
    this.broadcastToClients('log-entry', entry);
  }

  /**
   * Get current dashboard state
   */
  getDashboardState(): {
    config: DashboardConfig;
    metrics: DashboardMetrics[];
    logs: DashboardLogEntry[];
    isRunning: boolean;
    uptime: number;
    clientCount: number;
  } {
    return {
      config: this.config,
      metrics: this.metricsHistory,
      logs: this.logEntries,
      isRunning: this.isRunning,
      uptime: Date.now() - this.startTime,
      clientCount: this.clients.size,
    };
  }

  /**
   * Update dashboard configuration
   */
  updateConfig(newConfig: Partial<DashboardConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.debug("Dashboard configuration updated", {
      newConfig,
      fullConfig: this.config,
    });

    this.broadcastToClients('config-update', this.config);
  }

  /**
   * Handle HTTP requests
   */
  private handleRequest(req: any, res: any): void {
    const url = req.url || '/';
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      if (url === '/' || url === '/dashboard') {
        this.serveDashboardHTML(res);
      } else if (url === '/api/state') {
        this.serveAPIResponse(res, this.getDashboardState());
      } else if (url === '/api/metrics') {
        this.serveAPIResponse(res, this.metricsHistory);
      } else if (url === '/api/logs') {
        this.serveAPIResponse(res, this.logEntries);
      } else if (url.startsWith('/api/preview')) {
        this.handlePreviewAPI(url, res);
      } else if (url.startsWith('/api/debug')) {
        this.handleDebugAPI(url, res);
      } else if (url === '/ws' || url === '/websocket') {
        this.handleWebSocket(req, res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    } catch (error) {
      this.logger.error("Request handling error", { url, error });
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }

  /**
   * Serve dashboard HTML
   */
  private serveDashboardHTML(res: any): void {
    const html = this.generateDashboardHTML();
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  /**
   * Serve API response
   */
  private serveAPIResponse(res: any, data: any): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }

  /**
   * Handle preview API requests
   */
  private handlePreviewAPI(url: string, res: any): void {
    if (!this.preview) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Preview not available');
      return;
    }

    if (url === '/api/preview/status') {
      const lastUpdate = this.preview.getLastUpdate();
      this.serveAPIResponse(res, { lastUpdate });
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Preview endpoint not found');
    }
  }

  /**
   * Handle debug API requests
   */
  private handleDebugAPI(url: string, res: any): void {
    if (!this.debugUtils) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Debug utilities not available');
      return;
    }

    if (url === '/api/debug/export') {
      const debugData = this.debugUtils.exportDebugData();
      this.serveAPIResponse(res, debugData);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Debug endpoint not found');
    }
  }

  /**
   * Handle WebSocket connections (simplified)
   */
  private handleWebSocket(req: any, res: any): void {
    // This is a simplified WebSocket implementation
    // In a real implementation, you would use a proper WebSocket library
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket endpoint - use a proper WebSocket client');
  }

  /**
   * Generate dashboard HTML
   */
  private generateDashboardHTML(): string {
    const state = this.getDashboardState();
    const themeClass = this.config.theme === 'dark' ? 'dark-theme' : 'light-theme';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tailwind Enigma - Developer Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        .light-theme {
            --bg-primary: #ffffff;
            --bg-secondary: #f8f9fa;
            --text-primary: #212529;
            --text-secondary: #6c757d;
            --border: #dee2e6;
            --accent: #0d6efd;
        }
        
        .dark-theme {
            --bg-primary: #1e1e1e;
            --bg-secondary: #2d2d30;
            --text-primary: #d4d4d4;
            --text-secondary: #969696;
            --border: #3e3e42;
            --accent: #4ec9b0;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
        }
        
        .header {
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border);
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .header h1 {
            color: var(--accent);
            font-size: 1.5rem;
        }
        
        .status {
            display: flex;
            gap: 1rem;
            align-items: center;
        }
        
        .status-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.9rem;
        }
        
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #28a745;
        }
        
        .main {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: auto auto;
            gap: 1rem;
            padding: 1rem 2rem;
            height: calc(100vh - 80px);
        }
        
        .panel {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 1rem;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        
        .panel h2 {
            color: var(--accent);
            margin-bottom: 1rem;
            font-size: 1.2rem;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin-bottom: 1rem;
        }
        
        .metric {
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 4px;
            padding: 0.75rem;
            text-align: center;
        }
        
        .metric-value {
            font-size: 1.5rem;
            font-weight: bold;
            color: var(--accent);
        }
        
        .metric-label {
            font-size: 0.8rem;
            color: var(--text-secondary);
            margin-top: 0.25rem;
        }
        
        .logs {
            flex: 1;
            overflow-y: auto;
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 4px;
            padding: 0.5rem;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.8rem;
        }
        
        .log-entry {
            padding: 0.25rem 0;
            border-bottom: 1px solid var(--border);
        }
        
        .log-entry:last-child {
            border-bottom: none;
        }
        
        .log-timestamp {
            color: var(--text-secondary);
        }
        
        .log-level {
            font-weight: bold;
            margin: 0 0.5rem;
        }
        
        .log-level.info { color: #17a2b8; }
        .log-level.warn { color: #ffc107; }
        .log-level.error { color: #dc3545; }
        .log-level.debug { color: var(--text-secondary); }
        
        .chart-placeholder {
            flex: 1;
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-secondary);
        }
        
        .refresh-btn {
            background: var(--accent);
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9rem;
        }
        
        .refresh-btn:hover {
            opacity: 0.8;
        }
    </style>
</head>
<body class="${themeClass}">
    <div class="header">
        <h1>🎯 Tailwind Enigma Dashboard</h1>
        <div class="status">
            <div class="status-item">
                <div class="status-dot"></div>
                <span>Running</span>
            </div>
            <div class="status-item">
                <span>Uptime: ${this.formatUptime(state.uptime)}</span>
            </div>
            <div class="status-item">
                <span>Clients: ${state.clientCount}</span>
            </div>
            <button class="refresh-btn" onclick="location.reload()">Refresh</button>
        </div>
    </div>
    
    <div class="main">
        <div class="panel">
            <h2>📊 Performance Metrics</h2>
            <div class="metrics-grid">
                <div class="metric">
                    <div class="metric-value">${this.formatMemory(process.memoryUsage().heapUsed)}</div>
                    <div class="metric-label">Memory Usage</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${state.metrics.length}</div>
                    <div class="metric-label">Metrics Collected</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${state.logs.length}</div>
                    <div class="metric-label">Log Entries</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${this.config.updateInterval}ms</div>
                    <div class="metric-label">Update Interval</div>
                </div>
            </div>
            <div class="chart-placeholder">
                📈 Performance Chart<br>
                <small>Real-time metrics visualization</small>
            </div>
        </div>
        
        <div class="panel">
            <h2>🔍 Optimization Status</h2>
            <div class="metrics-grid">
                <div class="metric">
                    <div class="metric-value">0</div>
                    <div class="metric-label">Files Processed</div>
                </div>
                <div class="metric">
                    <div class="metric-value">0</div>
                    <div class="metric-label">Classes Optimized</div>
                </div>
                <div class="metric">
                    <div class="metric-value">0%</div>
                    <div class="metric-label">Size Reduction</div>
                </div>
                <div class="metric">
                    <div class="metric-value">0ms</div>
                    <div class="metric-label">Processing Time</div>
                </div>
            </div>
            <div class="chart-placeholder">
                🎯 Optimization Progress<br>
                <small>Optimization statistics</small>
            </div>
        </div>
        
        <div class="panel">
            <h2>📝 System Logs</h2>
            <div class="logs">
                ${state.logs.slice(-20).map(log => `
                    <div class="log-entry">
                        <span class="log-timestamp">${log.timestamp.toLocaleTimeString()}</span>
                        <span class="log-level ${log.level}">[${log.level.toUpperCase()}]</span>
                        <span class="log-module">[${log.module}]</span>
                        <span class="log-message">${log.message}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="panel">
            <h2>🛠️ Development Tools</h2>
            <div class="metrics-grid">
                <div class="metric">
                    <div class="metric-value">✅</div>
                    <div class="metric-label">Dashboard</div>
                </div>
                <div class="metric">
                    <div class="metric-value">✅</div>
                    <div class="metric-label">Diagnostics</div>
                </div>
                <div class="metric">
                    <div class="metric-value">✅</div>
                    <div class="metric-label">Preview</div>
                </div>
                <div class="metric">
                    <div class="metric-value">✅</div>
                    <div class="metric-label">Source Maps</div>
                </div>
            </div>
            <div class="chart-placeholder">
                🔧 Tool Status & Controls<br>
                <small>Development tool controls</small>
            </div>
        </div>
    </div>
    
    <script>
        // Auto-refresh every 5 seconds
        if (${this.config.autoRefresh}) {
            setInterval(() => {
                location.reload();
            }, 5000);
        }
        
        console.log('Tailwind Enigma Dashboard loaded');
    </script>
</body>
</html>`;
  }

  /**
   * Setup event listeners for integrated tools
   */
  private setupEventListeners(): void {
    // Listen to diagnostics events
    if (this.diagnostics) {
      this.diagnostics.on('performance-update', (metrics) => {
        this.addLogEntry('info', 'Performance metrics updated', 'Diagnostics', { 
          memoryMB: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024),
          eventLoopDelay: metrics.eventLoopDelay 
        });
      });

      this.diagnostics.on('threshold-exceeded', (type, value, threshold) => {
        this.addLogEntry('warn', `${type} threshold exceeded: ${value} > ${threshold}`, 'Diagnostics');
      });
    }

    // Listen to preview events
    if (this.preview) {
      this.preview.on('update', (update) => {
        this.addLogEntry('info', `Preview updated: ${update.files.length} files processed`, 'Preview', {
          totalChanges: update.summary.totalChanges,
          totalSavings: update.summary.totalSavings
        });
      });

      this.preview.on('error', (error) => {
        this.addLogEntry('error', `Preview error: ${error.message}`, 'Preview');
      });
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      const metrics = this.collectMetrics();
      this.metricsHistory.push(metrics);
      
      // Limit metrics history
      if (this.metricsHistory.length > 100) {
        this.metricsHistory.shift();
      }

      this.emit('metrics-update', metrics);
      this.broadcastToClients('metrics-update', metrics);
    }, this.config.updateInterval);
  }

  /**
   * Collect current metrics
   */
  private collectMetrics(): DashboardMetrics {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      timestamp: new Date(),
      performance: {
        memoryUsage,
        processingTime: Date.now() - this.startTime,
        cpuUsage,
        eventLoopDelay: 0,
        activeHandles: (process as any)._getActiveHandles?.()?.length || 0,
        activeRequests: (process as any)._getActiveRequests?.()?.length || 0,
      },
      optimization: {
        totalFiles: 0,
        totalClasses: 0,
        optimizedClasses: 0,
        sizeReduction: 0,
        processingTime: 0,
      },
      system: {
        uptime: Date.now() - this.startTime,
        memoryUsage,
        cpuUsage,
        activeConnections: this.clients.size,
      },
    };
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcastToClients(event: string, _data: any): void {
    // In a real implementation, this would send WebSocket messages
    this.logger.debug("Broadcasting to clients", { event, clientCount: this.clients.size });
  }

  /**
   * Format uptime for display
   */
  private formatUptime(uptime: number): string {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Format memory usage for display
   */
  private formatMemory(bytes: number): string {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(1)}MB`;
  }
}

/**
 * Create and configure developer dashboard
 */
export function createDevDashboard(
  config: EnigmaConfig,
  diagnostics?: DevDiagnostics,
  preview?: DevPreview,
  debugUtils?: DebugUtils,
  sourceMapGenerator?: SourceMapGenerator
): DevDashboard | null {
  if (!config.dev?.dashboard?.enabled) {
    return null;
  }

  const dashboardConfig: DashboardConfig = {
    enabled: config.dev.dashboard.enabled,
    port: config.dev.dashboard.port ?? 3000,
    host: config.dev.dashboard.host ?? 'localhost',
    updateInterval: config.dev.dashboard.updateInterval ?? 1000,
    maxLogEntries: config.dev.dashboard.maxLogEntries ?? 1000,
    showMetrics: config.dev.dashboard.showMetrics ?? true,
    showLogs: config.dev.dashboard.showLogs ?? true,
    showPreview: true,
    showDebug: true,
    autoRefresh: true,
    theme: 'dark',
  };

  return new DevDashboard(dashboardConfig, diagnostics, preview, debugUtils, sourceMapGenerator);
}

// Type declarations for events
// EventEmitter interface augmentation for DevDashboard
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface DevDashboardEventEmitter {
  on<K extends keyof DashboardEvents>(event: K, listener: DashboardEvents[K]): this;
  emit<K extends keyof DashboardEvents>(event: K, ...args: Parameters<DashboardEvents[K]>): boolean;
} 