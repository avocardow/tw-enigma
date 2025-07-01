import { createLogger } from '../../utils/logger';
import { BenchmarkResult } from '../types';
import { ChartGenerator, ChartOutput, ChartConfig } from './ChartGenerator';

const logger = createLogger('InteractiveCharts');

/**
 * Interactive chart configuration
 */
export interface InteractiveChartConfig extends ChartConfig {
  interactive: {
    enabled: boolean;
    zoom: boolean;
    pan: boolean;
    tooltip: boolean;
    crosshair: boolean;
    brush: boolean;
    selection: boolean;
  };
  controls: {
    timeRange: boolean;
    metricSelector: boolean;
    compareMode: boolean;
    exportOptions: boolean;
  };
  realtime: {
    enabled: boolean;
    updateInterval: number;
    maxDataPoints: number;
    autoScroll: boolean;
  };
}

/**
 * Chart data with time series support
 */
export interface TimeSeriesData {
  timestamp: number;
  value: number;
  metric: string;
  benchmark: string;
  metadata?: Record<string, any>;
}

/**
 * Interactive chart instance
 */
export interface InteractiveChart {
  id: string;
  container: string;
  config: InteractiveChartConfig;
  data: TimeSeriesData[];
  chart: any; // Chart.js or D3 instance
  controls: ChartControls;
}

/**
 * Chart controls for user interaction
 */
export interface ChartControls {
  timeRange: {
    start: Date;
    end: Date;
    preset: 'last1h' | 'last24h' | 'last7d' | 'last30d' | 'custom';
  };
  selectedMetrics: string[];
  compareBaseline: boolean;
  showAnnotations: boolean;
  exportFormat: 'svg' | 'png' | 'pdf' | 'csv';
}

/**
 * Real-time data update
 */
export interface RealtimeUpdate {
  data: TimeSeriesData[];
  append: boolean;
  timestamp: number;
}

/**
 * Chart event handlers
 */
export interface ChartEventHandlers {
  onDataPointClick?: (point: TimeSeriesData) => void;
  onZoom?: (range: { start: Date; end: Date }) => void;
  onBrush?: (selection: TimeSeriesData[]) => void;
  onMetricToggle?: (metric: string, enabled: boolean) => void;
  onExport?: (format: string) => void;
  onTimeRangeChange?: (range: { start: Date; end: Date }) => void;
}

/**
 * Interactive charts manager for real-time benchmark visualization
 */
export class InteractiveChartsManager {
  private charts: Map<string, InteractiveChart> = new Map();
  private updateCallbacks: Map<string, () => void> = new Map();
  private chartGenerator: ChartGenerator;

  constructor() {
    this.chartGenerator = new ChartGenerator();
  }

  /**
   * Create interactive performance dashboard
   */
  async createPerformanceDashboard(
    containerId: string,
    results: BenchmarkResult[],
    config: Partial<InteractiveChartConfig> = {}
  ): Promise<string> {
    logger.info('Creating performance dashboard', { containerId, results: results.length });

    const dashboardId = `dashboard-${Date.now()}`;
    const timeSeriesData = this.convertToTimeSeries(results);

    // Create multiple chart views
    const charts = await this.createDashboardCharts(timeSeriesData, config);
    
    // Generate dashboard HTML
    const dashboardHTML = this.generateDashboardHTML(dashboardId, charts, config);
    
    // Store dashboard reference
    this.charts.set(dashboardId, {
      id: dashboardId,
      container: containerId,
      config: this.mergeInteractiveConfig(config),
      data: timeSeriesData,
      chart: null,
      controls: this.createDefaultControls(),
    });

    return dashboardHTML;
  }

