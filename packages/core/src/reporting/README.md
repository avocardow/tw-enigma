# TW-Enigma Reporting System

A comprehensive reporting and analytics system for TW-Enigma CSS optimization results. This module provides detailed insights into optimization performance, generates various report formats, and enables historical tracking and comparison.

## Features

- **Comprehensive Data Model**: Structured JSON schema for optimization results
- **Multiple Export Formats**: JSON, HTML, CSV, and PDF export capabilities
- **Interactive HTML Reports**: Rich, interactive reports with charts and filtering
- **Historical Tracking**: Store and compare optimization results over time
- **Performance Analytics**: Detailed metrics on processing time, memory usage, and efficiency
- **Quality Metrics**: CSS validation, accessibility, and browser compatibility tracking
- **Export & Sharing**: Multiple export formats with sharing capabilities

## Quick Start

```typescript
import { 
  createReportGenerator, 
  generateHtmlReport,
  createHistoricalTracker 
} from '@tw-enigma/core/reporting';

// Create a report generator
const generator = createReportGenerator('/path/to/project', '1.0.0');

// Add optimization results
generator.addFileResult({
  filePath: 'styles/main.css',
  originalSize: 10000,
  optimizedSize: 8000,
  classCount: 100,
  classesOptimized: 85,
  processingTime: 150
});

// Generate report
const report = await generator.generateReport();

// Export as HTML
await generateHtmlReport(report, './optimization-report.html');

// Track historically
const tracker = await createHistoricalTracker('/path/to/project');
await tracker.storeReport(report);
```

## Core Components

### 1. Report Generator

The `ReportGenerator` class aggregates optimization data and generates comprehensive reports.

```typescript
import { ReportGenerator } from '@tw-enigma/core/reporting';

const generator = new ReportGenerator({
  projectRoot: '/path/to/project',
  version: '1.0.0',
  startTime: Date.now(),
  projectName: 'My Project'
});

// Add file processing results
generator.addFileResult({
  filePath: 'components/Button.css',
  originalSize: 2048,
  optimizedSize: 1536,
  classCount: 25,
  classesOptimized: 20,
  processingTime: 75
});

// Configure optimization settings
generator.setConfiguration({
  options: { enableOptimization: true },
  framework: { name: 'react', version: '18.0.0' }
});

// Generate the report
const report = await generator.generateReport();
```

### 2. HTML Report Generator

Creates interactive, self-contained HTML reports with embedded styling and JavaScript.

```typescript
import { HtmlReportGenerator } from '@tw-enigma/core/reporting';

const htmlGenerator = new HtmlReportGenerator({
  theme: 'auto',
  interactive: true,
  includeFiles: true,
  locale: 'en-US'
});

const htmlContent = await htmlGenerator.generateHtml(report);
await htmlGenerator.generateHtmlFile(report, './report.html');
```

#### HTML Report Features

- **Responsive Design**: Works on desktop and mobile devices
- **Interactive Charts**: Visual analytics with chart.js-inspired simple charts
- **File Filtering**: Search and sort file optimization results
- **Theme Support**: Light, dark, and auto themes
- **Performance Metrics**: Memory usage, processing time visualization
- **Quality Indicators**: CSS validation, accessibility, compatibility status

### 3. Historical Tracker

Stores and compares optimization reports over time for trend analysis.

```typescript
import { HistoricalTracker } from '@tw-enigma/core/reporting';

const tracker = new HistoricalTracker('/path/to/project', {
  maxHistoryEntries: 100,
  historyDir: '.tw-enigma/history'
});

await tracker.initialize();

// Store a new report
const reportId = await tracker.storeReport(report);

// Compare with previous report
const comparison = await tracker.compareLatestWithPrevious();

// Get trend data
const sizeOptimizationTrend = await tracker.getTrendData('sizeSaved', {
  limit: 30 // Last 30 reports
});

// Get performance alerts
const alerts = await tracker.getPerformanceAlerts();
```

### 4. Export Manager

Handles multiple export formats and sharing capabilities.

