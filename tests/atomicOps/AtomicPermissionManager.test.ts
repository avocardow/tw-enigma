/**
 * @fileoverview Tests for AtomicPermissionManager permission and ownership handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AtomicPermissionManager } from '../../src/atomicOps/AtomicPermissionManager';

describe('AtomicPermissionManager', () => {
  let manager: AtomicPermissionManager;
  let testDir: string;
  let testFile: string;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'test-permissions');
    await fs.mkdir(testDir, { recursive: true });
    
    testFile = path.join(testDir, 'test.txt');
    await fs.writeFile(testFile, 'test content');
    
    manager = new AtomicPermissionManager({
      preservePermissions: true,
      preserveOwnership: false // Ownership requires elevated privileges
    });
  });

  afterEach(async () => {
    await manager.shutdown();
    
    try {
      await fs.rm(testDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Permission Management', () => {
    it('should change file permissions successfully', async () => {
      const newPermissions = 0o755;
      const result = await manager.changePermissions(testFile, newPermissions);
      
      expect(result.success).toBe(true);
      expect(result.rollbackOperation).toBeDefined();
      expect(result.rollbackOperation?.type).toBe('permission_change');
      
      // Verify permissions were changed
      const stats = await fs.stat(testFile);
      expect(stats.mode & 0o777).toBe(newPermissions);
    });

    it('should reject invalid permission modes', async () => {
      const invalidPermissions = 999; // Invalid mode (too large)
      const result = await manager.changePermissions(testFile, invalidPermissions);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid permission mode');
    });

    it('should preserve permissions from source to target', async () => {
      const sourceFile = path.join(testDir, 'source.txt');
      const targetFile = path.join(testDir, 'target.txt');
      
      // Create source with specific permissions
      await fs.writeFile(sourceFile, 'source content');
      await fs.chmod(sourceFile, 0o644);
      
      // Create target with different permissions
      await fs.writeFile(targetFile, 'target content');
      await fs.chmod(targetFile, 0o777);
      
      // Preserve permissions
      const result = await manager.preservePermissions(sourceFile, targetFile);
      
      expect(result.success).toBe(true);
      
      // Verify target has source permissions
      const sourceStats = await fs.stat(sourceFile);
      const targetStats = await fs.stat(targetFile);
      expect(targetStats.mode & 0o777).toBe(sourceStats.mode & 0o777);
    });

    it('should track permission history', async () => {
      await manager.changePermissions(testFile, 0o755);
      await manager.changePermissions(testFile, 0o644);
      
      const history = manager.getPermissionHistory();
      expect(history).toHaveLength(2);
      expect(history[0].newPermissions).toBe(0o755);
      expect(history[1].newPermissions).toBe(0o644);
    });

    it('should provide operation metrics', async () => {
      const initialMetrics = manager.getMetrics();
      expect(initialMetrics.totalOperations).toBe(0);
      
      await manager.changePermissions(testFile, 0o755);
      
      const finalMetrics = manager.getMetrics();
      expect(finalMetrics.totalOperations).toBe(1);
      expect(finalMetrics.successfulOperations).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-existent files gracefully', async () => {
      const nonExistentFile = path.join(testDir, 'does-not-exist.txt');
      const result = await manager.changePermissions(nonExistentFile, 0o644);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
    });

    it('should validate ownership values', async () => {
      const result = await manager.changeOwnership(testFile, -1, 0);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid user ID');
    });
  });
}); 