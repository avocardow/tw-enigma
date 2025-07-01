/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * TW-Enigma API Server
 * 
 * Provides REST API endpoints for discovery, analysis, and integration
 * with external toolchains and CI/CD pipelines.
 */

import { EventEmitter } from 'events';
import { createHash, timingSafeEqual } from 'crypto';
import { createLogger } from '../../utils/logger';
import type {
  DiscoveryRequest,
  DiscoveryResponse,
  ApiResponse,
  ApiKey,
  RateLimitConfig,
  HealthCheckResponse,
  WebhookPayload,
} from '../core/apiInterfaces';

const logger = createLogger('api-server');

/**
 * API Server configuration
 */
export interface ApiServerConfig {
  /** Server port */
  port: number;
  /** Server host */
  host: string;
  /** Enable HTTPS */
  https: boolean;
  /** SSL certificate configuration */
  ssl?: {
    cert: string;
    key: string;
  };
  /** CORS configuration */
  cors: {
    origins: string[];
    methods: string[];
    headers: string[];
  };
  /** Rate limiting configuration */
  rateLimit: RateLimitConfig;
  /** API keys for authentication */
  apiKeys: ApiKey[];
  /** Webhook secret for signature verification */
  webhookSecret: string;
  /** Request timeout (ms) */
  timeout: number;
  /** Maximum request size (bytes) */
  maxRequestSize: number;
  /** Enable debug mode */
  debug: boolean;
}

/**
 * Request context
 */
interface RequestContext {
  requestId: string;
  timestamp: number;
  apiKey?: ApiKey;
  rateLimit: {
    remaining: number;
    resetAt: number;
  };
  userAgent: string;
  ip: string;
}

/**
 * Rate limit tracker
 */
interface RateLimitTracker {
  requests: number[];
  windowStart: number;
}

/**
 * API Server implementation
 */
export class ApiServer extends EventEmitter {
  private config: ApiServerConfig;
  private server?: import('http').Server | import('https').Server;
  private rateLimitTrackers = new Map<string, RateLimitTracker>();
  private requestQueue = new Map<string, DiscoveryResponse>();
  private isShuttingDown = false;

  constructor(config: Partial<ApiServerConfig> = {}) {
    super();

    this.config = {
      port: 3000,
      host: '0.0.0.0',
      https: false,
      cors: {
        origins: ['*'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        headers: ['Content-Type', 'Authorization', 'X-API-Key'],
      },
      rateLimit: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        concurrentRequests: 10,
        burstSize: 20,
      },
      apiKeys: [],
      webhookSecret: 'default-webhook-secret',
      timeout: 30000,
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      debug: false,
      ...config,
    };

    this.setupCleanupInterval();
  }