  /**
   * Create real-time monitoring chart
   */
  async createRealtimeChart(
    containerId: string,
    config: Partial<InteractiveChartConfig> = {}
  ): Promise<string> {
    const chartId = `realtime-${Date.now()}`;
    const mergedConfig = this.mergeInteractiveConfig(config);

    logger.info('Creating real-time chart', { chartId, containerId });

    const chartHTML = this.generateRealtimeChartHTML(chartId, mergedConfig);
    
    const chart: InteractiveChart = {
      id: chartId,
      container: containerId,
      config: mergedConfig,
      data: [],
      chart: null,
      controls: this.createDefaultControls(),
    };

    this.charts.set(chartId, chart);

    // Start real-time updates if enabled
    if (mergedConfig.realtime.enabled) {
      this.startRealtimeUpdates(chartId);
    }

    return chartHTML;
  }

  /**
   * Update chart with new data
   */
  updateChart(chartId: string, data: TimeSeriesData[]): void {
    const chart = this.charts.get(chartId);
    if (!chart) {
      logger.warn('Chart not found for update', { chartId });
      return;
    }

    // Append or replace data based on configuration
    if (chart.config.realtime.enabled) {
      chart.data.push(...data);
      
      // Limit data points for performance
      if (chart.data.length > chart.config.realtime.maxDataPoints) {
        chart.data = chart.data.slice(-chart.config.realtime.maxDataPoints);
      }
    } else {
      chart.data = data;
    }

    // Trigger chart update
    const updateCallback = this.updateCallbacks.get(chartId);
    if (updateCallback) {
      updateCallback();
    }

    logger.debug('Chart updated', { chartId, dataPoints: chart.data.length });
  }

  /**
   * Add real-time data point
   */
  addRealtimeData(chartId: string, dataPoint: TimeSeriesData): void {
    this.updateChart(chartId, [dataPoint]);
  }

  /**
   * Set chart controls
   */
  setChartControls(chartId: string, controls: Partial<ChartControls>): void {
    const chart = this.charts.get(chartId);
    if (!chart) {
      logger.warn('Chart not found for controls update', { chartId });
      return;
    }

    chart.controls = { ...chart.controls, ...controls };
    
    // Apply controls to chart
    this.applyControls(chart);
    
    logger.debug('Chart controls updated', { chartId, controls });
  }

