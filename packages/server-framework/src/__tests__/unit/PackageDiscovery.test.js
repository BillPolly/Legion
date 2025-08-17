/**
 * Unit tests for PackageDiscovery utility
 */

import { jest } from '@jest/globals';
import { PackageDiscovery } from '../../utils/PackageDiscovery.js';
import fs from 'fs/promises';
import path from 'path';

describe('PackageDiscovery', () => {
  let discovery;
  let mockResourceManager;

  beforeEach(() => {
    mockResourceManager = {
      get: jest.fn().mockReturnValue('/test/monorepo')
    };
    discovery = new PackageDiscovery(mockResourceManager);
  });

  describe('constructor', () => {
    it('should initialize with ResourceManager', () => {
      expect(discovery.resourceManager).toBe(mockResourceManager);
    });
  });

  describe('isLegionPackage', () => {
    it('should identify Legion packages by package.json', async () => {
      // Mock fs.access to simulate package.json exists
      jest.spyOn(fs, 'access').mockResolvedValue();
      jest.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify({
        name: '@legion/test-package',
        version: '1.0.0'
      }));

      const result = await discovery.isLegionPackage('/test/path');
      
      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalledWith(
        path.join('/test/path', 'package.json')
      );
    });

    it('should return false for non-Legion packages', async () => {
      jest.spyOn(fs, 'access').mockResolvedValue();
      jest.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify({
        name: 'other-package',
        version: '1.0.0'
      }));

      const result = await discovery.isLegionPackage('/test/path');
      
      expect(result).toBe(false);
    });

    it('should return false if no package.json', async () => {
      jest.spyOn(fs, 'access').mockRejectedValue(new Error('Not found'));

      const result = await discovery.isLegionPackage('/test/path');
      
      expect(result).toBe(false);
    });
  });

  describe('loadPackage', () => {
    beforeEach(() => {
      jest.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify({
        name: '@legion/test-package',
        version: '1.0.0',
        main: 'src/index.js'
      }));
    });

    it('should load package metadata', async () => {
      // Mock src directory exists
      jest.spyOn(fs, 'access').mockResolvedValue();
      
      const pkg = await discovery.loadPackage('/test/package');
      
      expect(pkg.name).toBe('@legion/test-package');
      expect(pkg.path).toBe('/test/package');
      expect(pkg.srcPath).toBe(path.join('/test/package', 'src'));
    });

    it('should handle packages without src directory', async () => {
      jest.spyOn(fs, 'access')
        .mockImplementation((path) => {
          if (path.includes('src')) {
            return Promise.reject(new Error('Not found'));
          }
          return Promise.resolve();
        });

      const pkg = await discovery.loadPackage('/test/package');
      
      expect(pkg.srcPath).toBe('/test/package');
    });

    it('should extract clean package name', async () => {
      jest.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify({
        name: '@legion/frontend-components',
        version: '1.0.0'
      }));

      const pkg = await discovery.loadPackage('/test/package');
      
      expect(pkg.cleanName).toBe('frontend-components');
    });
  });

  describe('discoverPackages', () => {
    it('should discover packages in monorepo', async () => {
      // Mock file system structure
      jest.spyOn(fs, 'access')
        .mockImplementation((path) => {
          // Packages directory exists
          if (path === '/test/monorepo/packages') {
            return Promise.resolve();
          }
          // Simulate package.json exists for certain paths
          if (path.includes('gmail/package.json') ||
              path.includes('actors/package.json') ||
              path.includes('gmail/src') ||
              path.includes('actors/src')) {
            return Promise.resolve();
          }
          return Promise.reject(new Error('Not found'));
        });

      jest.spyOn(fs, 'readdir')
        .mockImplementation((dir) => {
          if (dir === '/test/monorepo/packages') {
            return Promise.resolve(['shared', 'tools', 'gmail']);
          }
          if (dir.includes('shared')) {
            return Promise.resolve(['actors', 'utils']);
          }
          return Promise.resolve([]);
        });

      jest.spyOn(fs, 'stat')
        .mockResolvedValue({ isDirectory: () => true });

      jest.spyOn(fs, 'readFile')
        .mockImplementation((path) => {
          if (path.includes('gmail')) {
            return Promise.resolve(JSON.stringify({
              name: '@legion/gmail',
              version: '1.0.0'
            }));
          }
          if (path.includes('actors')) {
            return Promise.resolve(JSON.stringify({
              name: '@legion/actors',
              version: '1.0.0'
            }));
          }
          return Promise.reject(new Error('Not found'));
        });

      const packages = await discovery.discoverPackages('/test/monorepo');
      
      expect(packages.size).toBeGreaterThan(0);
      expect(packages.has('@legion/gmail')).toBe(true);
      expect(packages.has('@legion/actors')).toBe(true);
    });

    it('should handle empty packages directory', async () => {
      jest.spyOn(fs, 'access')
        .mockImplementation((path) => {
          if (path === '/test/monorepo/packages') {
            return Promise.resolve();
          }
          return Promise.reject(new Error('Not found'));
        });
      jest.spyOn(fs, 'readdir').mockResolvedValue([]);
      jest.spyOn(fs, 'stat').mockResolvedValue({ isDirectory: () => true });

      const packages = await discovery.discoverPackages('/test/monorepo');
      
      expect(packages.size).toBe(0);
    });

    it('should skip non-directory entries', async () => {
      jest.spyOn(fs, 'access')
        .mockImplementation((path) => {
          if (path === '/test/monorepo/packages') {
            return Promise.resolve();
          }
          return Promise.reject(new Error('Not found'));
        });
      
      jest.spyOn(fs, 'readdir')
        .mockImplementation((dir) => {
          if (dir === '/test/monorepo/packages') {
            return Promise.resolve(['README.md', 'package1']);
          }
          return Promise.resolve([]);
        });
      
      jest.spyOn(fs, 'stat')
        .mockImplementation((path) => {
          if (path.includes('README')) {
            return Promise.resolve({ isDirectory: () => false });
          }
          return Promise.resolve({ isDirectory: () => true });
        });

      const packages = await discovery.discoverPackages('/test/monorepo');
      
      // Should only process directories
      expect(fs.stat).toHaveBeenCalled();
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});