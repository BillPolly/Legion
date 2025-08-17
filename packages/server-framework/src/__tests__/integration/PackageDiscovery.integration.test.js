/**
 * Integration tests for PackageDiscovery with real file system
 * NO MOCKS - uses actual monorepo structure
 */

import { PackageDiscovery } from '../../utils/PackageDiscovery.js';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';

describe('PackageDiscovery Integration Tests', () => {
  let discovery;
  let resourceManager;

  beforeEach(async () => {
    // Use real ResourceManager
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    discovery = new PackageDiscovery(resourceManager);
  });

  describe('Real monorepo package discovery', () => {
    it('should discover actual Legion packages', async () => {
      const monorepoRoot = resourceManager.get('env.MONOREPO_ROOT');
      
      if (!monorepoRoot) {
        console.warn('MONOREPO_ROOT not set, skipping test');
        return;
      }
      
      const packages = await discovery.discoverPackages(monorepoRoot);
      
      // Should find real packages
      expect(packages.size).toBeGreaterThan(0);
      
      // Check for known packages
      expect(packages.has('@legion/actors')).toBe(true);
      expect(packages.has('@legion/resource-manager')).toBe(true);
      
      // Verify package structure
      const actorsPackage = packages.get('@legion/actors');
      expect(actorsPackage).toBeDefined();
      expect(actorsPackage.name).toBe('@legion/actors');
      expect(actorsPackage.path).toContain('actors');
      expect(actorsPackage.cleanName).toBe('actors');
    });

    it('should find nested packages in shared directory', async () => {
      const monorepoRoot = resourceManager.get('env.MONOREPO_ROOT');
      
      if (!monorepoRoot) {
        return;
      }
      
      const packages = await discovery.discoverPackages(monorepoRoot);
      
      // Should find packages under shared/
      const sharedPackages = Array.from(packages.values())
        .filter(pkg => pkg.path.includes('/shared/'));
      
      expect(sharedPackages.length).toBeGreaterThan(0);
    });

    it('should find packages in different categories', async () => {
      const monorepoRoot = resourceManager.get('env.MONOREPO_ROOT');
      
      if (!monorepoRoot) {
        return;
      }
      
      const packages = await discovery.discoverPackages(monorepoRoot);
      
      // Check for packages in different directories
      const categories = new Set();
      for (const pkg of packages.values()) {
        const relativePath = path.relative(monorepoRoot, pkg.path);
        const category = relativePath.split(path.sep)[1]; // packages/[category]/...
        categories.add(category);
      }
      
      // Should have packages in multiple categories
      expect(categories.size).toBeGreaterThan(1);
    });

    it('should correctly identify src directories', async () => {
      const monorepoRoot = resourceManager.get('env.MONOREPO_ROOT');
      
      if (!monorepoRoot) {
        return;
      }
      
      const packages = await discovery.discoverPackages(monorepoRoot);
      
      // Check that packages have correct src paths
      for (const [name, pkg] of packages) {
        // Check if src directory exists
        try {
          await fs.access(pkg.srcPath);
          // If src exists, it should be package/src
          expect(pkg.srcPath).toMatch(/\/src$/);
        } catch {
          // If no src, srcPath should be package root
          expect(pkg.srcPath).toBe(pkg.path);
        }
      }
    });
  });

  describe('Package metadata extraction', () => {
    it('should extract correct package names', async () => {
      const monorepoRoot = resourceManager.get('env.MONOREPO_ROOT');
      
      if (!monorepoRoot) {
        return;
      }
      
      const packages = await discovery.discoverPackages(monorepoRoot);
      
      for (const [name, pkg] of packages) {
        // Name should match package.json
        expect(name).toBe(pkg.name);
        
        // Should be @legion scoped
        expect(name).toMatch(/^@legion\//);
        
        // Clean name should not have scope
        expect(pkg.cleanName).not.toContain('@');
        expect(pkg.cleanName).not.toContain('/');
      }
    });

    it('should handle the server-framework package itself', async () => {
      const monorepoRoot = resourceManager.get('env.MONOREPO_ROOT');
      
      if (!monorepoRoot) {
        return;
      }
      
      const packages = await discovery.discoverPackages(monorepoRoot);
      
      // Should find this package
      expect(packages.has('@legion/server-framework')).toBe(true);
      
      const serverFramework = packages.get('@legion/server-framework');
      expect(serverFramework.cleanName).toBe('server-framework');
    });
  });

  describe('Error handling with real file system', () => {
    it('should handle non-existent directory gracefully', async () => {
      const packages = await discovery.discoverPackages('/non/existent/path');
      
      // Should return empty map, not throw
      expect(packages).toBeInstanceOf(Map);
      expect(packages.size).toBe(0);
    });

    it('should skip invalid package.json files', async () => {
      // Create temp directory with invalid package.json
      const tempDir = path.join(process.cwd(), 'temp-test-packages');
      const pkgDir = path.join(tempDir, 'packages', 'invalid');
      
      await fs.mkdir(pkgDir, { recursive: true });
      await fs.writeFile(
        path.join(pkgDir, 'package.json'),
        'invalid json content'
      );
      
      const packages = await discovery.discoverPackages(tempDir);
      
      // Should skip invalid package
      expect(packages.size).toBe(0);
      
      // Clean up
      await fs.rm(tempDir, { recursive: true, force: true });
    });
  });

  describe('Performance with real monorepo', () => {
    it('should discover packages efficiently', async () => {
      const monorepoRoot = resourceManager.get('env.MONOREPO_ROOT');
      
      if (!monorepoRoot) {
        return;
      }
      
      const startTime = Date.now();
      const packages = await discovery.discoverPackages(monorepoRoot);
      const duration = Date.now() - startTime;
      
      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds max
      
      console.log(`Discovered ${packages.size} packages in ${duration}ms`);
    });
  });
});