  /**
   * Export chart data
   */
  async exportChart(chartId: string, format: 'svg' | 'png' | 'pdf' | 'csv'): Promise<Buffer> {
    const chart = this.charts.get(chartId);
    if (!chart) {
      throw new Error(`Chart not found: ${chartId}`);
    }

    switch (format) {
      case 'csv':
        return this.exportToCSV(chart.data);
      case 'svg':
      case 'png':
      case 'pdf':
        return this.exportChartVisual(chart, format);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Remove chart
   */
  removeChart(chartId: string): void {
    const chart = this.charts.get(chartId);
    if (chart) {
      // Stop real-time updates
      const updateCallback = this.updateCallbacks.get(chartId);
      if (updateCallback) {
        clearInterval(updateCallback as any);
        this.updateCallbacks.delete(chartId);
      }

      this.charts.delete(chartId);
      logger.info('Chart removed', { chartId });
    }
  }

  /**
   * Convert benchmark results to time series data
   */
  private convertToTimeSeries(results: BenchmarkResult[]): TimeSeriesData[] {
    const timeSeriesData: TimeSeriesData[] = [];

    results.forEach((result, index) => {
      const baseTimestamp = Date.now() - (results.length - index) * 60000; // 1 minute intervals

      // Duration metric
      timeSeriesData.push({
        timestamp: baseTimestamp,
        value: result.duration,
        metric: 'duration',
        benchmark: result.name,
        metadata: { result },
      });

      // Memory usage metric
      timeSeriesData.push({
        timestamp: baseTimestamp,
        value: result.metrics.memoryUsage.heapUsed / 1024 / 1024, // MB
        metric: 'memory',
        benchmark: result.name,
        metadata: { result },
      });

      // CPU usage metric
      timeSeriesData.push({
        timestamp: baseTimestamp,
        value: (result.metrics.cpuUsage.user + result.metrics.cpuUsage.system) / 1000, // ms
        metric: 'cpu',
        benchmark: result.name,
        metadata: { result },
      });

      // Throughput metric
      if (result.metrics.bytesProcessed > 0) {
        timeSeriesData.push({
          timestamp: baseTimestamp,
          value: result.metrics.bytesProcessed / result.duration, // bytes per ms
          metric: 'throughput',
          benchmark: result.name,
          metadata: { result },
        });
      }
    });

    return timeSeriesData.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Create dashboard charts
   */
  private async createDashboardCharts(
    data: TimeSeriesData[],
    config: Partial<InteractiveChartConfig>
  ): Promise<ChartOutput[]> {
    const charts: ChartOutput[] = [];

    // Performance overview chart
    const performanceData = data.filter(d => d.metric === 'duration');
    if (performanceData.length > 0) {
      const performanceChart = await this.chartGenerator.generatePerformanceTimeline(
        this.convertToResults(performanceData),
        {
          title: 'Performance Timeline',
          width: 800,
          height: 300,
          ...config,
        }
      );
      charts.push(performanceChart);
    }

    // Memory usage chart
    const memoryData = data.filter(d => d.metric === 'memory');
    if (memoryData.length > 0) {
      const memoryChart = await this.chartGenerator.generateMemoryUsageChart(
        this.convertToResults(memoryData),
        {
          title: 'Memory Usage',
          width: 800,
          height: 300,
          ...config,
        }
      );
      charts.push(memoryChart);
    }

    return charts;
  }

  /**
   * Convert time series data back to benchmark results
   */
  private convertToResults(data: TimeSeriesData[]): BenchmarkResult[] {
    return data.map(d => d.metadata?.result).filter(Boolean);
  }

  /**
   * Generate dashboard HTML
   */
  private generateDashboardHTML(
    dashboardId: string,
    charts: ChartOutput[],
    config: Partial<InteractiveChartConfig>
  ): string {
    return `
      <div id="${dashboardId}" class="performance-dashboard">
        <div class="dashboard-header">
          <h2>Performance Dashboard</h2>
          <div class="dashboard-controls">
            <div class="time-range-selector">
              <label>Time Range:</label>
              <select id="${dashboardId}-time-range">
                <option value="last1h">Last Hour</option>
                <option value="last24h">Last 24 Hours</option>
                <option value="last7d">Last 7 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            <div class="metric-selector">
              <label>Metrics:</label>
              <div class="metric-checkboxes">
                <label><input type="checkbox" value="duration" checked> Duration</label>
                <label><input type="checkbox" value="memory" checked> Memory</label>
                <label><input type="checkbox" value="cpu" checked> CPU</label>
                <label><input type="checkbox" value="throughput"> Throughput</label>
              </div>
            </div>
            <div class="export-controls">
              <button onclick="exportDashboard('${dashboardId}', 'png')">Export PNG</button>
              <button onclick="exportDashboard('${dashboardId}', 'pdf')">Export PDF</button>
              <button onclick="exportDashboard('${dashboardId}', 'csv')">Export CSV</button>
            </div>
          </div>
        </div>
        
        <div class="dashboard-content">
          <div class="charts-grid">
            ${charts.map((chart, index) => `
              <div class="chart-container" id="${dashboardId}-chart-${index}">
                <div class="chart-title">${chart.config.title || 'Chart'}</div>
                <div class="chart-content">${chart.svg}</div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="dashboard-footer">
          <div class="status-indicator">
            <span class="status-dot active"></span>
            <span>Live Dashboard</span>
          </div>
          <div class="last-update">
            Last Updated: <span id="${dashboardId}-last-update">${new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
      
      <style>
        .performance-dashboard {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          padding: 1.5rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .dashboard-controls {
          display: flex;
          gap: 2rem;
          align-items: center;
        }
        
        .metric-checkboxes {
          display: flex;
          gap: 1rem;
        }
        
        .metric-checkboxes label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
        }
        
        .charts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 2rem;
        }
        
        .chart-container {
          background: #f8fafc;
          border-radius: 6px;
          padding: 1rem;
          border: 1px solid #e5e7eb;
        }
        
        .chart-title {
          font-weight: 600;
          margin-bottom: 1rem;
          color: #374151;
        }
        
        .dashboard-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 2rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
          font-size: 0.9rem;
          color: #6b7280;
        }
        
        .status-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
        }
        
        .status-dot.active {
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        button {
          background: #2563eb;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
        }
        
        button:hover {
          background: #1d4ed8;
        }
        
        select {
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          background: white;
        }
      </style>
      
      <script>
        function exportDashboard(dashboardId, format) {
          // Export functionality would be implemented here
          console.log('Exporting dashboard', dashboardId, 'as', format);
        }
        
        // Update timestamp
        setInterval(() => {
          const timestamp = document.getElementById('${dashboardId}-last-update');
          if (timestamp) {
            timestamp.textContent = new Date().toLocaleTimeString();
          }
        }, 1000);
      </script>
    `;
  }

  /**
   * Generate real-time chart HTML
   */
  private generateRealtimeChartHTML(
    chartId: string,
    config: InteractiveChartConfig
  ): string {
    return `
      <div id="${chartId}" class="realtime-chart">
        <div class="chart-header">
          <h3>Real-time Performance Monitor</h3>
          <div class="chart-status">
            <span class="status-indicator live"></span>
            <span>Live</span>
          </div>
        </div>
        <div class="chart-canvas" id="${chartId}-canvas">
          <!-- Chart will be rendered here -->
        </div>
        <div class="chart-controls">
          <button onclick="pauseChart('${chartId}')">Pause</button>
          <button onclick="resetChart('${chartId}')">Reset</button>
          <button onclick="exportChart('${chartId}', 'png')">Export</button>
        </div>
      </div>
    `;
  }

  /**
   * Merge interactive configuration with defaults
   */
  private mergeInteractiveConfig(config: Partial<InteractiveChartConfig>): InteractiveChartConfig {
    const defaults: InteractiveChartConfig = {
      type: 'line',
      width: 800,
      height: 400,
      theme: 'light',
      colors: ['#2563eb', '#dc2626', '#16a34a'],
      accessibility: {
        enabled: true,
        keyboardNavigation: true,
      },
      animation: {
        enabled: true,
        duration: 1000,
        easing: 'ease-in-out',
      },
      legend: {
        enabled: true,
        position: 'top',
      },
      axes: {
        x: { scale: 'time', ticks: { count: 10, format: 'HH:mm' } },
        y: { scale: 'linear', ticks: { count: 8, format: '.2f' } },
      },
      grid: {
        enabled: true,
        style: 'solid',
        opacity: 0.2,
      },
      exportFormats: ['svg', 'png'],
      interactive: {
        enabled: true,
        zoom: true,
        pan: true,
        tooltip: true,
        crosshair: true,
        brush: false,
        selection: false,
      },
      controls: {
        timeRange: true,
        metricSelector: true,
        compareMode: false,
        exportOptions: true,
      },
      realtime: {
        enabled: false,
        updateInterval: 5000,
        maxDataPoints: 100,
        autoScroll: true,
      },
    };

    return {
      ...defaults,
      ...config,
      interactive: { ...defaults.interactive, ...config.interactive },
      controls: { ...defaults.controls, ...config.controls },
      realtime: { ...defaults.realtime, ...config.realtime },
    };
  }

  /**
   * Create default chart controls
   */
  private createDefaultControls(): ChartControls {
    return {
      timeRange: {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        end: new Date(),
        preset: 'last24h',
      },
      selectedMetrics: ['duration', 'memory'],
      compareBaseline: false,
      showAnnotations: true,
      exportFormat: 'png',
    };
  }

  /**
   * Apply controls to chart
   */
  private applyControls(chart: InteractiveChart): void {
    // Filter data by time range
    const filteredData = chart.data.filter(
      d => d.timestamp >= chart.controls.timeRange.start.getTime() &&
           d.timestamp <= chart.controls.timeRange.end.getTime()
    );

    // Filter by selected metrics
    const metricFilteredData = filteredData.filter(
      d => chart.controls.selectedMetrics.includes(d.metric)
    );

    // Update chart with filtered data
    // Implementation would depend on the charting library used
    logger.debug('Applied controls to chart', {
      chartId: chart.id,
      dataPoints: metricFilteredData.length,
      metrics: chart.controls.selectedMetrics,
    });
  }

  /**
   * Start real-time updates for a chart
   */
  private startRealtimeUpdates(chartId: string): void {
    const chart = this.charts.get(chartId);
    if (!chart || !chart.config.realtime.enabled) {
      return;
    }

    const updateInterval = setInterval(() => {
      // Generate synthetic real-time data for demonstration
      const now = Date.now();
      const syntheticData: TimeSeriesData = {
        timestamp: now,
        value: Math.random() * 100 + 50, // Random performance value
        metric: 'duration',
        benchmark: 'realtime-test',
        metadata: { synthetic: true },
      };

      this.addRealtimeData(chartId, syntheticData);
    }, chart.config.realtime.updateInterval);

    this.updateCallbacks.set(chartId, updateInterval as any);
  }

  /**
   * Export chart to CSV
   */
  private exportToCSV(data: TimeSeriesData[]): Buffer {
    const header = 'Timestamp,Value,Metric,Benchmark\n';
    const rows = data.map(d => 
      `${new Date(d.timestamp).toISOString()},${d.value},${d.metric},${d.benchmark}`
    ).join('\n');
    
    return Buffer.from(header + rows, 'utf-8');
  }

  /**
   * Export chart visual
   */
  private async exportChartVisual(chart: InteractiveChart, format: 'svg' | 'png' | 'pdf'): Promise<Buffer> {
    // Convert chart data to results format
    const results = this.convertToResults(chart.data);
    
    // Generate chart using the chart generator
    const chartOutput = await this.chartGenerator.generatePerformanceTimeline(results, chart.config);
    
    switch (format) {
      case 'svg':
        return Buffer.from(chartOutput.svg, 'utf-8');
      case 'png':
        return chartOutput.png || Buffer.from('PNG not available');
      case 'pdf':
        return chartOutput.pdf || Buffer.from('PDF not available');
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }
}

/**
 * Factory function for creating interactive charts manager
 */
export function createInteractiveChartsManager(): InteractiveChartsManager {
  return new InteractiveChartsManager();
}

/**
 * Utility functions for interactive charts
 */
export const InteractiveChartsUtils = {
  /**
   * Create chart event listeners
   */
  createEventListeners(chartId: string, handlers: ChartEventHandlers): void {
    // Implementation would depend on the DOM and charting library
    console.log('Creating event listeners for chart', chartId, handlers);
  },

  /**
   * Calculate optimal update interval based on data volume
   */
  calculateOptimalUpdateInterval(dataPointsPerSecond: number): number {
    if (dataPointsPerSecond > 10) return 1000; // 1 second for high-frequency data
    if (dataPointsPerSecond > 1) return 5000;  // 5 seconds for medium-frequency
    return 30000; // 30 seconds for low-frequency data
  },

  /**
   * Generate color scheme for metrics
   */
  generateMetricColors(metrics: string[]): Record<string, string> {
    const colors = [
      '#2563eb', '#dc2626', '#16a34a', '#f59e0b',
      '#8b5cf6', '#06b6d4', '#ef4444', '#10b981'
    ];
    
    const colorMap: Record<string, string> = {};
    metrics.forEach((metric, index) => {
      colorMap[metric] = colors[index % colors.length];
    });
    
    return colorMap;
  },
};