```typescript
import { ExportManager } from '@tw-enigma/core/reporting';

const exporter = new ExportManager('/path/to/project');

// Export to multiple formats
const exportPaths = await exporter.exportMultiple(report, ['json', 'html', 'csv'], {
  outputDir: './reports',
  includeTimestamp: true
});

// Create a shareable package
const packagePath = await exporter.createShareablePackage(report, {
  formats: ['json', 'html', 'csv'],
  includeReadme: true
});

// Share via various methods
await exporter.shareReport(report, {
  email: {
    to: ['team@example.com'],
    subject: 'Optimization Report'
  },
  cloudStorage: {
    provider: 'aws-s3',
    bucket: 'reports-bucket'
  }
});
```

## Report Schema

The optimization report follows a comprehensive JSON schema:

```typescript
interface OptimizationReport {
  metadata: ReportMetadata;
  summary: OptimizationSummary;
  files: FileOptimizationResult[];
  performance: PerformanceMetrics;
  configuration: ConfigurationDetails;
  quality: QualityMetrics;
  comparison?: ComparisonData;
  reportErrors?: ReportError[];
}
```

### Key Metrics

- **Size Optimization**: Original vs optimized file sizes, percentage savings
- **Class Optimization**: CSS class count and optimization rates
- **Processing Performance**: Time taken, memory usage patterns
- **Quality Indicators**: CSS validation, accessibility preservation, browser compatibility
- **Historical Comparison**: Trends and changes over time

## Export Formats

### 1. JSON Format

Complete structured data for programmatic access:

```json
{
  "metadata": {
    "timestamp": "2024-01-01T12:00:00.000Z",
    "version": "1.0.0",
    "context": {
      "projectName": "My Project",
      "projectRoot": "/path/to/project"
    }
  },
  "summary": {
    "totalFiles": 15,
    "filesOptimized": 14,
    "totalSizeSavedBytes": 50000,
    "totalSizeSavedPercent": 25.5
  }
}
```

### 2. HTML Format

Interactive web report with:
- Visual charts and graphs
- Sortable and filterable file tables
- Responsive design for all devices
- Theme switching capabilities
- Print-optimized styles

### 3. CSV Format

Tabular data for spreadsheet analysis:

```csv
Report Type,Metric,Value,Unit
Summary,Total Files,15,count
Summary,Files Optimized,14,count
Summary,Total Size Saved,50000,bytes
Summary,Size Saved Percentage,25.5,percent
```

### 4. PDF Format

Print-ready document format (requires additional setup for full PDF generation).

## Historical Analysis

### Trend Tracking

Monitor optimization performance over time:

```typescript
// Get size savings trend
const trend = await tracker.getTrendData('sizeSaved', {
  limit: 50,
  since: new Date('2024-01-01')
});

console.log(`Trend: ${trend.trend}`); // 'improving', 'declining', or 'stable'
console.log(`Change: ${trend.percentChange}%`);
```

### Performance Alerts

Get notified of performance regressions:

```typescript
const alerts = await tracker.getPerformanceAlerts();

for (const alert of alerts) {
  console.log(`${alert.type.toUpperCase()}: ${alert.message}`);
  console.log(`${alert.metric}: ${alert.currentValue} (was ${alert.previousValue})`);
}
```

### Comparison Analysis

Compare any two reports:

```typescript
const comparison = await tracker.compareReports(currentId, previousId);

console.log(`Assessment: ${comparison.assessment}`); // 'improved', 'degraded', 'stable'
console.log(`Size saved delta: ${comparison.differences.sizeSaved.absolute} bytes`);
```

## Advanced Usage

### Custom Report Generation

Extend the reporting system with custom data:

```typescript
const generator = createReportGenerator(projectRoot, version);

// Add custom performance data
generator.setPerformanceData({
  cpuTime: 1500,
  diskIO: {
    filesRead: 25,
    filesWritten: 15,
    bytesRead: 1024000,
    bytesWritten: 819200
  }
});

// Add quality metrics
generator.setQualityData({
  cssValidation: {
    errors: 0,
    warnings: 2
  },
  accessibility: {
    preserved: true,
    score: 95
  }
});
```

### Custom HTML Templates

Customize HTML report appearance:

```typescript
const htmlGenerator = new HtmlReportGenerator({
  customCss: `
    .summary-card.highlight {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
  `,
  customJs: `
    document.addEventListener('DOMContentLoaded', function() {
      console.log('Custom report loaded');
    });
  `
});
```

### Batch Processing

Process multiple projects or configurations:

```typescript
async function generateBatchReports(projects: string[]) {
  const results = [];
  
  for (const projectPath of projects) {
    const generator = createReportGenerator(projectPath);
    // ... add results for this project
    const report = await generator.generateReport();
    
    results.push({
      project: projectPath,
      report,
      htmlPath: await generateHtmlReport(report, `${projectPath}/report.html`)
    });
  }
  
  return results;
}
```

## Configuration Options

### Report Generator Options

```typescript
interface ReportGeneratorOptions {
  projectRoot: string;
  version: string;
  startTime: number;
  projectName?: string;
  configPath?: string;
  revision?: string;
}
```

### HTML Generator Options

```typescript
interface HtmlOptions {
  customCss?: string;
  customJs?: string;
  title?: string;
  theme?: 'light' | 'dark' | 'auto';
  interactive?: boolean;
  includeFiles?: boolean;
  locale?: string;
}
```

### Export Options

```typescript
interface ExportOptions {
  outputDir?: string;
  includeTimestamp?: boolean;
  filePrefix?: string;
  compressionLevel?: number;
}
```

## Best Practices

### 1. Report Generation

- Always call `generateReport()` after adding all file results
- Include configuration and quality data for comprehensive analysis
- Use meaningful project names and revision identifiers
- Handle report generation errors gracefully

### 2. Historical Tracking

- Initialize the tracker once per project
- Store reports immediately after generation
- Regularly clean up old reports to manage disk space
- Use comparison data to identify performance regressions

### 3. Export and Sharing

- Choose appropriate formats for your audience
- Include timestamps in filenames for version control
- Use shareable packages for comprehensive distribution
- Implement proper access controls for sensitive data

### 4. Performance

- Limit file result additions to avoid memory issues
- Use historical data cleanup to manage storage
- Consider async processing for large datasets
- Monitor report generation time for performance optimization

## Error Handling

The reporting system includes comprehensive error handling:

```typescript
try {
  const report = await generator.generateReport();
  
  // Check for report errors
  if (report.reportErrors && report.reportErrors.length > 0) {
    for (const error of report.reportErrors) {
      console.warn(`${error.type}: ${error.message}`);
    }
  }
} catch (error) {
  console.error('Report generation failed:', error.message);
  // Fallback to basic report or alternative handling
}
```

## Integration Examples

### With Build Tools

```typescript
// webpack.config.js
const TwEnigmaPlugin = require('@tw-enigma/webpack-plugin');
const { createReportGenerator } = require('@tw-enigma/core/reporting');

module.exports = {
  plugins: [
    new TwEnigmaPlugin({
      onComplete: async (results) => {
        const generator = createReportGenerator(__dirname);
        
        for (const result of results) {
          generator.addFileResult(result);
        }
        
        const report = await generator.generateReport();
        await generateHtmlReport(report, './dist/optimization-report.html');
      }
    })
  ]
};
```

### With CI/CD

```yaml
# .github/workflows/optimization-report.yml
- name: Generate Optimization Report
  run: |
    npm run build
    npm run optimize
    node scripts/generate-report.js
    
- name: Upload Report
  uses: actions/upload-artifact@v3
  with:
    name: optimization-report
    path: optimization-report.html
```

## API Reference

See the individual module documentation for complete API details:

- [Report Generator API](./reportGenerator.ts)
- [HTML Generator API](./htmlGenerator.ts)
- [Historical Tracker API](./historicalTracker.ts)
- [Export Manager API](./exportManager.ts)
- [Schema Documentation](./schema.ts)

## Testing

The reporting system includes comprehensive test coverage:

```bash
# Run all reporting tests
npm test -- --testPathPattern=reporting

# Run specific test suites
npm test reportGenerator.test.ts
npm test htmlGenerator.test.ts
npm test historicalTracker.test.ts
```

## Contributing

When contributing to the reporting system:

1. Follow the established TypeScript patterns
2. Add comprehensive test coverage for new features
3. Update documentation for API changes
4. Ensure backward compatibility with existing reports
5. Test with various report sizes and configurations

## License

This reporting system is part of the TW-Enigma project and follows the same licensing terms.