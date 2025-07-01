/**
 * TW-Enigma Profiling Data Exporter
 *
 * Comprehensive profiling data export functionality supporting multiple formats
 * and analysis tools. Enables seamless integration with external profiling
 * and monitoring systems.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { createLogger } from '../../utils/logger';
import { BenchmarkProfilingData, DetailedBottleneck } from './BenchmarkProfiler';
import { BottleneckAnalysisReport } from './BottleneckAnalyzer';

const logger = createLogger('ProfilingExporter');

/**
 * Export configuration for profiling data
 */
export interface ProfilingExportConfig {
  formats: ExportFormat[];
  outputDirectory: string;
  compression: boolean;
  includeRawData: boolean;
  includeMetadata: boolean;
  customFormatters: Map<string, CustomFormatter>;
  maxFileSize: number; // bytes
  retentionDays: number;
  enablePartitioning: boolean;
  partitionSize: number;
}

/**
 * Supported export formats
 */
export type ExportFormat = 
  | 'json'
  | 'csv'
  | 'flamegraph'
  | 'chrome-trace'
  | 'speedscope'
  | 'pprof'
  | 'jaeger'
  | 'opentelemetry'
  | 'perfetto'
  | 'html-report'
  | 'markdown-report'
  | 'pdf-report';

/**
 * Custom formatter interface
 */
export interface CustomFormatter {
  name: string;
  extension: string;
  format(data: BenchmarkProfilingData[], config: ProfilingExportConfig): Promise<string | Buffer>;
  validate?(data: BenchmarkProfilingData[]): boolean;
}

/**
 * Export result information
 */
export interface ExportResult {
  format: ExportFormat;
  filePath: string;
  fileSize: number;
  checksum: string;
  compressionRatio?: number;
  metadata: {
    dataPoints: number;
    timeRange: { start: number; end: number };
    exportTime: number;
    version: string;
  };
}

/**
 * Export batch for multiple datasets
 */
export interface ExportBatch {
  id: string;
  datasets: {
    name: string;
    data: BenchmarkProfilingData[];
    analysis?: BottleneckAnalysisReport;
  }[];
  config: ProfilingExportConfig;
  results: ExportResult[];
}

/**
 * Chrome DevTools trace format
 */
interface ChromeTraceEvent {
  name: string;
  cat: string;
  ph: 'B' | 'E' | 'X' | 'I' | 'C';
  ts: number;
  dur?: number;
  pid: number;
  tid: number;
  args?: Record<string, any>;
}

/**
 * Speedscope profile format
 */
interface SpeedscopeProfile {
  $schema: string;
  profiles: Array<{
    type: 'sampled' | 'evented';
    name: string;
    unit: 'microseconds' | 'milliseconds' | 'seconds';
    startValue: number;
    endValue: number;
    samples: Array<[number, number]>; // [stackId, weight]
    weights: number[];
  }>;
  shared: {
    frames: Array<{
      name: string;
      file?: string;
      line?: number;
      col?: number;
    }>;
  };
}

/**
 * Jaeger trace format
 */
interface JaegerTrace {
  traceID: string;
  spans: Array<{
    traceID: string;
    spanID: string;
    parentSpanID?: string;
    operationName: string;
    startTime: number;
    duration: number;
    tags: Array<{ key: string; value: any }>;
    logs: Array<{
      timestamp: number;
      fields: Array<{ key: string; value: any }>;
    }>;
    process: {
      serviceName: string;
      tags: Array<{ key: string; value: any }>;
    };
  }>;
}

/**
 * OpenTelemetry trace format
 */
interface OpenTelemetryTrace {
  resourceSpans: Array<{
    resource: {
      attributes: Array<{ key: string; value: { stringValue?: string; intValue?: number } }>;
    };
    instrumentationLibrarySpans: Array<{
      instrumentationLibrary: { name: string; version: string };
      spans: Array<{
        traceId: string;
        spanId: string;
        parentSpanId?: string;
        name: string;
        kind: number;
        startTimeUnixNano: string;
        endTimeUnixNano: string;
        attributes: Array<{ key: string; value: { stringValue?: string; intValue?: number } }>;
        events: Array<{
          timeUnixNano: string;
          name: string;
          attributes: Array<{ key: string; value: any }>;
        }>;
      }>;
    }>;
  }>;
}

