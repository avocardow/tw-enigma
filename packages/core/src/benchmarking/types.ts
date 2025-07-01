/**
 * Core types for the TW-Enigma benchmarking system
 */

export interface BenchmarkConfig {
  name: string;
  description: string;
  enabled: boolean;
  timeout: number;
  iterations: number;
  warmupIterations: number;
  skipWarmup: boolean;
  parallel: boolean;
  maxParallelism: number;
  randomSeed?: number;
  tags: string[];
  metadata: Record<string, any>;
}

export interface BenchmarkCase {
  id: string;
  name: string;
  description: string;
  config: BenchmarkConfig;
  setup?: () => Promise<void> | void;
  teardown?: () => Promise<void> | void;
  run: (context: BenchmarkContext) => Promise<BenchmarkResult> | BenchmarkResult;
  validate?: (result: BenchmarkResult) => boolean;
  category: BenchmarkCategory;
  priority: number;
}

export interface BenchmarkContext {
  iteration: number;
  totalIterations: number;
  isWarmup: boolean;
  startTime: number;
  config: BenchmarkConfig;
  input: any;
  cache: Map<string, any>;
  metrics: BenchmarkMetrics;
}

export interface BenchmarkResult {
  name: string;
  duration: number;
  success: boolean;
  error?: Error;
  metrics: BenchmarkMetrics;
  output?: any;
  metadata: Record<string, any>;
}

export interface BenchmarkMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  fileOps: number;
  networkOps: number;
  cacheHits: number;
  cacheMisses: number;
  bytesProcessed: number;
  filesProcessed: number;
  optimizationRatio: number;
  customMetrics: Record<string, number>;
}

export interface BenchmarkSuite {
  name: string;
  description: string;
  version: string;
  benchmarks: BenchmarkCase[];
  config: BenchmarkSuiteConfig;
  setup?: () => Promise<void> | void;
  teardown?: () => Promise<void> | void;
}

export interface BenchmarkSuiteConfig {
  parallel: boolean;
  maxParallelism: number;
  timeout: number;
  retries: number;
  reportFormat: ReportFormat[];
  outputDir: string;
  compareBaseline: boolean;
  baselineFile?: string;
  threshold: BenchmarkThreshold;
  environment: BenchmarkEnvironment;
}

export interface BenchmarkThreshold {
  performanceRegression: number; // percentage
  memoryIncrease: number; // percentage
  errorRate: number; // percentage
  minIterations: number;
  maxVariance: number; // coefficient of variation
}

export interface BenchmarkEnvironment {
  platform: string;
  nodeVersion: string;
  cpuCores: number;
  totalMemory: number;
  architecture: string;
  operatingSystem: string;
  environmentVars: Record<string, string>;
  dependencies: Record<string, string>;
}

export interface BenchmarkReport {
  suite: string;
  timestamp: Date;
  environment: BenchmarkEnvironment;
  summary: BenchmarkSummary;
  results: BenchmarkResult[];
  comparison?: BenchmarkComparison;
  charts: BenchmarkChart[];
  metadata: Record<string, any>;
}

export interface BenchmarkSummary {
  totalBenchmarks: number;
  successfulBenchmarks: number;
  failedBenchmarks: number;
  totalDuration: number;
  averageDuration: number;
  fastestBenchmark: string;
  slowestBenchmark: string;
  memoryUsage: {
    min: number;
    max: number;
    average: number;
  };
  throughput: {
    filesPerSecond: number;
    bytesPerSecond: number;
  };
}

export interface BenchmarkComparison {
  baseline: BenchmarkReport;
  current: BenchmarkReport;
  differences: BenchmarkDifference[];
  regressions: BenchmarkRegression[];
  improvements: BenchmarkImprovement[];
  verdict: ComparisonVerdict;
}

export interface BenchmarkDifference {
  benchmarkName: string;
  metric: string;
  baselineValue: number;
  currentValue: number;
  difference: number;
  percentageChange: number;
  significant: boolean;
  trend: 'improvement' | 'regression' | 'neutral';
}

export interface BenchmarkRegression {
  benchmarkName: string;
  metric: string;
  degradation: number;
  severity: 'minor' | 'major' | 'critical';
  threshold: number;
  recommendation: string;
}

export interface BenchmarkImprovement {
  benchmarkName: string;
  metric: string;
  improvement: number;
  significance: 'minor' | 'moderate' | 'significant';
}

