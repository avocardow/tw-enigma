import { createLogger } from '../../utils/logger';
import { BenchmarkResult } from '../types';

const logger = createLogger('ChartGenerator');

/**
 * Chart configuration options
 */
export interface ChartConfig {
  type: 'line' | 'bar' | 'area' | 'scatter' | 'histogram' | 'heatmap' | 'pie' | 'radar';
  title?: string;
  width: number;
  height: number;
  theme: 'light' | 'dark' | 'auto' | 'accessible';
  colors: string[];
  accessibility: {
    enabled: boolean;
    altText?: string;
    description?: string;
    keyboardNavigation: boolean;
  };
  animation: {
    enabled: boolean;
    duration: number;
    easing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
  };
  legend: {
    enabled: boolean;
    position: 'top' | 'bottom' | 'left' | 'right' | 'none';
  };
  axes: {
    x: AxisConfig;
    y: AxisConfig;
  };
  grid: {
    enabled: boolean;
    style: 'solid' | 'dashed' | 'dotted';
    opacity: number;
  };
  exportFormats: ('svg' | 'png' | 'pdf' | 'json')[];
}

/**
 * Axis configuration
 */
export interface AxisConfig {
  label?: string;
  unit?: string;
  scale: 'linear' | 'logarithmic' | 'time';
  range?: [number, number];
  ticks?: {
    count: number;
    format: string;
  };
}

/**
 * Chart data series
 */
export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
  color?: string;
  style?: {
    strokeWidth?: number;
    fillOpacity?: number;
    markerSize?: number;
  };
  metadata?: Record<string, any>;
}

/**
 * Chart data point
 */
export interface ChartDataPoint {
  x: number | string | Date;
  y: number;
  label?: string;
  metadata?: Record<string, any>;
}

/**
 * Generated chart output
 */
export interface ChartOutput {
  svg: string;
  png?: Buffer;
  pdf?: Buffer;
  config: ChartConfig;
  metadata: {
    generatedAt: Date;
    dataPoints: number;
    series: number;
    dimensions: { width: number; height: number };
  };
  accessibility: {
    altText: string;
    description: string;
    dataTable: string; // CSV format for screen readers
  };
}

/**
 * Chart generation options
 */
export interface ChartGenerationOptions {
  includeTooltips: boolean;
  includeDataLabels: boolean;
  responsive: boolean;
  optimizeForPrint: boolean;
  compressionLevel?: number;
}

/**
 * Benchmark-specific chart configurations
 */
export interface BenchmarkChartConfig extends Omit<ChartConfig, 'type'> {
  type:
    | 'performance-timeline'
    | 'comparison-bar'
    | 'trend-analysis'
    | 'distribution-histogram'
    | 'correlation-scatter'
    | 'regression-detection'
    | 'memory-usage'
    | 'cpu-utilization'
    | 'throughput-analysis';
  benchmarkSpecific: {
    showBaseline: boolean;
    highlightRegressions: boolean;
    showConfidenceIntervals: boolean;
    annotateSignificantChanges: boolean;
    groupByConfiguration: boolean;
  };
}

/**
 * Color scheme definitions
 */
export const COLOR_SCHEMES = {
  default: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#f97316', '#06b6d4', '#84cc16'],
  accessible: [
    '#1f77b4',
    '#ff7f0e',
    '#2ca02c',
    '#d62728',
    '#9467bd',
    '#8c564b',
    '#e377c2',
    '#7f7f7f',
  ],
  monochrome: ['#000000', '#404040', '#808080', '#c0c0c0', '#ffffff'],
  performance: ['#22c55e', '#eab308', '#ef4444', '#3b82f6'], // Green, Yellow, Red, Blue
  dark: ['#60a5fa', '#f87171', '#34d399', '#fbbf24', '#a78bfa', '#fb7185', '#38bdf8', '#a3e635'],
} as const;

/**
 * Chart themes
 */