/**
 * Comprehensive profiling data exporter
 */
export class ProfilingExporter {
  private config: ProfilingExportConfig;
  private exportQueue: Map<string, ExportBatch> = new Map();

  constructor(config: Partial<ProfilingExportConfig> = {}) {
    this.config = {
      formats: ['json', 'csv', 'html-report'],
      outputDirectory: './profiling-exports',
      compression: true,
      includeRawData: true,
      includeMetadata: true,
      customFormatters: new Map(),
      maxFileSize: 100 * 1024 * 1024, // 100MB
      retentionDays: 30,
      enablePartitioning: false,
      partitionSize: 1000,
      ...config,
    };

    logger.info('ProfilingExporter initialized', this.config);
  }

  /**
   * Export profiling data in multiple formats
   */
  async exportProfilingData(
    data: BenchmarkProfilingData[],
    analysis?: BottleneckAnalysisReport,
    customConfig?: Partial<ProfilingExportConfig>
  ): Promise<ExportResult[]> {
    const exportConfig = { ...this.config, ...customConfig };
    
    logger.info('Starting profiling data export', {
      dataPoints: data.length,
      formats: exportConfig.formats,
      hasAnalysis: !!analysis,
    });

    // Ensure output directory exists
    await fs.mkdir(exportConfig.outputDirectory, { recursive: true });

    const results: ExportResult[] = [];

    // Process each format
    for (const format of exportConfig.formats) {
      try {
        const result = await this.exportFormat(data, format, exportConfig, analysis);
        results.push(result);
        
        logger.info('Export completed', {
          format,
          filePath: result.filePath,
          fileSize: result.fileSize,
        });
      } catch (error) {
        logger.error('Export failed', {
          format,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Cleanup old files if retention is configured
    if (exportConfig.retentionDays > 0) {
      await this.cleanupOldFiles(exportConfig);
    }

    return results;
  }

  /**
   * Export data in batch mode for multiple datasets
   */
  async exportBatch(batch: Omit<ExportBatch, 'id' | 'results'>): Promise<ExportBatch> {
    const batchId = this.generateBatchId();
    const batchWithId: ExportBatch = {
      id: batchId,
      ...batch,
      results: [],
    };

    logger.info('Starting batch export', {
      batchId,
      datasets: batch.datasets.length,
      formats: batch.config.formats,
    });

    // Process each dataset
    for (const dataset of batch.datasets) {
      try {
        const results = await this.exportProfilingData(
          dataset.data,
          dataset.analysis,
          {
            ...batch.config,
            outputDirectory: path.join(batch.config.outputDirectory, dataset.name),
          }
        );
        batchWithId.results.push(...results);
      } catch (error) {
        logger.error('Batch dataset export failed', {
          batchId,
          dataset: dataset.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Store batch for tracking
    this.exportQueue.set(batchId, batchWithId);

    return batchWithId;
  }

  /**
   * Register custom formatter
   */
  registerCustomFormatter(formatter: CustomFormatter): void {
    this.config.customFormatters.set(formatter.name, formatter);
    logger.info('Custom formatter registered', { name: formatter.name });
  }

  /**
   * Export single format
   */
  private async exportFormat(
    data: BenchmarkProfilingData[],
    format: ExportFormat,
    config: ProfilingExportConfig,
    analysis?: BottleneckAnalysisReport
  ): Promise<ExportResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFilename = `profiling-${timestamp}`;
    
    let content: string | Buffer;
    let extension: string;

    switch (format) {
      case 'json':
        ({ content, extension } = await this.exportJSON(data, config, analysis));
        break;
      case 'csv':
        ({ content, extension } = await this.exportCSV(data, config));
        break;
      case 'flamegraph':
        ({ content, extension } = await this.exportFlamegraph(data, config));
        break;
      case 'chrome-trace':
        ({ content, extension } = await this.exportChromeTrace(data, config));
        break;
      case 'speedscope':
        ({ content, extension } = await this.exportSpeedscope(data, config));
        break;
      case 'pprof':
        ({ content, extension } = await this.exportPprof(data, config));
        break;
      case 'jaeger':
        ({ content, extension } = await this.exportJaeger(data, config));
        break;
      case 'opentelemetry':
        ({ content, extension } = await this.exportOpenTelemetry(data, config));
        break;
      case 'perfetto':
        ({ content, extension } = await this.exportPerfetto(data, config));
        break;
      case 'html-report':
        ({ content, extension } = await this.exportHTMLReport(data, config, analysis));
        break;
      case 'markdown-report':
        ({ content, extension } = await this.exportMarkdownReport(data, config, analysis));
        break;
      case 'pdf-report':
        ({ content, extension } = await this.exportPDFReport(data, config, analysis));
        break;
      default:
        // Try custom formatters
        const customFormatter = config.customFormatters.get(format);
        if (customFormatter) {
          content = await customFormatter.format(data, config);
          extension = customFormatter.extension;
        } else {
          throw new Error(`Unsupported export format: ${format}`);
        }
    }

    const filename = `${baseFilename}.${extension}`;
    const filePath = path.join(config.outputDirectory, filename);

    // Apply compression if enabled
    if (config.compression && typeof content === 'string') {
      const { compress } = await import('zlib');
      const compressed = await new Promise<Buffer>((resolve, reject) => {
        compress(Buffer.from(content, 'utf-8'), (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      content = compressed;
      extension += '.gz';
    }

    // Write file
    await fs.writeFile(filePath, content);

    // Calculate metadata
    const stats = await fs.stat(filePath);
    const checksum = await this.calculateChecksum(filePath);

    const metadata = {
      dataPoints: data.length,
      timeRange: {
        start: Math.min(...data.map(d => d.startTime)),
        end: Math.max(...data.map(d => d.endTime)),
      },
      exportTime: Date.now(),
      version: '1.0.0',
    };

    return {
      format,
      filePath,
      fileSize: stats.size,
      checksum,
      compressionRatio: config.compression && typeof content !== 'string' 
        ? stats.size / Buffer.byteLength(content.toString(), 'utf-8')
        : undefined,
      metadata,
    };
  }

  /**
   * Export as JSON format
   */
  private async exportJSON(
    data: BenchmarkProfilingData[],
    config: ProfilingExportConfig,
    analysis?: BottleneckAnalysisReport
  ): Promise<{ content: string; extension: string }> {
    const exportData = {
      metadata: {
        exportTime: new Date().toISOString(),
        version: '1.0.0',
        dataPoints: data.length,
        includeRawData: config.includeRawData,
        includeMetadata: config.includeMetadata,
      },
      profilingData: config.includeRawData ? data : data.map(d => ({
        benchmarkName: d.benchmarkName,
        benchmarkId: d.benchmarkId,
        duration: d.duration,
        bottlenecks: d.bottlenecks,
        summary: {
          startTime: d.startTime,
          endTime: d.endTime,
          resourceSnapshotCount: d.resourceSnapshots.length,
          bottleneckCount: d.bottlenecks.length,
        },
      })),
      analysis: analysis || null,
    };

    return {
      content: JSON.stringify(exportData, null, 2),
      extension: 'json',
    };
  }

  /**
   * Export as CSV format
   */
  private async exportCSV(
    data: BenchmarkProfilingData[],
    config: ProfilingExportConfig
  ): Promise<{ content: string; extension: string }> {
    const headers = [
      'Benchmark Name',
      'Benchmark ID',
      'Start Time',
      'End Time',
      'Duration (ms)',
      'Bottleneck Count',
      'Peak Memory (MB)',
      'Peak CPU (%)',
      'GC Events',
      'Event Loop Lag (ms)',
    ];

    const rows = data.map(d => {
      const peakMemory = Math.max(...d.resourceSnapshots.map(s => s.memory.heapUsed)) / (1024 * 1024);
      const peakCPU = Math.max(...d.resourceSnapshots.map(s => s.cpu.percent));
      const gcEvents = d.resourceSnapshots.reduce((sum, s) => sum + s.gc.length, 0);
      const avgEventLoopLag = d.resourceSnapshots.reduce((sum, s) => sum + s.eventLoop.lag, 0) / d.resourceSnapshots.length;

      return [
        d.benchmarkName,
        d.benchmarkId,
        new Date(d.startTime).toISOString(),
        new Date(d.endTime).toISOString(),
        d.duration.toFixed(2),
        d.bottlenecks.length,
        peakMemory.toFixed(2),
        peakCPU.toFixed(2),
        gcEvents,
        avgEventLoopLag.toFixed(2),
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return {
      content: csvContent,
      extension: 'csv',
    };
  }

  /**
   * Export as flamegraph format
   */
  private async exportFlamegraph(
    data: BenchmarkProfilingData[],
    config: ProfilingExportConfig
  ): Promise<{ content: string; extension: string }> {
    const stacks: string[] = [];

    for (const d of data) {
      for (const stack of d.callStacks) {
        const stackString = stack.frames.map(f => f.function).join(';');
        const count = Math.round(stack.duration);
        for (let i = 0; i < count; i++) {
          stacks.push(stackString);
        }
      }
    }

    // Flamegraph format: each line is "stack_trace count"
    const stackCounts = new Map<string, number>();
    for (const stack of stacks) {
      stackCounts.set(stack, (stackCounts.get(stack) || 0) + 1);
    }

    const flamegraphContent = Array.from(stackCounts.entries())
      .map(([stack, count]) => `${stack} ${count}`)
      .join('\n');

    return {
      content: flamegraphContent,
      extension: 'flamegraph',
    };
  }

  /**
   * Export as Chrome DevTools trace format
   */
  private async exportChromeTrace(
    data: BenchmarkProfilingData[],
    config: ProfilingExportConfig
  ): Promise<{ content: string; extension: string }> {
    const events: ChromeTraceEvent[] = [];

    for (const d of data) {
      const pid = 1;
      const tid = 1;

      // Add benchmark span
      events.push({
        name: d.benchmarkName,
        cat: 'benchmark',
        ph: 'X',
        ts: d.startTime * 1000, // Chrome trace uses microseconds
        dur: d.duration * 1000,
        pid,
        tid,
        args: {
          benchmarkId: d.benchmarkId,
          iteration: d.iteration,
        },
      });

      // Add bottleneck events
      for (const bottleneck of d.bottlenecks) {
        events.push({
          name: bottleneck.operation,
          cat: 'bottleneck',
          ph: 'I',
          ts: d.startTime * 1000,
          pid,
          tid,
          args: {
            duration: bottleneck.duration,
            impact: bottleneck.impact,
            severity: bottleneck.severity,
          },
        });
      }

      // Add resource snapshots
      for (const snapshot of d.resourceSnapshots) {
        events.push({
          name: 'Memory Usage',
          cat: 'memory',
          ph: 'C',
          ts: snapshot.timestamp * 1000,
          pid,
          tid,
          args: {
            'Heap Used (MB)': snapshot.memory.heapUsed / (1024 * 1024),
            'Heap Total (MB)': snapshot.memory.heapTotal / (1024 * 1024),
          },
        });

        events.push({
          name: 'CPU Usage',
          cat: 'cpu',
          ph: 'C',
          ts: snapshot.timestamp * 1000,
          pid,
          tid,
          args: {
            'CPU (%)': snapshot.cpu.percent,
          },
        });
      }
    }

    const traceData = {
      traceEvents: events,
      displayTimeUnit: 'ms',
      stackFrames: {},
      samples: [],
    };

    return {
      content: JSON.stringify(traceData, null, 2),
      extension: 'json',
    };
  }

  /**
   * Export as Speedscope format
   */
  private async exportSpeedscope(
    data: BenchmarkProfilingData[],
    config: ProfilingExportConfig
  ): Promise<{ content: string; extension: string }> {
    const frames: SpeedscopeProfile['shared']['frames'] = [];
    const frameMap = new Map<string, number>();

    // Build frame index
    for (const d of data) {
      for (const stack of d.callStacks) {
        for (const frame of stack.frames) {
          const key = `${frame.function}:${frame.file}:${frame.line}`;
          if (!frameMap.has(key)) {
            const frameId = frames.length;
            frameMap.set(key, frameId);
            frames.push({
              name: frame.function,
              file: frame.file,
              line: frame.line,
              col: frame.column,
            });
          }
        }
      }
    }

    const profiles: SpeedscopeProfile['profiles'] = [];

    for (const d of data) {
      const samples: Array<[number, number]> = [];
      const weights: number[] = [];

      for (const stack of d.callStacks) {
        if (stack.frames.length > 0) {
          const topFrameKey = `${stack.frames[0].function}:${stack.frames[0].file}:${stack.frames[0].line}`;
          const frameId = frameMap.get(topFrameKey) || 0;
          samples.push([frameId, stack.duration]);
          weights.push(stack.duration);
        }
      }

      profiles.push({
        type: 'sampled',
        name: d.benchmarkName,
        unit: 'milliseconds',
        startValue: d.startTime,
        endValue: d.endTime,
        samples,
        weights,
      });
    }

    const speedscopeData: SpeedscopeProfile = {
      $schema: 'https://www.speedscope.app/file-format-schema.json',
      profiles,
      shared: { frames },
    };

    return {
      content: JSON.stringify(speedscopeData, null, 2),
      extension: 'speedscope.json',
    };
  }

  /**
   * Export as pprof format (simplified)
   */
  private async exportPprof(
    data: BenchmarkProfilingData[],
    config: ProfilingExportConfig
  ): Promise<{ content: Buffer; extension: string }> {
    // This is a simplified implementation
    // Real pprof export would use the actual pprof protobuf format
    const pprofData = {
      sampleType: [
        { type: 1, unit: 1 }, // CPU samples in milliseconds
      ],
      sample: data.flatMap(d => 
        d.callStacks.map(stack => ({
          locationId: stack.frames.map(f => f.line), // Simplified
          value: [stack.duration],
        }))
      ),
      mapping: [],
      location: [],
      function: [],
      stringTable: ['', 'milliseconds', 'cpu'],
    };

    return {
      content: Buffer.from(JSON.stringify(pprofData, null, 2)),
      extension: 'pprof.json',
    };
  }

  /**
   * Export as Jaeger format
   */
  private async exportJaeger(
    data: BenchmarkProfilingData[],
    config: ProfilingExportConfig
  ): Promise<{ content: string; extension: string }> {
    const traces: JaegerTrace[] = [];

    for (const d of data) {
      const traceID = this.generateTraceId();
      const spans = [];

      // Main benchmark span
      spans.push({
        traceID,
        spanID: this.generateSpanId(),
        operationName: d.benchmarkName,
        startTime: d.startTime * 1000, // Jaeger uses microseconds
        duration: d.duration * 1000,
        tags: [
          { key: 'benchmark.id', value: d.benchmarkId },
          { key: 'benchmark.iteration', value: d.iteration },
        ],
        logs: [],
        process: {
          serviceName: 'tw-enigma-benchmark',
          tags: [
            { key: 'version', value: '1.0.0' },
          ],
        },
      });

      // Bottleneck spans
      for (const bottleneck of d.bottlenecks) {
        spans.push({
          traceID,
          spanID: this.generateSpanId(),
          parentSpanID: spans[0].spanID,
          operationName: bottleneck.operation,
          startTime: d.startTime * 1000,
          duration: bottleneck.duration * 1000,
          tags: [
            { key: 'bottleneck.impact', value: bottleneck.impact },
            { key: 'bottleneck.severity', value: bottleneck.severity },
          ],
          logs: [
            {
              timestamp: d.startTime * 1000,
              fields: [
                { key: 'description', value: bottleneck.description },
              ],
            },
          ],
          process: {
            serviceName: 'tw-enigma-benchmark',
            tags: [],
          },
        });
      }

      traces.push({
        traceID,
        spans,
      });
    }

    return {
      content: JSON.stringify({ data: traces }, null, 2),
      extension: 'jaeger.json',
    };
  }

  /**
   * Export as OpenTelemetry format
   */
  private async exportOpenTelemetry(
    data: BenchmarkProfilingData[],
    config: ProfilingExportConfig
  ): Promise<{ content: string; extension: string }> {
    const resourceSpans = data.map(d => ({
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'tw-enigma-benchmark' } },
          { key: 'benchmark.name', value: { stringValue: d.benchmarkName } },
        ],
      },
      instrumentationLibrarySpans: [{
        instrumentationLibrary: {
          name: 'tw-enigma-profiler',
          version: '1.0.0',
        },
        spans: [
          {
            traceId: this.generateTraceId(),
            spanId: this.generateSpanId(),
            name: d.benchmarkName,
            kind: 1, // SPAN_KIND_INTERNAL
            startTimeUnixNano: (d.startTime * 1_000_000).toString(),
            endTimeUnixNano: (d.endTime * 1_000_000).toString(),
            attributes: [
              { key: 'benchmark.id', value: { stringValue: d.benchmarkId } },
              { key: 'benchmark.duration', value: { intValue: d.duration } },
            ],
            events: d.bottlenecks.map(b => ({
              timeUnixNano: (d.startTime * 1_000_000).toString(),
              name: 'bottleneck',
              attributes: [
                { key: 'operation', value: { stringValue: b.operation } },
                { key: 'impact', value: { stringValue: b.impact } },
              ],
            })),
          },
        ],
      }],
    }));

    const otlpData: OpenTelemetryTrace = { resourceSpans };

    return {
      content: JSON.stringify(otlpData, null, 2),
      extension: 'otlp.json',
    };
  }

  /**
   * Export as Perfetto format (simplified)
   */
  private async exportPerfetto(
    data: BenchmarkProfilingData[],
    config: ProfilingExportConfig
  ): Promise<{ content: string; extension: string }> {
    // Perfetto uses the same format as Chrome trace
    return this.exportChromeTrace(data, config);
  }

  /**
   * Export as HTML report
   */
  private async exportHTMLReport(
    data: BenchmarkProfilingData[],
    config: ProfilingExportConfig,
    analysis?: BottleneckAnalysisReport
  ): Promise<{ content: string; extension: string }> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TW-Enigma Profiling Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 2rem; }
        .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 1rem; margin-bottom: 2rem; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .metric { background: #f8fafc; padding: 1rem; border-radius: 8px; border: 1px solid #e5e7eb; }
        .metric-value { font-size: 2rem; font-weight: bold; color: #1f2937; }
        .metric-label { color: #6b7280; font-size: 0.875rem; }
        .section { margin-bottom: 2rem; }
        .section h2 { color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.5rem; }
        .bottleneck { background: #fef2f2; border: 1px solid #fecaca; padding: 1rem; margin: 0.5rem 0; border-radius: 6px; }
        .bottleneck.critical { background: #fef2f2; border-color: #f87171; }
        .bottleneck.high { background: #fff7ed; border-color: #fb923c; }
        .bottleneck.medium { background: #fffbeb; border-color: #fbbf24; }
        .bottleneck.low { background: #f0fdf4; border-color: #34d399; }
        .recommendation { background: #eff6ff; border: 1px solid #bfdbfe; padding: 1rem; margin: 0.5rem 0; border-radius: 6px; }
        table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
        th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #e5e7eb; }
        th { background: #f8fafc; font-weight: 600; }
    </style>
</head>
<body>
    <div class="header">
        <h1>TW-Enigma Profiling Report</h1>
        <p>Generated on ${new Date().toISOString()}</p>
    </div>

    <div class="summary">
        <div class="metric">
            <div class="metric-value">${data.length}</div>
            <div class="metric-label">Benchmarks Profiled</div>
        </div>
        <div class="metric">
            <div class="metric-value">${analysis?.summary.totalBottlenecks || 0}</div>
            <div class="metric-label">Total Bottlenecks</div>
        </div>
        <div class="metric">
            <div class="metric-value">${(analysis?.summary.totalTimeWasted || 0).toFixed(2)}ms</div>
            <div class="metric-label">Time Wasted</div>
        </div>
        <div class="metric">
            <div class="metric-value">${(analysis?.summary.estimatedImprovement || 0).toFixed(1)}%</div>
            <div class="metric-label">Est. Improvement</div>
        </div>
    </div>

    <div class="section">
        <h2>Benchmark Overview</h2>
        <table>
            <thead>
                <tr>
                    <th>Benchmark</th>
                    <th>Duration (ms)</th>
                    <th>Bottlenecks</th>
                    <th>Peak Memory (MB)</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(d => {
                  const peakMemory = Math.max(...d.resourceSnapshots.map(s => s.memory.heapUsed)) / (1024 * 1024);
                  const status = d.bottlenecks.length > 3 ? 'Needs Attention' : 'Good';
                  return `
                    <tr>
                        <td>${d.benchmarkName}</td>
                        <td>${d.duration.toFixed(2)}</td>
                        <td>${d.bottlenecks.length}</td>
                        <td>${peakMemory.toFixed(2)}</td>
                        <td>${status}</td>
                    </tr>
                  `;
                }).join('')}
            </tbody>
        </table>
    </div>

    ${analysis ? `
    <div class="section">
        <h2>Critical Bottlenecks</h2>
        ${analysis.bottlenecks.filter(b => b.impact === 'critical').map(b => `
            <div class="bottleneck critical">
                <h3>${b.operation}</h3>
                <p>${b.description}</p>
                <p><strong>Impact:</strong> ${b.impact} | <strong>Duration:</strong> ${b.duration.toFixed(2)}ms</p>
                <p><strong>Recommendations:</strong> ${b.recommendations.join(', ')}</p>
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>Priority Recommendations</h2>
        ${analysis.recommendations.slice(0, 5).map(r => `
            <div class="recommendation">
                <h3>${r.title} (${r.priority})</h3>
                <p>${r.description}</p>
                <p><strong>Action:</strong> ${r.action}</p>
                <p><strong>Estimated Impact:</strong> ${r.estimatedImpact.toFixed(1)}% | <strong>Effort:</strong> ${r.estimatedEffort}</p>
            </div>
        `).join('')}
    </div>
    ` : ''}

    <div class="section">
        <h2>Export Information</h2>
        <p>This report was generated by TW-Enigma Profiling Exporter v1.0.0</p>
        <p>Data points: ${data.length} | Export time: ${new Date().toISOString()}</p>
    </div>
</body>
</html>
    `;

    return {
      content: html,
      extension: 'html',
    };
  }

  /**
   * Export as Markdown report
   */
  private async exportMarkdownReport(
    data: BenchmarkProfilingData[],
    config: ProfilingExportConfig,
    analysis?: BottleneckAnalysisReport
  ): Promise<{ content: string; extension: string }> {
    const markdown = `
# TW-Enigma Profiling Report

Generated on ${new Date().toISOString()}

## Summary

- **Benchmarks Profiled:** ${data.length}
- **Total Bottlenecks:** ${analysis?.summary.totalBottlenecks || 0}
- **Time Wasted:** ${(analysis?.summary.totalTimeWasted || 0).toFixed(2)}ms
- **Estimated Improvement:** ${(analysis?.summary.estimatedImprovement || 0).toFixed(1)}%

## Benchmark Overview

| Benchmark | Duration (ms) | Bottlenecks | Peak Memory (MB) | Status |
|-----------|---------------|-------------|------------------|---------|
${data.map(d => {
  const peakMemory = Math.max(...d.resourceSnapshots.map(s => s.memory.heapUsed)) / (1024 * 1024);
  const status = d.bottlenecks.length > 3 ? 'Needs Attention' : 'Good';
  return `| ${d.benchmarkName} | ${d.duration.toFixed(2)} | ${d.bottlenecks.length} | ${peakMemory.toFixed(2)} | ${status} |`;
}).join('\n')}

${analysis ? `
## Critical Bottlenecks

${analysis.bottlenecks.filter(b => b.impact === 'critical').map(b => `
### ${b.operation}

${b.description}

- **Impact:** ${b.impact}
- **Duration:** ${b.duration.toFixed(2)}ms
- **Recommendations:** ${b.recommendations.join(', ')}
`).join('')}

## Priority Recommendations

${analysis.recommendations.slice(0, 5).map(r => `
### ${r.title} (${r.priority})

${r.description}

- **Action:** ${r.action}
- **Estimated Impact:** ${r.estimatedImpact.toFixed(1)}%
- **Effort:** ${r.estimatedEffort}
`).join('')}
` : ''}

## Export Information

This report was generated by TW-Enigma Profiling Exporter v1.0.0

- Data points: ${data.length}
- Export time: ${new Date().toISOString()}
    `;

    return {
      content: markdown.trim(),
      extension: 'md',
    };
  }

  /**
   * Export as PDF report (simplified - would need proper PDF generation library)
   */
  private async exportPDFReport(
    data: BenchmarkProfilingData[],
    config: ProfilingExportConfig,
    analysis?: BottleneckAnalysisReport
  ): Promise<{ content: Buffer; extension: string }> {
    // This is a placeholder - real implementation would use a PDF library like puppeteer or jsPDF
    const htmlContent = await this.exportHTMLReport(data, config, analysis);
    
    // Convert HTML to PDF using a PDF generation library
    // For now, return the HTML content as buffer
    return {
      content: Buffer.from(htmlContent.content),
      extension: 'html', // Would be 'pdf' with proper PDF generation
    };
  }

  /**
   * Calculate file checksum
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    const { createHash } = await import('crypto');
    const hash = createHash('sha256');
    const data = await fs.readFile(filePath);
    hash.update(data);
    return hash.digest('hex');
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Generate trace ID for distributed tracing formats
   */
  private generateTraceId(): string {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  /**
   * Generate span ID for distributed tracing formats
   */
  private generateSpanId(): string {
    return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  /**
   * Cleanup old export files based on retention policy
   */
  private async cleanupOldFiles(config: ProfilingExportConfig): Promise<void> {
    try {
      const files = await fs.readdir(config.outputDirectory);
      const cutoffTime = Date.now() - (config.retentionDays * 24 * 60 * 60 * 1000);

      for (const file of files) {
        const filePath = path.join(config.outputDirectory, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          logger.info('Cleaned up old export file', { filePath });
        }
      }
    } catch (error) {
      logger.warn('Failed to cleanup old files', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Factory function to create profiling exporter
 */
export function createProfilingExporter(
  config?: Partial<ProfilingExportConfig>
): ProfilingExporter {
  return new ProfilingExporter(config);
}

/**
 * Create exporter optimized for CI environments
 */
export function createCIProfilingExporter(): ProfilingExporter {
  return new ProfilingExporter({
    formats: ['json', 'csv'],
    compression: true,
    includeRawData: false,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    retentionDays: 7,
  });
}

/**
 * Create exporter optimized for development
 */
export function createDevelopmentProfilingExporter(): ProfilingExporter {
  return new ProfilingExporter({
    formats: ['json', 'flamegraph', 'chrome-trace', 'html-report'],
    compression: false,
    includeRawData: true,
    retentionDays: 30,
  });
}