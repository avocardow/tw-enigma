import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { WatchConfiguration } from './config';
import {
  BuildToolIntegration,
  IWatchController,
  WatchControllerStatus,
  WatchModeConfig,
} from './types';
import { WatchManager } from './watchManager';

const logger = createLogger('WatchModeController');

/**
 * Watch mode controller that manages the overall watch system lifecycle
 * and integrates with various build tools and development environments
 */
export class WatchModeController extends EventEmitter implements IWatchController {
  private watchManager?: WatchManager;
  private configuration?: WatchConfiguration;
  private state: WatchControllerStatus['state'] = 'stopped';
  private startTime?: Date;
  private isPaused = false;
  private buildIntegrations: Map<string, BuildToolIntegration> = new Map();
  private eventCounts = {
    total: 0,
    lastEventTime: undefined as Date | undefined,
  };

  constructor() {
    super();
    logger.debug('WatchModeController initialized');
  }

  /**
   * Initialize the watch system
   */
  async initialize(config: WatchModeConfig): Promise<void> {
    logger.info('Initializing watch mode controller', { mode: config.mode });

    try {
      this.state = 'starting';

      // Create configuration
      this.configuration = new WatchConfiguration(config);

      // Validate configuration
      const validation = this.configuration.validate();
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      // Create watch manager
      this.watchManager = new WatchManager(config);

      // Setup event handlers
      this.setupEventHandlers();

      // Setup build tool integrations
      await this.setupBuildIntegrations(config);

      logger.info('Watch mode controller initialized successfully');
      this.emit('initialized', { config });
    } catch (error) {
      this.state = 'error';
      logger.error('Failed to initialize watch mode controller', { error });
      this.emit('error', { error });
      throw error;
    }
  }

  /**
   * Start watch mode
   */
  async start(): Promise<void> {
    if (!this.watchManager) {
      throw new Error('Watch mode controller not initialized');
    }

    if (this.state === 'running') {
      logger.warn('Watch mode is already running');
      return;
    }

    logger.info('Starting watch mode');

    try {
      this.state = 'starting';
      this.startTime = new Date();
      this.isPaused = false;

      // Start watch manager
      await this.watchManager.start();

      // Execute build tool hooks
      await this.executeBuildHooks('beforeBuild');

      this.state = 'running';
      logger.info('Watch mode started successfully');
      this.emit('started', { startTime: this.startTime });
    } catch (error) {
      this.state = 'error';
      logger.error('Failed to start watch mode', { error });
      this.emit('error', { error });
      throw error;
    }
  }

  /**
   * Stop watch mode
   */
  async stop(): Promise<void> {
    if (!this.watchManager) {
      logger.warn('Watch mode controller not initialized');
      return;
    }

    if (this.state === 'stopped') {
      logger.warn('Watch mode is already stopped');
      return;
    }

    logger.info('Stopping watch mode');

    try {
      this.state = 'stopping';

      // Execute build tool hooks
      await this.executeBuildHooks('afterBuild');

      // Stop watch manager
      await this.watchManager.stop();

      this.state = 'stopped';
      this.startTime = undefined;
      this.isPaused = false;

      logger.info('Watch mode stopped successfully');
      this.emit('stopped');
    } catch (error) {
      this.state = 'error';
      logger.error('Failed to stop watch mode', { error });
      this.emit('error', { error });
      throw error;
    }
  }

  /**
   * Pause watch mode
   */
  pause(): void {
    if (this.state !== 'running') {
      logger.warn('Cannot pause - watch mode is not running');
      return;
    }

    this.isPaused = true;
    logger.info('Watch mode paused');
    this.emit('paused');
  }

  /**
   * Resume watch mode
   */
  resume(): void {
    if (this.state !== 'running') {
      logger.warn('Cannot resume - watch mode is not running');
      return;
    }

    if (!this.isPaused) {
      logger.warn('Watch mode is not paused');
      return;
    }

    this.isPaused = false;
    logger.info('Watch mode resumed');
    this.emit('resumed');
  }

