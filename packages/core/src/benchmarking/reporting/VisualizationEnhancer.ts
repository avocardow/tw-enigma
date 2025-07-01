import { createLogger } from '../../utils/logger';
import { BenchmarkResult } from '../types';
import { ChartOutput } from '../visualization/ChartGenerator';

const logger = createLogger('VisualizationEnhancer');

/**
 * Enhanced visualization configuration
 */
export interface EnhancedVisualizationConfig {
  animations: {
    enabled: boolean;
    duration: number;
    easing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
    stagger: boolean;
  };
  interactions: {
    hover: boolean;
    click: boolean;
    zoom: boolean;
    pan: boolean;
    brush: boolean;
  };
  annotations: {
    enabled: boolean;
    thresholds: boolean;
    trends: boolean;
    outliers: boolean;
    regressions: boolean;
  };
  overlays: {
    statisticalBands: boolean;
    trendLines: boolean;
    benchmarks: boolean;
    targets: boolean;
  };
  customizations: {
    themes: string[];
    colorPalettes: Record<string, string[]>;
    fonts: string[];
    layouts: string[];
  };
}

/**
 * Statistical analysis data
 */
export interface StatisticalData {
  mean: number;
  median: number;
  mode: number;
  standardDeviation: number;
  variance: number;
  min: number;
  max: number;
  quartiles: {
    q1: number;
    q2: number;
    q3: number;
  };
  outliers: number[];
  trend: {
    direction: 'increasing' | 'decreasing' | 'stable';
    strength: number;
    confidence: number;
  };
}

/**
 * Enhanced chart with statistical overlays and interactions
 */
export interface EnhancedChart extends ChartOutput {
  statistical: StatisticalData;
  annotations: ChartAnnotation[];
  interactions: ChartInteraction[];
  overlays: ChartOverlay[];
  enhanced: true;
}

/**
 * Chart annotation for highlighting important data points
 */
export interface ChartAnnotation {
  type: 'threshold' | 'trend' | 'outlier' | 'regression' | 'target';
  x: number;
  y: number;
  text: string;
  style: {
    color: string;
    backgroundColor: string;
    borderColor: string;
    fontSize: number;
  };
  anchor: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

/**
 * Chart interaction definition
 */
export interface ChartInteraction {
  type: 'hover' | 'click' | 'zoom' | 'pan' | 'brush';
  element: string;
  action: string;
  data?: any;
}

/**
 * Chart overlay for additional visual information
 */
export interface ChartOverlay {
  type: 'trendline' | 'band' | 'benchmark' | 'target' | 'grid';
  data: any;
  style: {
    color: string;
    opacity: number;
    strokeWidth: number;
    strokeDashArray?: string;
  };
  zIndex: number;
}

/**
 * Visualization enhancer for creating rich, interactive benchmark charts
 */
export class VisualizationEnhancer {
  private config: EnhancedVisualizationConfig;

  constructor(config: Partial<EnhancedVisualizationConfig> = {}) {
    this.config = this.mergeConfig(config);
  }

  /**
   * Enhance existing chart with advanced features
   */
  async enhanceChart(
    chart: ChartOutput,
    results: BenchmarkResult[],
    enhancements: string[] = ['statistical', 'annotations', 'interactions']
  ): Promise<EnhancedChart> {
    logger.info('Enhancing chart with features', { enhancements });

    const enhancedChart: EnhancedChart = {
      ...chart,
      statistical: this.calculateStatisticalData(results),
      annotations: [],
      interactions: [],
      overlays: [],
      enhanced: true,
    };

    // Apply enhancements
    for (const enhancement of enhancements) {
      switch (enhancement) {
        case 'statistical':
          this.addStatisticalOverlays(enhancedChart);
          break;
        case 'annotations':
          this.addSmartAnnotations(enhancedChart, results);
          break;
        case 'interactions':
          this.addInteractivity(enhancedChart);
          break;
        case 'animations':
          this.addAnimations(enhancedChart);
          break;
        case 'themes':
          this.applyAdvancedTheming(enhancedChart);
          break;
      }
    }

    // Regenerate SVG with enhancements
    enhancedChart.svg = await this.regenerateEnhancedSVG(enhancedChart);

    logger.info('Chart enhancement completed', {
      enhancements: enhancements.length,
      annotations: enhancedChart.annotations.length,
      overlays: enhancedChart.overlays.length,
    });

    return enhancedChart;
  }

