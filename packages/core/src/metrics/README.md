# TW-Enigma Metrics System

A comprehensive metrics collection, analysis, and reporting system for the TW-Enigma Tailwind CSS optimization tool.

## Components

### 1. MetricsCollector (`collector.ts`)

The core metrics collection system that provides:

- Event-driven metric collection
- Multiple metric types (counter, gauge, performance, optimization, etc.)
- Configurable buffer management
- Real-time processors and aggregation
- Storage backend abstraction
- Export capabilities (JSON, CSV, Prometheus)

### 2. QualityMetricsCollector (`qualityMetrics.ts`)

Specialized quality assessment system:

- Standard quality metrics (accuracy, precision, recall, F1-score)
- Classification results analysis
- Optimization quality assessment
- Custom quality metrics registration
- Quality trend analysis and alerting

### 3. PerformanceMonitor (`performanceMonitor.ts`)

Performance tracking and monitoring:

- High-resolution timing utilities
- Resource usage monitoring (memory, CPU, GC)
- Operation tracking with sub-operations
- Latency and throughput measurements
- Adaptive sampling and threshold alerting

### 4. MetricsReporter (`reporter.ts`)

Advanced reporting and visualization:

- Multiple output formats (JSON, Human-readable, CSV, Markdown, HTML)
- Configurable verbosity levels
- Time range filtering
- Error tracking and validation
- Rich formatting with color support

## Usage Examples

### Basic Setup

```typescript
import {
  MetricsCollector,
  QualityMetricsCollector,
  PerformanceMonitor,
  MetricsReporter,
} from './metrics';

// Initialize core collector
const metricsCollector = new MetricsCollector({
  enabled: true,
  bufferSize: 1000,
  flushInterval: 30000,
});

// Initialize specialized collectors
const qualityCollector = new QualityMetricsCollector(metricsCollector);
const performanceMonitor = new PerformanceMonitor();

// Initialize reporter
const reporter = new MetricsReporter(metricsCollector);
reporter.setQualityCollector(qualityCollector);
reporter.setPerformanceMonitor(performanceMonitor);
```

### Collecting Metrics

```typescript
// Record optimization metrics
metricsCollector.recordOptimization(1000, 750, {
  compressionRatio: 0.75,
  patternsFound: 15,
  patternsConsolidated: 8,
  duplicatesRemoved: 5,
  sizeSavings: 250,
  optimizationLevel: 'aggressive',
  qualityScore: 0.95,
  stabilityScore: 0.98,
});

// Record performance metrics
const operation = performanceMonitor.startOperation('css-processing');
// ... perform work ...
performanceMonitor.endOperation(operation.id);

// Record quality metrics
qualityCollector.recordClassificationResults({
  truePositives: 85,
  falsePositives: 5,
  falseNegatives: 7,
  trueNegatives: 103,
  metadata: { algorithm: 'pattern-detection' },
});
```

### Performance Monitoring

```typescript
// Start operation tracking
const operationId = performanceMonitor.startOperation('css-optimization', {
  inputSize: 1500,
  complexity: 'high',
});

// Track sub-operations
const subOpId = performanceMonitor.startSubOperation(operationId, 'pattern-analysis');
// ... work ...
performanceMonitor.endSubOperation(subOpId);

// Record custom metrics
performanceMonitor.recordLatency('api-call', 45.7);
performanceMonitor.recordThroughput('file-processing', 12.5);

// End main operation
performanceMonitor.endOperation(operationId);

// Get real-time stats
const stats = performanceMonitor.getStats();
console.log(`Average latency: ${stats.averageLatency}ms`);
console.log(`Throughput: ${stats.throughput} ops/sec`);
```

### Quality Assessment

```typescript
// Configure quality thresholds
qualityCollector.updateConfig({
  thresholds: {
    minAccuracy: 0.95,
    minPrecision: 0.9,
    minRecall: 0.85,
    maxErrorRate: 0.05,
  },
  alerts: {
    enabled: true,
    channels: ['email', 'webhook'],
  },
});

// Record optimization quality
qualityCollector.recordOptimizationQuality({
  originalSize: 2000,
  optimizedSize: 1200,
  processingTime: 150,
  reductionRatio: 0.4,
  semanticAccuracy: 0.98,
  validationPassed: true,
  errorCount: 0,
  warningCount: 2,
});

// Get quality statistics
const qualityStats = qualityCollector.getQualityStats();
console.log(
  `Overall quality: ${qualityStats.overallQuality.grade} (${qualityStats.overallQuality.score})`
);
```

### Report Generation

```typescript
// Generate JSON report
const jsonReport = await reporter.generateJsonReport({
  verbosity: 'detailed',
  timeRange: {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    end: new Date(),
  },
});

console.log(`Report size: ${jsonReport.size} bytes`);
console.log(`Generation time: ${jsonReport.generationTime}ms`);

// Generate human-readable report
const humanReport = await reporter.generateHumanReport({
  verbosity: 'standard',
  colorOutput: true,
  humanReadable: {
    maxTableWidth: 120,
    showHeaders: true,
  },
});

console.log(humanReport.content);

// Generate HTML report for dashboard
const htmlReport = await reporter.generateHtmlReport({
  verbosity: 'verbose',
  includeMetadata: true,
  includeTags: true,
});

// Save to file
await fs.writeFile('metrics-report.html', htmlReport.content);
```