export interface BenchmarkChart {
  type: ChartType;
  title: string;
  data: ChartData;
  options: ChartOptions;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
}

export interface ChartOptions {
  responsive: boolean;
  maintainAspectRatio: boolean;
  scales?: any;
  plugins?: any;
}

export interface SyntheticWorkload {
  id: string;
  name: string;
  description: string;
  type: WorkloadType;
  size: WorkloadSize;
  complexity: WorkloadComplexity;
  parameters: WorkloadParameters;
  generator: WorkloadGenerator;
}

export interface WorkloadParameters {
  fileCount: number;
  totalSize: number;
  averageFileSize: number;
  classesPerFile: number;
  nesting: number;
  duplication: number;
  patterns: string[];
  frameworks: string[];
  preprocessors: string[];
}

export interface WorkloadGenerator {
  generate: (parameters: WorkloadParameters) => Promise<GeneratedWorkload>;
  validate: (workload: GeneratedWorkload) => boolean;
  seed?: number;
}

export interface GeneratedWorkload {
  files: WorkloadFile[];
  metadata: WorkloadMetadata;
  statistics: WorkloadStatistics;
}

export interface WorkloadFile {
  path: string;
  content: string;
  size: number;
  type: string;
  classes: string[];
  dependencies: string[];
}

export interface WorkloadMetadata {
  generated: Date;
  generator: string;
  parameters: WorkloadParameters;
  seed?: number;
  checksum: string;
}

export interface WorkloadStatistics {
  totalFiles: number;
  totalSize: number;
  totalClasses: number;
  uniqueClasses: number;
  duplicateClasses: number;
  averageComplexity: number;
  distributionStats: DistributionStats;
}

export interface DistributionStats {
  fileSizes: NumberDistribution;
  classesPerFile: NumberDistribution;
  complexityScores: NumberDistribution;
}

export interface NumberDistribution {
  min: number;
  max: number;
  mean: number;
  median: number;
  standardDeviation: number;
  percentiles: Record<number, number>;
}

export interface ProfilerData {
  timestamp: number;
  duration: number;
  cpuProfile?: any;
  memoryProfile?: any;
  heapSnapshot?: any;
  perfEvents?: any;
  customData?: Record<string, any>;
}

export interface PerformanceProfiler {
  name: string;
  enabled: boolean;
  start: (context: BenchmarkContext) => Promise<void>;
  stop: (context: BenchmarkContext) => Promise<ProfilerData>;
  analyze: (data: ProfilerData[]) => PerformanceAnalysis;
}

export interface PerformanceAnalysis {
  bottlenecks: PerformanceBottleneck[];
  recommendations: PerformanceRecommendation[];
  hotspots: PerformanceHotspot[];
  trends: PerformanceTrend[];
  summary: PerformanceSummary;
}

export interface PerformanceBottleneck {
  type: BottleneckType;
  location: string;
  impact: number;
  description: string;
  suggestions: string[];
}

export interface PerformanceRecommendation {
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: RecommendationCategory;
  title: string;
  description: string;
  expectedImprovement: number;
  effort: 'low' | 'medium' | 'high';
}

export interface PerformanceHotspot {
  function: string;
  file: string;
  line: number;
  selfTime: number;
  totalTime: number;
  calls: number;
  averageTime: number;
}

export interface PerformanceTrend {
  metric: string;
  direction: 'improving' | 'degrading' | 'stable';
  rate: number;
  confidence: number;
  data: TrendDataPoint[];
}

export interface TrendDataPoint {
  timestamp: number;
  value: number;
  benchmark: string;
}

export interface PerformanceSummary {
  overallScore: number;
  categories: Record<PerformanceCategory, number>;
  criticalIssues: number;
  recommendations: number;
  trendsCount: Record<string, number>;
}

// Enums and type definitions

export type BenchmarkCategory = 
  | 'optimization'
  | 'parsing'
  | 'generation'
  | 'caching'
  | 'io'
  | 'memory'
  | 'cpu'
  | 'integration'
  | 'end-to-end';

export type WorkloadType = 
  | 'synthetic'
  | 'real-world'
  | 'stress'
  | 'edge-case'
  | 'regression';

export type WorkloadSize = 
  | 'tiny'
  | 'small'
  | 'medium'
  | 'large'
  | 'huge';

export type WorkloadComplexity = 
  | 'simple'
  | 'moderate'
  | 'complex'
  | 'extreme';