  /**
   * Create performance comparison visualization
   */
  async createComparisonVisualization(
    currentResults: BenchmarkResult[],
    baselineResults: BenchmarkResult[],
    config: Partial<EnhancedVisualizationConfig> = {}
  ): Promise<EnhancedChart> {
    logger.info('Creating performance comparison visualization');

    const mergedConfig = { ...this.config, ...config };
    
    // Calculate performance differences
    const differences = this.calculatePerformanceDifferences(currentResults, baselineResults);
    
    // Create base comparison chart
    const baseChart = await this.createBaseComparisonChart(differences, mergedConfig);
    
    // Enhance with comparison-specific features
    return this.enhanceChart(baseChart, currentResults, [
      'statistical',
      'annotations',
      'interactions',
      'animations'
    ]);
  }

  /**
   * Create trend analysis visualization
   */
  async createTrendVisualization(
    historicalResults: BenchmarkResult[][],
    config: Partial<EnhancedVisualizationConfig> = {}
  ): Promise<EnhancedChart> {
    logger.info('Creating trend analysis visualization');

    const mergedConfig = { ...this.config, ...config };
    
    // Calculate trend data
    const trendData = this.calculateTrendData(historicalResults);
    
    // Create base trend chart
    const baseChart = await this.createBaseTrendChart(trendData, mergedConfig);
    
    // Enhance with trend-specific features
    return this.enhanceChart(baseChart, historicalResults.flat(), [
      'statistical',
      'annotations',
      'interactions',
      'animations'
    ]);
  }

  /**
   * Calculate statistical data from benchmark results
   */
  private calculateStatisticalData(results: BenchmarkResult[]): StatisticalData {
    const durations = results.map(r => r.duration).sort((a, b) => a - b);
    const n = durations.length;

    if (n === 0) {
      throw new Error('No data available for statistical analysis');
    }

    const mean = durations.reduce((sum, val) => sum + val, 0) / n;
    const median = n % 2 === 0 
      ? (durations[n/2 - 1] + durations[n/2]) / 2 
      : durations[Math.floor(n/2)];

    // Calculate mode (most frequent value, approximately)
    const mode = this.calculateMode(durations);

    // Calculate variance and standard deviation
    const variance = durations.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const standardDeviation = Math.sqrt(variance);

    // Calculate quartiles
    const q1 = this.calculatePercentile(durations, 25);
    const q2 = median;
    const q3 = this.calculatePercentile(durations, 75);

    // Identify outliers using IQR method
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    const outliers = durations.filter(val => val < lowerBound || val > upperBound);

    // Calculate trend
    const trend = this.calculateTrend(durations);

    return {
      mean,
      median,
      mode,
      standardDeviation,
      variance,
      min: durations[0],
      max: durations[n - 1],
      quartiles: { q1, q2, q3 },
      outliers,
      trend,
    };
  }

  /**
   * Calculate mode (most frequent value)
   */
  private calculateMode(values: number[]): number {
    const frequency: Record<number, number> = {};
    values.forEach(val => {
      const rounded = Math.round(val * 100) / 100; // Round to 2 decimal places
      frequency[rounded] = (frequency[rounded] || 0) + 1;
    });

    let maxFreq = 0;
    let mode = values[0];
    
    Object.entries(frequency).forEach(([val, freq]) => {
      if (freq > maxFreq) {
        maxFreq = freq;
        mode = Number(val);
      }
    });

    return mode;
  }

  /**
   * Calculate percentile value
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Calculate trend direction and strength
   */
  private calculateTrend(values: number[]): StatisticalData['trend'] {
    if (values.length < 2) {
      return { direction: 'stable', strength: 0, confidence: 0 };
    }

    // Simple linear regression to determine trend
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    // Calculate correlation coefficient for confidence
    const meanX = sumX / n;
    const meanY = sumY / n;
    const numerator = x.reduce((sum, val, i) => sum + (val - meanX) * (y[i] - meanY), 0);
    const denomX = Math.sqrt(x.reduce((sum, val) => sum + Math.pow(val - meanX, 2), 0));
    const denomY = Math.sqrt(y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0));
    const correlation = numerator / (denomX * denomY);