  /**
   * Start the API server
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting TW-Enigma API server', {
        port: this.config.port,
        host: this.config.host,
        https: this.config.https,
      });

      // Create HTTP/HTTPS server based on configuration
      if (this.config.https && this.config.ssl) {
        const https = await import('https');
        const fs = await import('fs');
        
        const options = {
          cert: fs.readFileSync(this.config.ssl.cert),
          key: fs.readFileSync(this.config.ssl.key),
        };
        
        this.server = https.createServer(options, this.handleRequest.bind(this));
      } else {
        const http = await import('http');
        this.server = http.createServer(this.handleRequest.bind(this));
      }

      // Set request timeout
      this.server.timeout = this.config.timeout;

      // Start listening
      await new Promise<void>((resolve, reject) => {
        this.server.listen(this.config.port, this.config.host, (error?: Error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.emit('started', {
        port: this.config.port,
        host: this.config.host,
        https: this.config.https,
      });

      logger.info('API server started successfully', {
        port: this.config.port,
        host: this.config.host,
      });
    } catch (error) {
      logger.error('Failed to start API server', { error });
      throw error;
    }
  }

  /**
   * Stop the API server
   */
  async stop(): Promise<void> {
    if (!this.server) return;

    this.isShuttingDown = true;

    try {
      logger.info('Stopping API server');

      await new Promise<void>((resolve, reject) => {
        this.server.close((error?: Error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.emit('stopped');
      logger.info('API server stopped successfully');
    } catch (error) {
      logger.error('Error stopping API server', { error });
      throw error;
    }
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(req: import('http').IncomingMessage, res: import('http').ServerResponse): Promise<void> {
    const requestId = this.generateRequestId();
    const timestamp = Date.now();

    try {
      // Set CORS headers
      this.setCorsHeaders(req, res);

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Parse request
      const context = await this.parseRequest(req, requestId, timestamp);
      
      // Authenticate request
      if (!await this.authenticateRequest(req, context)) {
        this.sendError(res, 401, 'Unauthorized', 'Invalid or missing API key', context);
        return;
      }

      // Check rate limits
      if (!this.checkRateLimit(context)) {
        this.sendError(res, 429, 'Too Many Requests', 'Rate limit exceeded', context);
        return;
      }

      // Route request
      await this.routeRequest(req, res, context);

    } catch (error) {
      logger.error('Request handling error', { requestId, error });
      this.sendError(res, 500, 'Internal Server Error', 'An unexpected error occurred', {
        requestId,
        timestamp,
        rateLimit: { remaining: 0, resetAt: 0 },
      } as RequestContext);
    }
  }

  /**
   * Parse incoming request
   */
  private async parseRequest(req: import('http').IncomingMessage & { headers: Record<string, string | undefined>, connection: { remoteAddress?: string } }, requestId: string, timestamp: number): Promise<RequestContext> {
    return {
      requestId,
      timestamp,
      rateLimit: { remaining: 0, resetAt: 0 },
      userAgent: req.headers['user-agent'] || 'unknown',
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown',
    };
  }

  /**
   * Authenticate API request
   */
  private async authenticateRequest(req: import('http').IncomingMessage & { headers: Record<string, string | undefined> }, context: RequestContext): Promise<boolean> {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      return false;
    }

    // Find matching API key
    const keyHash = this.hashApiKey(apiKey);
    const validKey = this.config.apiKeys.find(key => 
      timingSafeEqual(Buffer.from(key.keyHash), Buffer.from(keyHash))
    );

    if (!validKey) {
      return false;
    }

    // Check expiration
    if (validKey.expiresAt && validKey.expiresAt < Date.now()) {
      return false;
    }

    context.apiKey = validKey;
    return true;
  }

  /**
   * Check rate limits
   */
  private checkRateLimit(context: RequestContext): boolean {
    if (!context.apiKey) return false;

    const keyId = context.apiKey.keyId;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window

    let tracker = this.rateLimitTrackers.get(keyId);
    if (!tracker) {
      tracker = { requests: [], windowStart: now };
      this.rateLimitTrackers.set(keyId, tracker);
    }

    // Clean old requests
    tracker.requests = tracker.requests.filter(time => now - time < windowMs);

    // Check minute limit
    const config = this.config.rateLimit;
    if (tracker.requests.length >= config.requestsPerMinute) {
      context.rateLimit = {
        remaining: 0,
        resetAt: tracker.windowStart + windowMs,
      };
      return false;
    }

    // Add current request
    tracker.requests.push(now);
    
    context.rateLimit = {
      remaining: config.requestsPerMinute - tracker.requests.length,
      resetAt: tracker.windowStart + windowMs,
    };

    return true;
  }

  /**
   * Route request to appropriate handler
   */
  private async routeRequest(req: import('http').IncomingMessage & { url: string, method: string, headers: Record<string, string | undefined> }, res: import('http').ServerResponse, context: RequestContext): Promise<void> {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const method = req.method.toUpperCase();
    const path = url.pathname;

    logger.debug('Routing request', {
      requestId: context.requestId,
      method,
      path,
      userAgent: context.userAgent,
    });

    // Health check endpoint
    if (method === 'GET' && path === '/health') {
      await this.handleHealthCheck(req, res, context);
      return;
    }

    // Discovery endpoints
    if (method === 'POST' && path === '/api/v1/discovery') {
      await this.handleDiscovery(req, res, context);
      return;
    }

    if (method === 'GET' && path.startsWith('/api/v1/discovery/')) {
      await this.handleGetDiscovery(req, res, context);
      return;
    }

    // Analysis endpoints
    if (method === 'POST' && path === '/api/v1/analysis') {
      await this.handleAnalysis(req, res, context);
      return;
    }

    // Status endpoint
    if (method === 'GET' && path === '/api/v1/status') {
      await this.handleStatus(req, res, context);
      return;
    }

    // 404 for unknown endpoints
    this.sendError(res, 404, 'Not Found', `Endpoint ${path} not found`, context);
  }

  /**
   * Handle health check request
   */
  private async handleHealthCheck(_req: import('http').IncomingMessage, res: import('http').ServerResponse, context: RequestContext): Promise<void> {
    const health: HealthCheckResponse = {
      status: 'healthy',
      timestamp: Date.now(),
      version: '1.0.0',
      services: {
        discovery: 'up',
        analysis: 'up',
        validation: 'up',
        database: 'up',
        cache: 'up',
      },
      metrics: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        cpuUsage: 0, // Would be calculated in real implementation
        diskUsage: 0, // Would be calculated in real implementation
        responseTime: Date.now() - context.timestamp,
      },
      dependencies: [
        {
          name: 'file-system',
          status: 'up',
          responseTime: 1,
        },
      ],
    };

    this.sendResponse(res, 200, health, context);
  }

  /**
   * Handle discovery request
   */
  private async handleDiscovery(req: import('http').IncomingMessage, res: import('http').ServerResponse, context: RequestContext): Promise<void> {
    try {
      const body = await this.parseRequestBody(req);
      
      // Validate request (simplified validation)
      if (!body.targets || !Array.isArray(body.targets)) {
        this.sendError(res, 400, 'Bad Request', 'Missing or invalid targets', context);
        return;
      }

      // Create discovery response
      const response: DiscoveryResponse = {
        requestId: context.requestId,
        status: 'processing',
        startedAt: context.timestamp,
        stats: {
          filesProcessed: 0,
          patternsFound: 0,
          opportunitiesIdentified: 0,
          processingTimeMs: 0,
          errorCount: 0,
        },
      };

      // Store in queue for async processing
      this.requestQueue.set(context.requestId, response);

      // Start async processing
      this.processDiscoveryAsync(body as DiscoveryRequest, context);

      // Return immediate response
      this.sendResponse(res, 202, response, context);

    } catch (error) {
      logger.error('Discovery request error', { requestId: context.requestId, error });
      this.sendError(res, 400, 'Bad Request', 'Invalid request body', context);
    }
  }

  /**
   * Handle get discovery status request
   */
  private async handleGetDiscovery(req: import('http').IncomingMessage & { url: string, headers: Record<string, string | undefined> }, res: import('http').ServerResponse, context: RequestContext): Promise<void> {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const requestId = url.pathname.split('/').pop();

    if (!requestId) {
      this.sendError(res, 400, 'Bad Request', 'Missing request ID', context);
      return;
    }

    const discovery = this.requestQueue.get(requestId);
    if (!discovery) {
      this.sendError(res, 404, 'Not Found', 'Discovery request not found', context);
      return;
    }

    this.sendResponse(res, 200, discovery, context);
  }

  /**
   * Handle analysis request
   */
  private async handleAnalysis(req: import('http').IncomingMessage, res: import('http').ServerResponse, context: RequestContext): Promise<void> {
    try {
      const body = await this.parseRequestBody(req);
      
      // Basic validation
      if (!body.type || !body.input) {
        this.sendError(res, 400, 'Bad Request', 'Missing type or input', context);
        return;
      }

      // Create mock analysis response
      const analysisResult = {
        requestId: context.requestId,
        type: body.type,
        status: 'completed',
        startedAt: context.timestamp,
        completedAt: Date.now(),
        results: {
          // This would contain actual analysis results
          summary: `${body.type} analysis completed`,
          findings: [],
          recommendations: [],
        },
      };

      this.sendResponse(res, 200, analysisResult, context);

    } catch (error) {
      logger.error('Analysis request error', { requestId: context.requestId, error });
      this.sendError(res, 400, 'Bad Request', 'Invalid request body', context);
    }
  }

  /**
   * Handle status request
   */
  private async handleStatus(_req: import('http').IncomingMessage, res: import('http').ServerResponse, context: RequestContext): Promise<void> {
    const status = {
      server: 'TW-Enigma API',
      version: '1.0.0',
      timestamp: Date.now(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      activeRequests: this.requestQueue.size,
      rateLimit: context.rateLimit,
    };

    this.sendResponse(res, 200, status, context);
  }

  /**
   * Process discovery request asynchronously
   */
  private async processDiscoveryAsync(request: DiscoveryRequest, context: RequestContext): Promise<void> {
    try {
      const startTime = Date.now();
      const response = this.requestQueue.get(context.requestId);
      
      if (!response) return;

      // Simulate processing
      await this.sleep(1000); // Simulate work

      // Update response
      response.status = 'completed';
      response.completedAt = Date.now();
      response.stats = {
        filesProcessed: request.targets.length,
        patternsFound: Math.floor(Math.random() * 50),
        opportunitiesIdentified: Math.floor(Math.random() * 10),
        processingTimeMs: Date.now() - startTime,
        errorCount: 0,
      };

      // Simulate results
      response.results = {
        entities: request.targets.map((target) => ({
          filePath: target,
          fileType: target.split('.').pop() || 'unknown',
          patterns: Math.floor(Math.random() * 5),
          size: Math.floor(Math.random() * 10000),
          lastModified: Date.now() - Math.floor(Math.random() * 86400000),
        })),
      };

      // Send webhook notification if configured
      if (request.webhookUrl) {
        await this.sendWebhookNotification(request.webhookUrl, {
          event: 'discovery.completed',
          timestamp: Date.now(),
          requestId: context.requestId,
          data: response,
        });
      }

      logger.info('Discovery processing completed', {
        requestId: context.requestId,
        duration: Date.now() - startTime,
      });

    } catch (error) {
      logger.error('Discovery processing error', { requestId: context.requestId, error });
      
      const response = this.requestQueue.get(context.requestId);
      if (response) {
        response.status = 'failed';
        response.error = {
          code: 'PROCESSING_ERROR',
          message: 'Discovery processing failed',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(url: string, payload: WebhookPayload): Promise<void> {
    try {
      const body = JSON.stringify(payload);
      const signature = this.generateWebhookSignature(body);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TW-Enigma-Signature': signature,
          'User-Agent': 'TW-Enigma-API/1.0.0',
        },
        body,
      });

      if (!response.ok) {
        logger.warn('Webhook notification failed', {
          url,
          status: response.status,
          statusText: response.statusText,
        });
      }
    } catch (error) {
      logger.error('Webhook notification error', { url, error });
    }
  }

  /**
   * Utility methods
   */
  private generateRequestId(): string {
    return createHash('sha1')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 16);
  }

  private hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  private generateWebhookSignature(body: string): string {
    const { createHmac } = require('crypto');
    return createHmac('sha256', this.config.webhookSecret)
      .update(body)
      .digest('hex');
  }

  private setCorsHeaders(req: import('http').IncomingMessage & { headers: Record<string, string | undefined> }, res: import('http').ServerResponse): void {
    const origin = req.headers.origin;
    const allowedOrigins = this.config.cors.origins;
    
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    
    res.setHeader('Access-Control-Allow-Methods', this.config.cors.methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', this.config.cors.headers.join(', '));
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  private async parseRequestBody(req: import('http').IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let body = '';
      
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
        
        if (body.length > this.config.maxRequestSize) {
          reject(new Error('Request too large'));
        }
      });
      
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error('Invalid JSON'));
        }
      });
      
      req.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  private sendResponse<T>(res: import('http').ServerResponse, status: number, data: T, context: RequestContext): void {
    const response: ApiResponse<T> = {
      success: status < 400,
      data,
      meta: {
        requestId: context.requestId,
        timestamp: context.timestamp,
        version: '1.0.0',
        rateLimit: context.rateLimit,
      },
    };

    res.writeHead(status, {
      'Content-Type': 'application/json',
      'X-Request-ID': context.requestId,
      'X-RateLimit-Remaining': context.rateLimit.remaining.toString(),
      'X-RateLimit-Reset': context.rateLimit.resetAt.toString(),
    });

    res.end(JSON.stringify(response, null, this.config.debug ? 2 : 0));
  }

  private sendError(res: import('http').ServerResponse, status: number, code: string, message: string, context: RequestContext): void {
    const response: ApiResponse = {
      success: false,
      error: { code, message },
      meta: {
        requestId: context.requestId,
        timestamp: context.timestamp,
        version: '1.0.0',
        rateLimit: context.rateLimit,
      },
    };

    res.writeHead(status, {
      'Content-Type': 'application/json',
      'X-Request-ID': context.requestId,
    });

    res.end(JSON.stringify(response, null, this.config.debug ? 2 : 0));
  }

  private setupCleanupInterval(): void {
    // Clean up old requests every 5 minutes
    setInterval(() => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      
      for (const [requestId, response] of this.requestQueue.entries()) {
        if (response.startedAt < fiveMinutesAgo) {
          this.requestQueue.delete(requestId);
        }
      }
    }, 5 * 60 * 1000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create API server
 */
export function createApiServer(config?: Partial<ApiServerConfig>): ApiServer {
  return new ApiServer(config);
}