export type ReportFormat = 
  | 'json'
  | 'html'
  | 'markdown'
  | 'csv'
  | 'junit'
  | 'console';

export type ChartType = 
  | 'line'
  | 'bar'
  | 'scatter'
  | 'histogram'
  | 'heatmap'
  | 'box'
  | 'violin';

export type ComparisonVerdict = 
  | 'pass'
  | 'warning'
  | 'fail'
  | 'error';

export type BottleneckType = 
  | 'cpu'
  | 'memory'
  | 'io'
  | 'network'
  | 'gc'
  | 'synchronization'
  | 'algorithm';

export type RecommendationCategory = 
  | 'performance'
  | 'memory'
  | 'scalability'
  | 'reliability'
  | 'maintainability';

export type PerformanceCategory = 
  | 'cpu'
  | 'memory'
  | 'io'
  | 'network'
  | 'cache'
  | 'algorithm';

// Event interfaces for the benchmarking system

export interface BenchmarkEvents {
  'suite-started': { suite: BenchmarkSuite; timestamp: Date };
  'suite-completed': { suite: BenchmarkSuite; report: BenchmarkReport };
  'suite-failed': { suite: BenchmarkSuite; error: Error };
  
  'benchmark-started': { benchmark: BenchmarkCase; context: BenchmarkContext };
  'benchmark-completed': { benchmark: BenchmarkCase; result: BenchmarkResult };
  'benchmark-failed': { benchmark: BenchmarkCase; error: Error };
  'benchmark-progress': { benchmark: BenchmarkCase; progress: number };
  
  'iteration-started': { benchmark: BenchmarkCase; iteration: number };
  'iteration-completed': { benchmark: BenchmarkCase; iteration: number; result: BenchmarkResult };
  
  'profiler-started': { profiler: PerformanceProfiler; benchmark: BenchmarkCase };
  'profiler-stopped': { profiler: PerformanceProfiler; data: ProfilerData };
  
  'report-generated': { report: BenchmarkReport; format: ReportFormat };
  'comparison-completed': { comparison: BenchmarkComparison };
}

// Configuration interfaces

export interface BenchmarkingSystemConfig {
  enabled: boolean;
  defaultSuiteConfig: BenchmarkSuiteConfig;
  profilers: PerformanceProfiler[];
  reporters: BenchmarkReporter[];
  storage: BenchmarkStorage;
  ci: CIConfig;
  notifications: NotificationConfig;
}

export interface BenchmarkReporter {
  name: string;
  format: ReportFormat;
  enabled: boolean;
  outputPath: string;
  options: Record<string, any>;
  generate: (report: BenchmarkReport) => Promise<void>;
}

export interface BenchmarkStorage {
  type: 'filesystem' | 'database' | 'cloud';
  config: Record<string, any>;
  store: (report: BenchmarkReport) => Promise<string>;
  retrieve: (id: string) => Promise<BenchmarkReport>;
  list: (filters?: Record<string, any>) => Promise<BenchmarkReport[]>;
}

export interface CIConfig {
  enabled: boolean;
  providers: CIProvider[];
  thresholds: BenchmarkThreshold;
  failOnRegression: boolean;
  compareWithBaseline: boolean;
  uploadResults: boolean;
}

export interface CIProvider {
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  detect: () => boolean;
  getBuildInfo: () => CIBuildInfo;
  uploadResults: (report: BenchmarkReport) => Promise<void>;
}

export interface CIBuildInfo {
  buildId: string;
  branch: string;
  commit: string;
  pullRequest?: string;
  author: string;
  timestamp: Date;
  url?: string;
}

export interface NotificationConfig {
  enabled: boolean;
  channels: NotificationChannel[];
  triggers: NotificationTrigger[];
}

export interface NotificationChannel {
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'github';
  enabled: boolean;
  config: Record<string, any>;
  send: (notification: Notification) => Promise<void>;
}

export interface NotificationTrigger {
  event: keyof BenchmarkEvents;
  condition: (data: any) => boolean;
  channels: string[];
  message: (data: any) => NotificationMessage;
}

export interface NotificationMessage {
  title: string;
  body: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  attachments?: NotificationAttachment[];
}

export interface NotificationAttachment {
  name: string;
  content: Buffer | string;
  contentType: string;
}

export interface Notification {
  id: string;
  timestamp: Date;
  message: NotificationMessage;
  channels: string[];
  status: 'pending' | 'sent' | 'failed';
  retries: number;
}