    const direction = slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable';
    const strength = Math.abs(slope);
    const confidence = Math.abs(correlation);

    return { direction, strength, confidence };
  }

  /**
   * Add statistical overlays to chart
   */
  private addStatisticalOverlays(chart: EnhancedChart): void {
    const stats = chart.statistical;

    // Add mean line
    chart.overlays.push({
      type: 'benchmark',
      data: { value: stats.mean, label: 'Mean' },
      style: {
        color: '#2563eb',
        opacity: 0.7,
        strokeWidth: 2,
        strokeDashArray: '5,5',
      },
      zIndex: 10,
    });

    // Add standard deviation bands
    chart.overlays.push({
      type: 'band',
      data: {
        upper: stats.mean + stats.standardDeviation,
        lower: stats.mean - stats.standardDeviation,
        label: '±1σ',
      },
      style: {
        color: '#3b82f6',
        opacity: 0.2,
        strokeWidth: 0,
      },
      zIndex: 5,
    });

    // Add trend line if trend is significant
    if (stats.trend.confidence > 0.5) {
      chart.overlays.push({
        type: 'trendline',
        data: {
          direction: stats.trend.direction,
          strength: stats.trend.strength,
          confidence: stats.trend.confidence,
        },
        style: {
          color: stats.trend.direction === 'increasing' ? '#ef4444' : '#10b981',
          opacity: 0.8,
          strokeWidth: 2,
        },
        zIndex: 15,
      });
    }
  }

  /**
   * Add smart annotations based on data analysis
   */
  private addSmartAnnotations(chart: EnhancedChart, results: BenchmarkResult[]): void {
    const stats = chart.statistical;

    // Annotate outliers
    stats.outliers.forEach(outlier => {
      const isHigh = outlier > stats.mean;
      chart.annotations.push({
        type: 'outlier',
        x: this.findDataPointX(results, outlier),
        y: outlier,
        text: `Outlier: ${outlier.toFixed(2)}ms`,
        style: {
          color: isHigh ? '#ef4444' : '#10b981',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderColor: isHigh ? '#ef4444' : '#10b981',
          fontSize: 12,
        },
        anchor: isHigh ? 'bottom' : 'top',
      });
    });

    // Annotate significant trend
    if (stats.trend.confidence > 0.7) {
      chart.annotations.push({
        type: 'trend',
        x: results.length * 0.8,
        y: stats.mean,
        text: `${stats.trend.direction} trend (${(stats.trend.confidence * 100).toFixed(1)}% confidence)`,
        style: {
          color: '#6b7280',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderColor: '#d1d5db',
          fontSize: 14,
        },
        anchor: 'left',
      });
    }

    // Annotate performance thresholds
    if (this.config.annotations.thresholds) {
      const threshold = stats.mean * 1.5; // 50% above mean is considered slow
      chart.annotations.push({
        type: 'threshold',
        x: 0,
        y: threshold,
        text: `Performance Threshold: ${threshold.toFixed(2)}ms`,
        style: {
          color: '#f59e0b',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderColor: '#f59e0b',
          fontSize: 12,
        },
        anchor: 'right',
      });
    }
  }

  /**
   * Add interactivity features to chart
   */
  private addInteractivity(chart: EnhancedChart): void {
    if (this.config.interactions.hover) {
      chart.interactions.push({
        type: 'hover',
        element: 'data-point',
        action: 'show-tooltip',
        data: { showStatistics: true },
      });
    }

    if (this.config.interactions.click) {
      chart.interactions.push({
        type: 'click',
        element: 'data-point',
        action: 'show-details',
        data: { expandMetrics: true },
      });
    }

    if (this.config.interactions.zoom) {
      chart.interactions.push({
        type: 'zoom',
        element: 'chart-area',
        action: 'zoom-to-selection',
        data: { minZoom: 0.1, maxZoom: 10 },
      });
    }

    if (this.config.interactions.pan) {
      chart.interactions.push({
        type: 'pan',
        element: 'chart-area',
        action: 'pan-view',
        data: { enableX: true, enableY: true },
      });
    }
  }