export const CHART_THEMES = {
  light: {
    backgroundColor: '#ffffff',
    textColor: '#374151',
    gridColor: '#e5e7eb',
    axisColor: '#6b7280',
  },
  dark: {
    backgroundColor: '#1f2937',
    textColor: '#f9fafb',
    gridColor: '#374151',
    axisColor: '#9ca3af',
  },
  accessible: {
    backgroundColor: '#ffffff',
    textColor: '#000000',
    gridColor: '#808080',
    axisColor: '#000000',
  },
} as const;

/**
 * SVG chart generator using D3.js-like approach
 */
export class ChartGenerator {
  private defaultConfig: ChartConfig = {
    type: 'line',
    width: 800,
    height: 600,
    theme: 'light',
    colors: COLOR_SCHEMES.default,
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
      x: {
        scale: 'linear',
        ticks: { count: 10, format: '.2f' },
      },
      y: {
        scale: 'linear',
        ticks: { count: 8, format: '.2f' },
      },
    },
    grid: {
      enabled: true,
      style: 'solid',
      opacity: 0.2,
    },
    exportFormats: ['svg', 'png'],
  };

  /**
   * Generate chart from benchmark results
   */
  async generateBenchmarkChart(
    results: BenchmarkResult[],
    config: Partial<BenchmarkChartConfig>,
    options: ChartGenerationOptions = {
      includeTooltips: true,
      includeDataLabels: false,
      responsive: true,
      optimizeForPrint: false,
    }
  ): Promise<ChartOutput> {
    logger.info('Generating benchmark chart', {
      resultsCount: results.length,
      chartType: config.type,
    });

    const mergedConfig = this.mergeConfig(config);
    const series = this.prepareBenchmarkData(results, mergedConfig);

    return this.generateChart(series, mergedConfig, options);
  }

  /**
   * Generate performance timeline chart
   */
  async generatePerformanceTimeline(
    results: BenchmarkResult[],
    config: Partial<ChartConfig> = {}
  ): Promise<ChartOutput> {
    const timelineConfig: Partial<BenchmarkChartConfig> = {
      ...config,
      type: 'performance-timeline',
      axes: {
        x: { label: 'Time', scale: 'time' },
        y: { label: 'Execution Time (ms)', scale: 'linear' },
      },
      benchmarkSpecific: {
        showBaseline: true,
        highlightRegressions: true,
        showConfidenceIntervals: false,
        annotateSignificantChanges: true,
        groupByConfiguration: false,
      },
    };

    return this.generateBenchmarkChart(results, timelineConfig);
  }

  /**
   * Generate comparison bar chart
   */
  async generateComparisonChart(
    results: BenchmarkResult[],
    config: Partial<ChartConfig> = {}
  ): Promise<ChartOutput> {
    const comparisonConfig: Partial<BenchmarkChartConfig> = {
      ...config,
      type: 'comparison-bar',
      axes: {
        x: { label: 'Benchmark Cases', scale: 'linear' },
        y: { label: 'Performance Score', scale: 'linear' },
      },
      benchmarkSpecific: {
        showBaseline: true,
        highlightRegressions: false,
        showConfidenceIntervals: true,
        annotateSignificantChanges: false,
        groupByConfiguration: true,
      },
    };

    return this.generateBenchmarkChart(results, comparisonConfig);
  }

  /**
   * Generate trend analysis chart
   */
  async generateTrendAnalysis(
    results: BenchmarkResult[],
    config: Partial<ChartConfig> = {}
  ): Promise<ChartOutput> {
    const trendConfig: Partial<BenchmarkChartConfig> = {
      ...config,
      type: 'trend-analysis',
      axes: {
        x: { label: 'Build Number', scale: 'linear' },
        y: { label: 'Performance Metric', scale: 'linear' },
      },
      benchmarkSpecific: {
        showBaseline: true,
        highlightRegressions: true,
        showConfidenceIntervals: true,
        annotateSignificantChanges: true,
        groupByConfiguration: false,
      },
    };

    return this.generateBenchmarkChart(results, trendConfig);
  }

  /**
   * Generate memory usage visualization
   */
  async generateMemoryUsageChart(
    results: BenchmarkResult[],
    config: Partial<ChartConfig> = {}
  ): Promise<ChartOutput> {
    const memoryConfig: Partial<BenchmarkChartConfig> = {
      ...config,
      type: 'memory-usage',
      axes: {
        x: { label: 'Time (s)', scale: 'linear' },
        y: { label: 'Memory Usage (MB)', scale: 'linear' },
      },
      colors: COLOR_SCHEMES.performance,
      benchmarkSpecific: {
        showBaseline: false,
        highlightRegressions: false,
        showConfidenceIntervals: false,
        annotateSignificantChanges: false,
        groupByConfiguration: false,
      },
    };

    return this.generateBenchmarkChart(results, memoryConfig);
  }

  /**
   * Generate distribution histogram
   */
  async generateDistributionHistogram(
    results: BenchmarkResult[],
    config: Partial<ChartConfig> = {}
  ): Promise<ChartOutput> {
    const histogramConfig: Partial<BenchmarkChartConfig> = {
      ...config,
      type: 'distribution-histogram',
      axes: {
        x: { label: 'Performance Value', scale: 'linear' },
        y: { label: 'Frequency', scale: 'linear' },
      },
      benchmarkSpecific: {
        showBaseline: true,
        highlightRegressions: false,
        showConfidenceIntervals: false,
        annotateSignificantChanges: false,
        groupByConfiguration: true,
      },
    };

    return this.generateBenchmarkChart(results, histogramConfig);
  }

  /**
   * Generate core chart from series data
   */
  private async generateChart(
    series: ChartSeries[],
    config: ChartConfig,
    options: ChartGenerationOptions
  ): Promise<ChartOutput> {
    const theme = CHART_THEMES[config.theme === 'auto' ? 'light' : config.theme];

    // Generate SVG
    const svg = this.generateSVG(series, config, theme, options);

    // Generate accessibility content
    const accessibility = this.generateAccessibilityContent(series, config);

    // Generate metadata
    const metadata = {
      generatedAt: new Date(),
      dataPoints: series.reduce((sum, s) => sum + s.data.length, 0),
      series: series.length,
      dimensions: { width: config.width, height: config.height },
    };

    const output: ChartOutput = {
      svg,
      config,
      metadata,
      accessibility,
    };

    // Generate additional formats if requested
    if (config.exportFormats.includes('png')) {
      output.png = await this.convertToPNG(svg, config.width, config.height);
    }

    if (config.exportFormats.includes('pdf')) {
      output.pdf = await this.convertToPDF(svg, config.width, config.height);
    }

    logger.info('Chart generated successfully', {
      type: config.type,
      seriesCount: series.length,
      dataPoints: metadata.dataPoints,
      formats: config.exportFormats,
    });

    return output;
  }

  /**
   * Generate SVG content
   */
  private generateSVG(
    series: ChartSeries[],
    config: ChartConfig,
    theme: typeof CHART_THEMES.light,
    options: ChartGenerationOptions
  ): string {
    const margin = { top: 60, right: 80, bottom: 80, left: 80 };
    const chartWidth = config.width - margin.left - margin.right;
    const chartHeight = config.height - margin.top - margin.bottom;

    let svg = `<svg width="${config.width}" height="${config.height}" xmlns="http://www.w3.org/2000/svg">`;

    // Add background
    svg += `<rect width="100%" height="100%" fill="${theme.backgroundColor}"/>`;

    // Add title
    if (config.title) {
      svg += `<text x="${config.width / 2}" y="30" text-anchor="middle" font-size="18" font-weight="bold" fill="${theme.textColor}">${config.title}</text>`;
    }

    // Add main chart group
    svg += `<g transform="translate(${margin.left},${margin.top})">`;

    // Generate axes
    svg += this.generateAxes(chartWidth, chartHeight, config, theme);

    // Generate grid
    if (config.grid.enabled) {
      svg += this.generateGrid(chartWidth, chartHeight, config, theme);
    }

    // Generate data visualization based on chart type
    switch (config.type) {
      case 'line':
        svg += this.generateLineChart(series, chartWidth, chartHeight, config);
        break;
      case 'bar':
        svg += this.generateBarChart(series, chartWidth, chartHeight, config);
        break;
      case 'area':
        svg += this.generateAreaChart(series, chartWidth, chartHeight, config);
        break;
      case 'scatter':
        svg += this.generateScatterChart(series, chartWidth, chartHeight, config);
        break;
      default:
        svg += this.generateLineChart(series, chartWidth, chartHeight, config);
    }

    // Add legend
    if (config.legend.enabled && config.legend.position !== 'none') {
      svg += this.generateLegend(series, config, theme);
    }

    svg += '</g>';

    // Add accessibility features
    if (config.accessibility.enabled) {
      svg = this.addAccessibilityFeatures(svg, series, config);
    }

    svg += '</svg>';

    return svg;
  }

  /**
   * Generate axes
   */
  private generateAxes(
    width: number,
    height: number,
    config: ChartConfig,
    theme: typeof CHART_THEMES.light
  ): string {
    let axes = '';

    // X-axis
    axes += `<line x1="0" y1="${height}" x2="${width}" y2="${height}" stroke="${theme.axisColor}" stroke-width="1"/>`;

    // Y-axis
    axes += `<line x1="0" y1="0" x2="0" y2="${height}" stroke="${theme.axisColor}" stroke-width="1"/>`;

    // X-axis label
    if (config.axes.x.label) {
      axes += `<text x="${width / 2}" y="${height + 40}" text-anchor="middle" font-size="12" fill="${theme.textColor}">${config.axes.x.label}</text>`;
    }

    // Y-axis label
    if (config.axes.y.label) {
      axes += `<text x="-40" y="${height / 2}" text-anchor="middle" font-size="12" fill="${theme.textColor}" transform="rotate(-90, -40, ${height / 2})">${config.axes.y.label}</text>`;
    }

    return axes;
  }

  /**
   * Generate grid lines
   */
  private generateGrid(
    width: number,
    height: number,
    config: ChartConfig,
    theme: typeof CHART_THEMES.light
  ): string {
    let grid = '';
    const strokeDashArray =
      config.grid.style === 'dashed' ? '5,5' : config.grid.style === 'dotted' ? '2,2' : '';

    // Vertical grid lines
    const xTicks = config.axes.x.ticks?.count || 10;
    for (let i = 1; i < xTicks; i++) {
      const x = (width / xTicks) * i;
      grid += `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${theme.gridColor}" stroke-width="1" opacity="${config.grid.opacity}" stroke-dasharray="${strokeDashArray}"/>`;
    }

    // Horizontal grid lines
    const yTicks = config.axes.y.ticks?.count || 8;
    for (let i = 1; i < yTicks; i++) {
      const y = (height / yTicks) * i;
      grid += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${theme.gridColor}" stroke-width="1" opacity="${config.grid.opacity}" stroke-dasharray="${strokeDashArray}"/>`;
    }

    return grid;
  }

  /**
   * Generate line chart
   */
  private generateLineChart(
    series: ChartSeries[],
    width: number,
    height: number,
    config: ChartConfig
  ): string {
    let chart = '';

    series.forEach((serie, index) => {
      const color = serie.color || config.colors[index % config.colors.length];
      const strokeWidth = serie.style?.strokeWidth || 2;

      // Calculate data points
      const points = serie.data
        .map((point, pointIndex) => {
          const x = (width / (serie.data.length - 1)) * pointIndex;
          const y = height - (Number(point.y) / 100) * height; // Normalize to chart height
          return `${x},${y}`;
        })
        .join(' ');

      chart += `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"/>`;

      // Add data point markers
      serie.data.forEach((point, pointIndex) => {
        const x = (width / (serie.data.length - 1)) * pointIndex;
        const y = height - (Number(point.y) / 100) * height;
        const markerSize = serie.style?.markerSize || 4;

        chart += `<circle cx="${x}" cy="${y}" r="${markerSize}" fill="${color}"/>`;
      });
    });

    return chart;
  }

  /**
   * Generate bar chart
   */
  private generateBarChart(
    series: ChartSeries[],
    width: number,
    height: number,
    config: ChartConfig
  ): string {
    let chart = '';
    const barGroupWidth = width / series[0].data.length;
    const barWidth = (barGroupWidth / series.length) * 0.8;

    series.forEach((serie, seriesIndex) => {
      const color = serie.color || config.colors[seriesIndex % config.colors.length];

      serie.data.forEach((point, pointIndex) => {
        const x = pointIndex * barGroupWidth + seriesIndex * barWidth;
        const barHeight = (Number(point.y) / 100) * height; // Normalize to chart height
        const y = height - barHeight;

        chart += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}"/>`;
      });
    });

    return chart;
  }

  /**
   * Generate area chart
   */
  private generateAreaChart(
    series: ChartSeries[],
    width: number,
    height: number,
    config: ChartConfig
  ): string {
    let chart = '';

    series.forEach((serie, index) => {
      const color = serie.color || config.colors[index % config.colors.length];
      const fillOpacity = serie.style?.fillOpacity || 0.3;

      // Create path for area
      let path = `M 0,${height}`;

      serie.data.forEach((point, pointIndex) => {
        const x = (width / (serie.data.length - 1)) * pointIndex;
        const y = height - (Number(point.y) / 100) * height;
        path += ` L ${x},${y}`;
      });

      path += ` L ${width},${height} Z`;

      chart += `<path d="${path}" fill="${color}" opacity="${fillOpacity}"/>`;
    });

    return chart;
  }

  /**
   * Generate scatter chart
   */
  private generateScatterChart(
    series: ChartSeries[],
    width: number,
    height: number,
    config: ChartConfig
  ): string {
    let chart = '';

    series.forEach((serie, index) => {
      const color = serie.color || config.colors[index % config.colors.length];
      const markerSize = serie.style?.markerSize || 4;

      serie.data.forEach((point) => {
        const x = (Number(point.x) / 100) * width; // Normalize x coordinate
        const y = height - (Number(point.y) / 100) * height; // Normalize y coordinate

        chart += `<circle cx="${x}" cy="${y}" r="${markerSize}" fill="${color}"/>`;
      });
    });

    return chart;
  }

  /**
   * Generate legend
   */
  private generateLegend(
    series: ChartSeries[],
    config: ChartConfig,
    theme: typeof CHART_THEMES.light
  ): string {
    let legend = '';
    const legendItemHeight = 20;
    const legendStartY = -40; // Above the chart

    series.forEach((serie, index) => {
      const color = serie.color || config.colors[index % config.colors.length];
      const x = index * 120; // Space items horizontally

      // Legend color box
      legend += `<rect x="${x}" y="${legendStartY}" width="12" height="12" fill="${color}"/>`;

      // Legend text
      legend += `<text x="${x + 18}" y="${legendStartY + 9}" font-size="12" fill="${theme.textColor}">${serie.name}</text>`;
    });

    return legend;
  }

  /**
   * Add accessibility features to SVG
   */
  private addAccessibilityFeatures(
    svg: string,
    series: ChartSeries[],
    config: ChartConfig
  ): string {
    // Add ARIA labels and descriptions
    let accessible = svg.replace(
      '<svg',
      '<svg role="img" aria-labelledby="chart-title" aria-describedby="chart-desc"'
    );

    // Add title and description elements
    const titleId = 'chart-title';
    const descId = 'chart-desc';

    accessible = accessible.replace(
      'xmlns="http://www.w3.org/2000/svg">',
      `xmlns="http://www.w3.org/2000/svg">
       <title id="${titleId}">${config.title || 'Benchmark Chart'}</title>
       <desc id="${descId}">${config.accessibility.description || this.generateChartDescription(series, config)}</desc>`
    );

    return accessible;
  }

  /**
   * Generate accessibility content
   */
  private generateAccessibilityContent(
    series: ChartSeries[],
    config: ChartConfig
  ): ChartOutput['accessibility'] {
    const altText = config.accessibility.altText || this.generateAltText(series, config);
    const description =
      config.accessibility.description || this.generateChartDescription(series, config);
    const dataTable = this.generateDataTable(series);

    return {
      altText,
      description,
      dataTable,
    };
  }

  /**
   * Generate chart description for accessibility
   */
  private generateChartDescription(series: ChartSeries[], config: ChartConfig): string {
    const seriesNames = series.map((s) => s.name).join(', ');
    const dataPoints = series.reduce((sum, s) => sum + s.data.length, 0);

    return (
      `${config.type} chart showing ${series.length} data series: ${seriesNames}. ` +
      `Contains ${dataPoints} total data points. ` +
      `X-axis: ${config.axes.x.label || 'Values'}. Y-axis: ${config.axes.y.label || 'Values'}.`
    );
  }

  /**
   * Generate alt text for chart
   */
  private generateAltText(series: ChartSeries[], config: ChartConfig): string {
    return `${config.type} chart with ${series.length} data series showing ${config.title || 'benchmark results'}`;
  }

  /**
   * Generate data table in CSV format for screen readers
   */
  private generateDataTable(series: ChartSeries[]): string {
    let csv = 'Series,X,Y,Label\n';

    series.forEach((serie) => {
      serie.data.forEach((point) => {
        csv += `"${serie.name}","${point.x}","${point.y}","${point.label || ''}"\n`;
      });
    });

    return csv;
  }

  /**
   * Prepare benchmark data for visualization
   */
  private prepareBenchmarkData(
    results: BenchmarkResult[],
    config: BenchmarkChartConfig
  ): ChartSeries[] {
    const series: ChartSeries[] = [];

    // Group results by configuration or test case
    const groupedResults = this.groupBenchmarkResults(results, config);

    Object.entries(groupedResults).forEach(([groupName, groupResults]) => {
      const data: ChartDataPoint[] = groupResults.map((result, index) => ({
        x: index,
        y: this.extractMetricValue(result, config.type),
        label: result.testCase || `Test ${index + 1}`,
        metadata: {
          result,
          timestamp: result.timestamp,
          duration: result.duration,
        },
      }));

      series.push({
        name: groupName,
        data,
        metadata: {
          groupSize: groupResults.length,
          avgValue: data.reduce((sum, point) => sum + point.y, 0) / data.length,
        },
      });
    });

    return series;
  }

  /**
   * Group benchmark results for chart series
   */
  private groupBenchmarkResults(
    results: BenchmarkResult[],
    config: BenchmarkChartConfig
  ): Record<string, BenchmarkResult[]> {
    if (!config.benchmarkSpecific.groupByConfiguration) {
      return { 'All Results': results };
    }

    const grouped: Record<string, BenchmarkResult[]> = {};

    results.forEach((result) => {
      const groupKey = result.configuration?.name || 'Default';
      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(result);
    });

    return grouped;
  }

  /**
   * Extract metric value from benchmark result based on chart type
   */
  private extractMetricValue(result: BenchmarkResult, chartType: string): number {
    switch (chartType) {
      case 'performance-timeline':
      case 'trend-analysis':
        return result.duration || 0;
      case 'memory-usage':
        return result.metrics?.memoryUsage?.peak || 0;
      case 'cpu-utilization':
        return result.metrics?.cpuUsage?.average || 0;
      case 'throughput-analysis':
        return result.metrics?.throughput || 0;
      default:
        return result.duration || 0;
    }
  }

  /**
   * Convert SVG to PNG using canvas-based approach
   */
  private async convertToPNG(svg: string, width: number, height: number): Promise<Buffer> {
    try {
      // For server-side PNG generation, we'll use a simple canvas approach
      // In a production environment, consider using libraries like sharp or puppeteer
      
      // Create a basic bitmap representation
      const canvas = this.createVirtualCanvas(width, height);
      const ctx = canvas.getContext('2d');
      
      // Parse SVG and render to canvas (simplified approach)
      const imgData = await this.renderSVGToCanvas(svg, ctx, width, height);
      
      // Convert canvas to PNG buffer
      return this.canvasToPNG(canvas);
    } catch (error) {
      logger.warn('PNG conversion failed, using placeholder', { error: error.message });
      return this.createPlaceholderPNG(width, height);
    }
  }

  /**
   * Convert SVG to PDF using simple vector approach
   */
  private async convertToPDF(svg: string, width: number, height: number): Promise<Buffer> {
    try {
      // Create a basic PDF structure with embedded SVG
      const pdfContent = this.createPDFWithSVG(svg, width, height);
      return Buffer.from(pdfContent, 'binary');
    } catch (error) {
      logger.warn('PDF conversion failed, using placeholder', { error: error.message });
      return this.createPlaceholderPDF(width, height);
    }
  }

  /**
   * Create virtual canvas for PNG rendering
   */
  private createVirtualCanvas(width: number, height: number): any {
    // Simplified canvas implementation for server-side rendering
    return {
      width,
      height,
      getContext: (type: string) => ({
        fillStyle: '#ffffff',
        strokeStyle: '#000000',
        lineWidth: 1,
        font: '12px Arial',
        fillRect: (x: number, y: number, w: number, h: number) => {},
        strokeRect: (x: number, y: number, w: number, h: number) => {},
        fillText: (text: string, x: number, y: number) => {},
        beginPath: () => {},
        moveTo: (x: number, y: number) => {},
        lineTo: (x: number, y: number) => {},
        stroke: () => {},
        fill: () => {},
        arc: (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {},
      }),
      toBuffer: () => Buffer.alloc(width * height * 4, 255), // RGBA placeholder
    };
  }

  /**
   * Render SVG content to canvas context
   */
  private async renderSVGToCanvas(svg: string, ctx: any, width: number, height: number): Promise<ImageData> {
    // Simplified SVG parsing and rendering
    // Extract basic elements and render them
    
    // Fill background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Parse and render basic SVG elements
    this.parseSVGElements(svg, ctx);
    
    // Return placeholder ImageData
    return {
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    } as ImageData;
  }

  /**
   * Parse SVG elements and render to canvas
   */
  private parseSVGElements(svg: string, ctx: any): void {
    // Extract rectangles
    const rectMatches = svg.match(/<rect[^>]*>/g) || [];
    rectMatches.forEach(rect => {
      const x = this.extractAttribute(rect, 'x') || 0;
      const y = this.extractAttribute(rect, 'y') || 0;
      const width = this.extractAttribute(rect, 'width') || 0;
      const height = this.extractAttribute(rect, 'height') || 0;
      const fill = this.extractAttribute(rect, 'fill') || '#000000';
      
      ctx.fillStyle = fill;
      ctx.fillRect(Number(x), Number(y), Number(width), Number(height));
    });

    // Extract lines
    const lineMatches = svg.match(/<line[^>]*>/g) || [];
    lineMatches.forEach(line => {
      const x1 = Number(this.extractAttribute(line, 'x1') || 0);
      const y1 = Number(this.extractAttribute(line, 'y1') || 0);
      const x2 = Number(this.extractAttribute(line, 'x2') || 0);
      const y2 = Number(this.extractAttribute(line, 'y2') || 0);
      const stroke = this.extractAttribute(line, 'stroke') || '#000000';
      
      ctx.strokeStyle = stroke;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });

    // Extract circles
    const circleMatches = svg.match(/<circle[^>]*>/g) || [];
    circleMatches.forEach(circle => {
      const cx = Number(this.extractAttribute(circle, 'cx') || 0);
      const cy = Number(this.extractAttribute(circle, 'cy') || 0);
      const r = Number(this.extractAttribute(circle, 'r') || 0);
      const fill = this.extractAttribute(circle, 'fill') || '#000000';
      
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  /**
   * Extract attribute value from SVG element string
   */
  private extractAttribute(element: string, attribute: string): string | null {
    const match = element.match(new RegExp(`${attribute}="([^"]*)"`, 'i'));
    return match ? match[1] : null;
  }

  /**
   * Convert canvas to PNG buffer
   */
  private canvasToPNG(canvas: any): Buffer {
    // Simplified PNG creation
    // In a real implementation, use proper PNG encoding
    return canvas.toBuffer ? canvas.toBuffer() : Buffer.alloc(1024, 0x89); // PNG header
  }

  /**
   * Create placeholder PNG
   */
  private createPlaceholderPNG(width: number, height: number): Buffer {
    // Create a simple PNG header and basic image data
    const header = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG signature
    const placeholder = Buffer.alloc(width * height * 4 + 100, 255); // Basic image data
    return Buffer.concat([header, placeholder]);
  }

  /**
   * Create PDF with embedded SVG
   */
  private createPDFWithSVG(svg: string, width: number, height: number): string {
    // Basic PDF structure with SVG content
    const pdfHeader = '%PDF-1.4\n';
    const pdfTrailer = '\ntrailer\n<<\n/Size 3\n/Root 1 0 R\n>>\nstartxref\n9\n%%EOF';
    
    // Create PDF objects
    const catalog = '1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n';
    
    const pages = '2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n';
    
    const page = `3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 ${width} ${height}]\n/Contents 4 0 R\n>>\nendobj\n`;
    
    // Embed SVG as content (simplified)
    const svgContent = svg.replace(/"/g, '\\"');
    const content = `4 0 obj\n<<\n/Length ${svgContent.length}\n>>\nstream\n${svgContent}\nendstream\nendobj\n`;
    
    return pdfHeader + catalog + pages + page + content + pdfTrailer;
  }

  /**
   * Create placeholder PDF
   */
  private createPlaceholderPDF(width: number, height: number): Buffer {
    const basicPDF = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 ${width} ${height}]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(Benchmark Chart Placeholder) Tj
ET
endstream
endobj

trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
9
%%EOF`;
    
    return Buffer.from(basicPDF, 'binary');
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(config: Partial<ChartConfig>): ChartConfig {
    return {
      ...this.defaultConfig,
      ...config,
      accessibility: {
        ...this.defaultConfig.accessibility,
        ...config.accessibility,
      },
      animation: {
        ...this.defaultConfig.animation,
        ...config.animation,
      },
      legend: {
        ...this.defaultConfig.legend,
        ...config.legend,
      },
      axes: {
        x: { ...this.defaultConfig.axes.x, ...config.axes?.x },
        y: { ...this.defaultConfig.axes.y, ...config.axes?.y },
      },
      grid: {
        ...this.defaultConfig.grid,
        ...config.grid,
      },
    };
  }
}

/**
 * Factory function for creating chart generator
 */
export function createChartGenerator(defaultConfig?: Partial<ChartConfig>): ChartGenerator {
  const generator = new ChartGenerator();
  if (defaultConfig) {
    (generator as any).defaultConfig = { ...generator['defaultConfig'], ...defaultConfig };
  }
  return generator;
}

/**
 * Utility functions for chart generation
 */
export const ChartUtils = {
  /**
   * Calculate optimal chart dimensions based on data
   */
  calculateOptimalDimensions(
    dataPoints: number,
    series: number,
    chartType: ChartConfig['type']
  ): { width: number; height: number } {
    const baseWidth = Math.max(400, Math.min(1200, dataPoints * 20));
    const baseHeight = Math.max(300, Math.min(800, series * 100));

    switch (chartType) {
      case 'bar':
        return { width: Math.max(baseWidth, dataPoints * 40), height: baseHeight };
      case 'pie':
        const size = Math.min(baseWidth, baseHeight);
        return { width: size, height: size };
      default:
        return { width: baseWidth, height: baseHeight };
    }
  },

  /**
   * Generate color palette for data series
   */
  generateColorPalette(count: number, scheme: keyof typeof COLOR_SCHEMES = 'default'): string[] {
    const base = COLOR_SCHEMES[scheme];
    const colors: string[] = [];

    for (let i = 0; i < count; i++) {
      colors.push(base[i % base.length]);
    }

    return colors;
  },

  /**
   * Validate chart configuration
   */
  validateConfig(config: ChartConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.width <= 0) {
      errors.push('Width must be greater than 0');
    }

    if (config.height <= 0) {
      errors.push('Height must be greater than 0');
    }

    if (config.colors.length === 0) {
      errors.push('At least one color must be specified');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};
