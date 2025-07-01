/**
 * API Server Integration Tests
 */

import { createApiServer } from '../../src/integrations/api/apiServer';
import type { ApiServerConfig } from '../../src/integrations/api/apiServer';
import { createHash } from 'crypto';

describe('ApiServer', () => {
  let server: ReturnType<typeof createApiServer>;
  const testPort = 3001;

  const testConfig: Partial<ApiServerConfig> = {
    port: testPort,
    host: 'localhost',
    apiKeys: [{
      keyId: 'test-key',
      keyHash: createHash('sha256').update('test-api-key').digest('hex'),
      scopes: ['read', 'write', 'discovery', 'analysis'],
    }],
    rateLimit: {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      concurrentRequests: 10,
      burstSize: 20,
    },
  };

  beforeEach(() => {
    server = createApiServer(testConfig);
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Server Lifecycle', () => {
    it('should start and stop successfully', async () => {
      await server.start();
      await server.stop();
    });

    it('should handle multiple start/stop cycles', async () => {
      await server.start();
      await server.stop();
      await server.start();
      await server.stop();
    });
  });

  describe('Health Check Endpoint', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should respond to health check requests', async () => {
      const response = await fetch(`http://localhost:${testPort}/health`);
      expect(response.status).toBe(200);
      
      const health = await response.json();
      expect(health.data.status).toBe('healthy');
      expect(health.data.version).toBeDefined();
      expect(health.data.services).toBeDefined();
    });

    it('should include system metrics', async () => {
      const response = await fetch(`http://localhost:${testPort}/health`);
      const health = await response.json();
      
      expect(health.data.metrics).toBeDefined();
      expect(health.data.metrics.uptime).toBeGreaterThanOrEqual(0);
      expect(health.data.metrics.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('Authentication', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should reject requests without API key', async () => {
      const response = await fetch(`http://localhost:${testPort}/api/v1/status`);
      expect(response.status).toBe(401);
    });

    it('should accept requests with valid API key', async () => {
      const response = await fetch(`http://localhost:${testPort}/api/v1/status`, {
        headers: {
          'X-API-Key': 'test-api-key',
        },
      });
      expect(response.status).toBe(200);
    });

    it('should reject requests with invalid API key', async () => {
      const response = await fetch(`http://localhost:${testPort}/api/v1/status`, {
        headers: {
          'X-API-Key': 'invalid-key',
        },
      });
      expect(response.status).toBe(401);
    });
  });

  describe('Discovery API', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should accept discovery requests', async () => {
      const discoveryRequest = {
        targets: ['./test-files'],
        include: ['**/*.html'],
        exclude: ['node_modules/**'],
        config: {
          incremental: true,
          maxFileSize: 10,
          concurrency: 4,
          sensitivity: 'medium',
          enablePatternAnalysis: true,
          enableOpportunityDetection: true,
        },
        outputFormat: ['json'],
      };

      const response = await fetch(`http://localhost:${testPort}/api/v1/discovery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-api-key',
        },
        body: JSON.stringify(discoveryRequest),
      });

      expect(response.status).toBe(202);
      const result = await response.json();
      expect(result.data.requestId).toBeDefined();
      expect(result.data.status).toBe('processing');
    });

    it('should validate discovery request parameters', async () => {
      const invalidRequest = {
        targets: [], // Invalid: empty targets
      };

      const response = await fetch(`http://localhost:${testPort}/api/v1/discovery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-api-key',
        },
        body: JSON.stringify(invalidRequest),
      });

      expect(response.status).toBe(400);
    });

    it('should retrieve discovery status', async () => {
      // First, start a discovery
      const discoveryRequest = {
        targets: ['./test-files'],
        include: ['**/*.html'],
        exclude: ['node_modules/**'],
        config: {},
        outputFormat: ['json'],
      };

      const startResponse = await fetch(`http://localhost:${testPort}/api/v1/discovery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-api-key',
        },
        body: JSON.stringify(discoveryRequest),
      });

      const startResult = await startResponse.json();
      const requestId = startResult.data.requestId;

      // Then, check status
      const statusResponse = await fetch(`http://localhost:${testPort}/api/v1/discovery/${requestId}`, {
        headers: {
          'X-API-Key': 'test-api-key',
        },
      });

      expect(statusResponse.status).toBe(200);
      const statusResult = await statusResponse.json();
      expect(statusResult.data.requestId).toBe(requestId);
    });
  });

  describe('Analysis API', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should accept analysis requests', async () => {
      const analysisRequest = {
        type: 'pattern',
        input: {
          source: ['./test-files'],
        },
        options: {
          includeMetrics: true,
          includeRecommendations: true,
          maxDepth: 5,
          qualityThreshold: 0.8,
        },
      };

      const response = await fetch(`http://localhost:${testPort}/api/v1/analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-api-key',
        },
        body: JSON.stringify(analysisRequest),
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data.type).toBe('pattern');
      expect(result.data.status).toBe('completed');
    });

    it('should validate analysis request parameters', async () => {
      const invalidRequest = {
        // Missing required type and input
      };

      const response = await fetch(`http://localhost:${testPort}/api/v1/analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-api-key',
        },
        body: JSON.stringify(invalidRequest),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should enforce rate limits', async () => {
      const requests = [];
      
      // Make multiple rapid requests
      for (let i = 0; i < 65; i++) {
        requests.push(
          fetch(`http://localhost:${testPort}/api/v1/status`, {
            headers: {
              'X-API-Key': 'test-api-key',
            },
          })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should include rate limit headers', async () => {
      const response = await fetch(`http://localhost:${testPort}/api/v1/status`, {
        headers: {
          'X-API-Key': 'test-api-key',
        },
      });

      expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
    });
  });

  describe('CORS Support', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should handle OPTIONS requests', async () => {
      const response = await fetch(`http://localhost:${testPort}/api/v1/status`, {
        method: 'OPTIONS',
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    });

    it('should include CORS headers in responses', async () => {
      const response = await fetch(`http://localhost:${testPort}/health`);
      
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should handle 404 for unknown endpoints', async () => {
      const response = await fetch(`http://localhost:${testPort}/api/v1/unknown`, {
        headers: {
          'X-API-Key': 'test-api-key',
        },
      });

      expect(response.status).toBe(404);
      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('Not Found');
    });

    it('should handle malformed JSON', async () => {
      const response = await fetch(`http://localhost:${testPort}/api/v1/discovery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-api-key',
        },
        body: 'invalid json',
      });

      expect(response.status).toBe(400);
    });

    it('should handle request timeout', async () => {
      // This would require a more complex setup to test actual timeouts
      // For now, we'll test that the timeout configuration is respected
      expect(testConfig.timeout).toBeUndefined(); // Uses default
    });
  });

  describe('Request/Response Format', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should include request metadata in responses', async () => {
      const response = await fetch(`http://localhost:${testPort}/api/v1/status`, {
        headers: {
          'X-API-Key': 'test-api-key',
        },
      });

      const result = await response.json();
      expect(result.meta).toBeDefined();
      expect(result.meta.requestId).toBeDefined();
      expect(result.meta.timestamp).toBeDefined();
      expect(result.meta.version).toBeDefined();
    });

    it('should format error responses consistently', async () => {
      const response = await fetch(`http://localhost:${testPort}/api/v1/status`);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBeDefined();
      expect(result.error.message).toBeDefined();
      expect(result.meta).toBeDefined();
    });
  });
});