  /**
   * Add animation features to chart
   */
  private addAnimations(chart: EnhancedChart): void {
    if (!this.config.animations.enabled) return;

    // Add entrance animations
    chart.svg = this.addSVGAnimations(chart.svg, {
      duration: this.config.animations.duration,
      easing: this.config.animations.easing,
      stagger: this.config.animations.stagger,
    });
  }

  /**
   * Apply advanced theming to chart
   */
  private applyAdvancedTheming(chart: EnhancedChart): void {
    // Apply custom color palette
    if (this.config.customizations.colorPalettes) {
      chart.svg = this.applyColorPalette(chart.svg, this.config.customizations.colorPalettes);
    }

    // Apply custom fonts
    if (this.config.customizations.fonts) {
      chart.svg = this.applyCustomFonts(chart.svg, this.config.customizations.fonts);
    }
  }

  /**
   * Calculate performance differences between current and baseline
   */
  private calculatePerformanceDifferences(
    current: BenchmarkResult[],
    baseline: BenchmarkResult[]
  ): any[] {
    // Implementation for calculating performance differences
    return current.map((result, index) => {
      const baselineResult = baseline[index];
      if (!baselineResult) return null;

      return {
        name: result.name,
        current: result.duration,
        baseline: baselineResult.duration,
        difference: result.duration - baselineResult.duration,
        percentChange: ((result.duration - baselineResult.duration) / baselineResult.duration) * 100,
      };
    }).filter(Boolean);
  }

  /**
   * Calculate trend data from historical results
   */
  private calculateTrendData(historicalResults: BenchmarkResult[][]): any {
    // Implementation for calculating trend data
    return {
      periods: historicalResults.length,
      averages: historicalResults.map(results => 
        results.reduce((sum, r) => sum + r.duration, 0) / results.length
      ),
      trends: historicalResults.map(results => this.calculateStatisticalData(results).trend),
    };
  }

  /**
   * Find X coordinate for a data point with given value
   */
  private findDataPointX(results: BenchmarkResult[], value: number): number {
    const index = results.findIndex(r => Math.abs(r.duration - value) < 0.01);
    return index >= 0 ? index : 0;
  }

  /**
   * Add SVG animations
   */
  private addSVGAnimations(svg: string, animationConfig: any): string {
    // Add CSS animations to SVG elements
    const animationCSS = `
      <style>
        .chart-element {
          animation: fadeIn ${animationConfig.duration}ms ${animationConfig.easing};
        }
        .chart-data-point {
          animation: scaleIn ${animationConfig.duration}ms ${animationConfig.easing};
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }
      </style>
    `;

    return svg.replace('<svg', `${animationCSS}<svg`);
  }

  /**
   * Apply color palette to SVG
   */
  private applyColorPalette(svg: string, palettes: Record<string, string[]>): string {
    // Implementation for applying color palettes
    return svg; // Placeholder
  }

  /**
   * Apply custom fonts to SVG
   */
  private applyCustomFonts(svg: string, fonts: string[]): string {
    // Implementation for applying custom fonts
    return svg; // Placeholder
  }

  /**
   * Create base comparison chart
   */
  private async createBaseComparisonChart(differences: any[], config: any): Promise<ChartOutput> {
    // Implementation for creating comparison chart
    return {
      svg: '<svg>Comparison Chart Placeholder</svg>',
      config: config as any,
      metadata: {
        generatedAt: new Date(),
        dataPoints: differences.length,
        series: 1,
        dimensions: { width: 800, height: 400 },
      },
      accessibility: {
        altText: 'Performance comparison chart',
        description: 'Chart comparing current performance against baseline',
        dataTable: 'CSV data table placeholder',
      },
    };
  }

  /**
   * Create base trend chart
   */
  private async createBaseTrendChart(trendData: any, config: any): Promise<ChartOutput> {
    // Implementation for creating trend chart
    return {
      svg: '<svg>Trend Chart Placeholder</svg>',
      config: config as any,
      metadata: {
        generatedAt: new Date(),
        dataPoints: trendData.periods,
        series: 1,
        dimensions: { width: 800, height: 400 },
      },
      accessibility: {
        altText: 'Performance trend chart',
        description: 'Chart showing performance trends over time',
        dataTable: 'CSV data table placeholder',
      },
    };
  }