  /**
   * Get controller status
   */
  getStatus(): WatchControllerStatus {
    const now = Date.now();
    const uptime = this.startTime ? now - this.startTime.getTime() : 0;
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      state: this.isPaused && this.state === 'running' ? 'paused' : this.state,
      uptime,
      totalEvents: this.eventCounts.total,
      lastEvent: this.eventCounts.lastEventTime,
      activeHandlers: this.watchManager?.getStats().watchedFiles || 0,
      memoryUsage: memoryUsage.heapUsed,
      cpuUsage: cpuUsage.user + cpuUsage.system,
    };
  }

  /**
   * Add build tool integration
   */
  addBuildIntegration(integration: BuildToolIntegration): void {
    this.buildIntegrations.set(integration.name, integration);
    logger.debug('Build integration added', { name: integration.name });
  }

  /**
   * Remove build tool integration
   */
  removeBuildIntegration(name: string): void {
    if (this.buildIntegrations.delete(name)) {
      logger.debug('Build integration removed', { name });
    }
  }

  /**
   * Get build integrations
   */
  getBuildIntegrations(): BuildToolIntegration[] {
    return Array.from(this.buildIntegrations.values());
  }

  /**
   * Setup event handlers for watch manager
   */
  private setupEventHandlers(): void {
    if (!this.watchManager) return;

    // Watch manager events
    this.watchManager.on('started', () => {
      logger.debug('Watch manager started');
    });

    this.watchManager.on('stopped', () => {
      logger.debug('Watch manager stopped');
    });

    this.watchManager.on('error', (data: { error: Error }) => {
      logger.error('Watch manager error', data);
      this.emit('error', data);
    });

    this.watchManager.on('file-event', (data: any) => {
      if (!this.isPaused) {
        this.updateEventCounts(data.event);
        this.emit('file-event', data);
      }
    });

    // File type specific events
    this.watchManager.on('js-file-changed', (data: any) => {
      if (!this.isPaused) {
        logger.debug('JavaScript file changed', { path: data.event.path });
        this.emit('js-file-changed', data);
        this.handleJavaScriptChange(data.event);
      }
    });

    this.watchManager.on('css-file-changed', (data: any) => {
      if (!this.isPaused) {
        logger.debug('CSS file changed', { path: data.event.path });
        this.emit('css-file-changed', data);
        this.handleCSSChange(data.event);
      }
    });

    this.watchManager.on('html-file-changed', (data: any) => {
      if (!this.isPaused) {
        logger.debug('HTML file changed', { path: data.event.path });
        this.emit('html-file-changed', data);
        this.handleHTMLChange(data.event);
      }
    });

    this.watchManager.on('config-file-changed', (data: any) => {
      if (!this.isPaused) {
        logger.info('Configuration file changed', { path: data.event.path });
        this.emit('config-file-changed', data);
        this.handleConfigChange(data.event);
      }
    });
  }

  /**
   * Setup build tool integrations
   */
  private async setupBuildIntegrations(_config: WatchModeConfig): Promise<void> {
    // Auto-detect common build tools
    const detectedIntegrations = await this.detectBuildTools();

    for (const integration of detectedIntegrations) {
      this.addBuildIntegration(integration);
    }

    logger.debug('Build integrations setup complete', {
      count: this.buildIntegrations.size,
    });
  }

  /**
   * Detect build tools in the project
   */
  private async detectBuildTools(): Promise<BuildToolIntegration[]> {
    const integrations: BuildToolIntegration[] = [];

    // Check for package.json and common scripts
    try {
      const { promises: fs } = require('fs');
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));

      const scripts = packageJson.scripts || {};

      // Webpack integration
      if (scripts.build?.includes('webpack') || scripts.dev?.includes('webpack')) {
        integrations.push({
          name: 'webpack',
          commands: {
            build: scripts.build || 'webpack --mode=production',
            dev: scripts.dev || 'webpack serve --mode=development',
          },
          hooks: {},
          watchPatterns: ['src/**/*', 'public/**/*'],
          outputPatterns: ['dist/**/*', 'build/**/*'],
        });
      }

      // Vite integration
      if (scripts.build?.includes('vite') || scripts.dev?.includes('vite')) {
        integrations.push({
          name: 'vite',
          commands: {
            build: scripts.build || 'vite build',
            dev: scripts.dev || 'vite dev',
          },
          hooks: {},
          watchPatterns: ['src/**/*', 'public/**/*'],
          outputPatterns: ['dist/**/*'],
        });
      }

      // Next.js integration
      if (scripts.build?.includes('next') || scripts.dev?.includes('next')) {
        integrations.push({
          name: 'nextjs',
          commands: {
            build: scripts.build || 'next build',
            dev: scripts.dev || 'next dev',
          },
          hooks: {},
          watchPatterns: ['pages/**/*', 'components/**/*', 'styles/**/*'],
          outputPatterns: ['.next/**/*'],
        });
      }
    } catch (error) {
      logger.debug('Could not detect build tools from package.json', { error });
    }

    return integrations;
  }

  /**
   * Execute build tool hooks
   */
  private async executeBuildHooks(hookName: keyof BuildToolIntegration['hooks']): Promise<void> {
    const promises = Array.from(this.buildIntegrations.values()).map(async (integration) => {
      const hook = integration.hooks[hookName];
      if (hook) {
        try {
          await hook();
          logger.debug('Build hook executed', {
            integration: integration.name,
            hook: hookName,
          });
        } catch (error) {
          logger.error('Build hook failed', {
            integration: integration.name,
            hook: hookName,
            error,
          });
        }
      }
    });

    await Promise.all(promises);
  }

  /**
   * Update event counts
   */
  private updateEventCounts(event: any): void {
    this.eventCounts.total++;
    this.eventCounts.lastEventTime = new Date();
  }

  /**
   * Handle JavaScript file changes
   */
  private handleJavaScriptChange(event: any): void {
    // Emit specific events for different JS frameworks
    const path = event.path.toLowerCase();

    if (path.includes('.vue')) {
      this.emit('vue-file-changed', { event });
    } else if (path.includes('.svelte')) {
      this.emit('svelte-file-changed', { event });
    } else if (path.includes('.tsx') || path.includes('.jsx')) {
      this.emit('react-file-changed', { event });
    }
  }

  /**
   * Handle CSS file changes
   */
  private handleCSSChange(event: any): void {
    const path = event.path.toLowerCase();

    if (path.includes('.scss') || path.includes('.sass')) {
      this.emit('sass-file-changed', { event });
    } else if (path.includes('.less')) {
      this.emit('less-file-changed', { event });
    } else if (path.includes('.styl')) {
      this.emit('stylus-file-changed', { event });
    }
  }

  /**
   * Handle HTML file changes
   */
  private handleHTMLChange(event: any): void {
    // Could trigger browser reload if dev server integration is enabled
    this.emit('html-changed', { event });
  }

  /**
   * Handle configuration file changes
   */
  private handleConfigChange(event: any): void {
    // Configuration changes might require restart
    logger.warn('Configuration file changed - consider restarting watch mode', {
      path: event.path,
    });

    this.emit('config-changed', { event });
  }
}