### Advanced Configuration

```typescript
// Advanced metrics collector configuration
const advancedCollector = new MetricsCollector({
  enabled: true,

  // Buffer management
  bufferSize: 5000,
  flushInterval: 15000,
  maxBufferAge: 60000,

  // Aggregation
  aggregationStrategy: 'weighted_average',
  aggregationWindow: 300000, // 5 minutes

  // Storage
  storage: {
    type: 'redis',
    connectionString: 'redis://localhost:6379',
    retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
  },

  // Export
  export: {
    formats: ['prometheus', 'json'],
    endpoints: ['http://metrics-server:9090/metrics'],
    interval: 60000,
  },

  // Real-time processing
  processors: [
    {
      name: 'anomaly-detector',
      enabled: true,
      config: { threshold: 2.5 },
    },
    {
      name: 'trend-analyzer',
      enabled: true,
      config: { window: 3600000 },
    },
  ],
});
```

### Event Handling

```typescript
// Listen for metric events
metricsCollector.on('metricRecorded', (metric) => {
  console.log(`New metric: ${metric.type} from ${metric.source}`);
});

metricsCollector.on('bufferFull', (size) => {
  console.warn(`Buffer full with ${size} metrics, flushing...`);
});

metricsCollector.on('anomalyDetected', (metric, anomaly) => {
  console.error(`Anomaly detected in ${metric.type}: ${anomaly.description}`);
});

// Quality alerts
qualityCollector.on('qualityAlert', (alert) => {
  console.warn(
    `Quality alert: ${alert.metric} below threshold (${alert.value} < ${alert.threshold})`
  );
});

// Performance alerts
performanceMonitor.on('performanceAlert', (alert) => {
  console.warn(
    `Performance alert: ${alert.metric} = ${alert.value} (threshold: ${alert.threshold})`
  );
});

// Report generation
reporter.on('reportGenerated', (report) => {
  console.log(
    `Report generated: ${report.format}, ${report.size} bytes in ${report.generationTime}ms`
  );
});
```

### Data Export and Integration

```typescript
// Export to different formats
const csvData = await metricsCollector.export('csv', {
  timeRange: { start: yesterday, end: now },
  includeHeaders: true,
});

const prometheusData = await metricsCollector.export('prometheus', {
  metricPrefix: 'tw_enigma_',
  includeTimestamps: true,
});

// Query metrics data
const metrics = await metricsCollector.query({
  types: [MetricType.OPTIMIZATION, MetricType.PERFORMANCE],
  sources: ['css-processor', 'pattern-analyzer'],
  timeRange: { start: lastWeek, end: now },
  tags: { environment: 'production' },
});

// Get aggregated summary
const summary = await metricsCollector.getSummary({
  groupBy: ['source', 'type'],
  aggregation: 'average',
  timeRange: { start: lastMonth, end: now },
});
```

## Integration with TW-Enigma

The metrics system integrates seamlessly with TW-Enigma's optimization pipeline:

### 1. CSS Processing Metrics

- File size reduction tracking
- Processing time measurement
- Pattern detection efficiency
- Error and warning counts

### 2. Quality Assurance

- Semantic accuracy validation
- Visual regression detection
- Cross-browser compatibility metrics
- Performance impact assessment

### 3. Performance Optimization

- Memory usage monitoring
- CPU utilization tracking
- I/O operation metrics
- Cache hit/miss ratios

### 4. Real-time Monitoring

- Live dashboard integration
- Alert notifications
- Trend analysis
- Capacity planning

## Best Practices

### 1. Configuration

- Set appropriate buffer sizes based on expected load
- Configure retention policies for long-term storage
- Enable relevant processors for your use case
- Set meaningful thresholds for alerts

### 2. Performance

- Use sampling for high-frequency metrics
- Implement proper error handling
- Monitor memory usage of buffers
- Configure appropriate flush intervals

### 3. Quality Monitoring

- Establish baseline quality metrics
- Set up automated quality gates
- Monitor quality trends over time
- Implement quality regression detection

### 4. Reporting

- Generate regular automated reports
- Use appropriate verbosity levels
- Implement report archival
- Set up dashboard integrations

## Troubleshooting

### Common Issues

1. **High Memory Usage**

   - Reduce buffer sizes
   - Increase flush frequency
   - Enable sampling for high-volume metrics

2. **Missing Metrics**

   - Check if collection is enabled
   - Verify source configuration
   - Check buffer status and flushing

3. **Performance Issues**

   - Optimize aggregation strategies
   - Reduce processor complexity
   - Use async operations where possible

4. **Quality Alerts**
   - Review threshold settings
   - Check input data quality
   - Verify algorithm parameters

### Debug Mode

```typescript
// Enable debug logging
const debugCollector = new MetricsCollector({
  debug: true,
  logLevel: 'verbose',
  loggers: {
    console: true,
    file: 'metrics-debug.log',
  },
});
```

## API Reference

For detailed API documentation, see the TypeScript interfaces and JSDoc comments in each module:

- `MetricsCollector` - Core collection functionality
- `QualityMetricsCollector` - Quality assessment features
- `PerformanceMonitor` - Performance tracking capabilities
- `MetricsReporter` - Report generation and formatting

Each component provides comprehensive configuration options, event handling, and extensibility points for custom requirements.