  /**
   * Regenerate SVG with all enhancements
   */
  private async regenerateEnhancedSVG(chart: EnhancedChart): Promise<string> {
    let svg = chart.svg;

    // Add overlays to SVG
    chart.overlays.forEach(overlay => {
      svg = this.addOverlayToSVG(svg, overlay);
    });

    // Add annotations to SVG
    chart.annotations.forEach(annotation => {
      svg = this.addAnnotationToSVG(svg, annotation);
    });

    // Add interaction handlers
    chart.interactions.forEach(interaction => {
      svg = this.addInteractionToSVG(svg, interaction);
    });

    return svg;
  }

  /**
   * Add overlay to SVG
   */
  private addOverlayToSVG(svg: string, overlay: ChartOverlay): string {
    // Implementation for adding overlays
    return svg;
  }

  /**
   * Add annotation to SVG
   */
  private addAnnotationToSVG(svg: string, annotation: ChartAnnotation): string {
    // Implementation for adding annotations
    return svg;
  }

  /**
   * Add interaction to SVG
   */
  private addInteractionToSVG(svg: string, interaction: ChartInteraction): string {
    // Implementation for adding interactions
    return svg;
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(config: Partial<EnhancedVisualizationConfig>): EnhancedVisualizationConfig {
    const defaults: EnhancedVisualizationConfig = {
      animations: {
        enabled: true,
        duration: 1000,
        easing: 'ease-in-out',
        stagger: true,
      },
      interactions: {
        hover: true,
        click: true,
        zoom: true,
        pan: true,
        brush: false,
      },
      annotations: {
        enabled: true,
        thresholds: true,
        trends: true,
        outliers: true,
        regressions: true,
      },
      overlays: {
        statisticalBands: true,
        trendLines: true,
        benchmarks: true,
        targets: false,
      },
      customizations: {
        themes: ['light', 'dark', 'high-contrast'],
        colorPalettes: {
          default: ['#2563eb', '#dc2626', '#16a34a', '#f59e0b'],
          accessible: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'],
        },
        fonts: ['Inter', 'Roboto', 'Arial'],
        layouts: ['standard', 'compact', 'detailed'],
      },
    };

    return {
      ...defaults,
      ...config,
      animations: { ...defaults.animations, ...config.animations },
      interactions: { ...defaults.interactions, ...config.interactions },
      annotations: { ...defaults.annotations, ...config.annotations },
      overlays: { ...defaults.overlays, ...config.overlays },
      customizations: { ...defaults.customizations, ...config.customizations },
    };
  }
}

/**
 * Factory function for creating visualization enhancer
 */
export function createVisualizationEnhancer(
  config?: Partial<EnhancedVisualizationConfig>
): VisualizationEnhancer {
  return new VisualizationEnhancer(config);
}

/**
 * Utility functions for visualization enhancement
 */
export const VisualizationUtils = {
  /**
   * Calculate optimal chart dimensions based on data
   */
  calculateOptimalDimensions(dataPoints: number, metrics: number): { width: number; height: number } {
    const baseWidth = Math.max(600, Math.min(1400, dataPoints * 15));
    const baseHeight = Math.max(400, Math.min(800, metrics * 80 + 200));
    return { width: baseWidth, height: baseHeight };
  },

  /**
   * Generate accessible color palette
   */
  generateAccessiblePalette(count: number): string[] {
    const baseColors = [
      '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728',
      '#9467bd', '#8c564b', '#e377c2', '#7f7f7f',
      '#bcbd22', '#17becf'
    ];
    
    const palette: string[] = [];
    for (let i = 0; i < count; i++) {
      palette.push(baseColors[i % baseColors.length]);
    }
    
    return palette;
  },

  /**
   * Validate chart configuration
   */
  validateEnhancedConfig(config: EnhancedVisualizationConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.animations.duration < 0) {
      errors.push('Animation duration must be non-negative');
    }

    if (config.customizations.colorPalettes) {
      Object.entries(config.customizations.colorPalettes).forEach(([name, colors]) => {
        if (colors.length === 0) {
          errors.push(`Color palette '${name}' must have at least one color`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};