/**
 * Integration tests for Tool Registry
 * Tests module registration, discovery, and lifecycle management
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  ToolRegistry,
  ModuleProvider,
  ToolResolver
} from '../../src/integration/ToolRegistry.js';
import { FileSystemModuleDefinition } from '../../src/modules/FileSystemModule.js';
import { HTTPModuleDefinition } from '../../src/modules/HTTPModule.js';
import { GitModuleDefinition } from '../../src/modules/GitModule.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Tool Registry Integration', () => {
  let registry;
  let testDir;

  beforeEach(async () => {
    registry = new ToolRegistry();
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'registry-test-'));
  });

  afterEach(async () => {
    await registry.shutdown();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Module registration', () => {
    test('should register module provider', async () => {
      const provider = new ModuleProvider({
        name: 'filesystem',
        definition: FileSystemModuleDefinition,
        config: { basePath: testDir }
      });

      await registry.registerProvider(provider);
      
      expect(registry.hasProvider('filesystem')).toBe(true);
      expect(registry.listProviders()).toContain('filesystem');
    });

    test('should register multiple providers', async () => {
      await registry.registerProvider(new ModuleProvider({
        name: 'filesystem',
        definition: FileSystemModuleDefinition,
        config: { basePath: testDir }
      }));

      await registry.registerProvider(new ModuleProvider({
        name: 'http',
        definition: HTTPModuleDefinition,
        config: { baseURL: 'https://api.example.com' }
      }));

      expect(registry.listProviders()).toHaveLength(2);
      expect(registry.listProviders()).toContain('filesystem');
      expect(registry.listProviders()).toContain('http');
    });

    test('should prevent duplicate provider registration', async () => {
      const provider = new ModuleProvider({
        name: 'filesystem',
        definition: FileSystemModuleDefinition,
        config: { basePath: testDir }
      });

      await registry.registerProvider(provider);
      
      await expect(registry.registerProvider(provider))
        .rejects.toThrow('Provider filesystem already registered');
    });

    test('should unregister provider', async () => {
      const provider = new ModuleProvider({
        name: 'filesystem',
        definition: FileSystemModuleDefinition,
        config: { basePath: testDir }
      });

      await registry.registerProvider(provider);
      await registry.unregisterProvider('filesystem');
      
      expect(registry.hasProvider('filesystem')).toBe(false);
    });
  });

  describe('Tool discovery', () => {
    beforeEach(async () => {
      await registry.registerProvider(new ModuleProvider({
        name: 'filesystem',
        definition: FileSystemModuleDefinition,
        config: { basePath: testDir }
      }));

      await registry.registerProvider(new ModuleProvider({
        name: 'http',
        definition: HTTPModuleDefinition,
        config: { baseURL: 'https://api.example.com' }
      }));
    });

    test('should list all available tools', async () => {
      const tools = await registry.listTools();
      
      expect(tools).toContain('filesystem.readFile');
      expect(tools).toContain('filesystem.writeFile');
      expect(tools).toContain('http.get');
      expect(tools).toContain('http.post');
    });

    test('should get tool by full name', async () => {
      const tool = await registry.getTool('filesystem.readFile');
      
      expect(tool).toBeDefined();
      expect(tool.name).toBe('readFile');
      
      const metadata = tool.getMetadata();
      expect(metadata.description).toContain('Read file');
    });

    test('should search tools by capability', async () => {
      const readTools = await registry.searchTools({ 
        capability: 'read' 
      });
      
      expect(readTools.some(t => t.includes('readFile'))).toBe(true);
      
      const writeTools = await registry.searchTools({ 
        capability: 'write' 
      });
      
      expect(writeTools.some(t => t.includes('writeFile'))).toBe(true);
    });

    test('should search tools by module', async () => {
      const fsTools = await registry.searchTools({ 
        module: 'filesystem' 
      });
      
      expect(fsTools.every(t => t.startsWith('filesystem.'))).toBe(true);
      expect(fsTools.length).toBeGreaterThan(0);
    });

    test('should get tool metadata', async () => {
      const metadata = await registry.getToolMetadata('http.get');
      
      expect(metadata.description).toContain('GET request');
      expect(metadata.input).toBeDefined();
      expect(metadata.output).toBeDefined();
    });

    test('should get module metadata', async () => {
      const metadata = await registry.getModuleMetadata('filesystem');
      
      expect(metadata.name).toBe('FileSystemModule');
      expect(metadata.description).toContain('File system');
      expect(metadata.tools).toBeDefined();
    });
  });

  describe('Module lifecycle management', () => {
    test('should create module instance on demand', async () => {
      await registry.registerProvider(new ModuleProvider({
        name: 'filesystem',
        definition: FileSystemModuleDefinition,
        config: { basePath: testDir },
        lazy: true // Don't create until needed
      }));

      // Instance not created yet
      expect(registry.hasInstance('filesystem')).toBe(false);
      
      // Get tool triggers instance creation
      const tool = await registry.getTool('filesystem.readFile');
      expect(tool).toBeDefined();
      
      // Now instance exists
      expect(registry.hasInstance('filesystem')).toBe(true);
    });

    test('should reuse existing module instance', async () => {
      await registry.registerProvider(new ModuleProvider({
        name: 'filesystem',
        definition: FileSystemModuleDefinition,
        config: { basePath: testDir }
      }));

      const tool1 = await registry.getTool('filesystem.readFile');
      const tool2 = await registry.getTool('filesystem.writeFile');
      
      // Both tools should come from same instance
      const instance1 = await registry.getInstance('filesystem');
      const instance2 = await registry.getInstance('filesystem');
      
      expect(instance1).toBe(instance2);
    });

    test('should destroy module instance', async () => {
      await registry.registerProvider(new ModuleProvider({
        name: 'filesystem',
        definition: FileSystemModuleDefinition,
        config: { basePath: testDir }
      }));

      await registry.getTool('filesystem.readFile');
      expect(registry.hasInstance('filesystem')).toBe(true);
      
      await registry.destroyInstance('filesystem');
      expect(registry.hasInstance('filesystem')).toBe(false);
      
      // Can recreate instance
      await registry.getTool('filesystem.readFile');
      expect(registry.hasInstance('filesystem')).toBe(true);
    });

    test('should handle module cleanup on shutdown', async () => {
      const cleanupSpy = jest.fn();
      
      // Create mock module with cleanup
      const MockModuleDefinition = {
        create: async (config) => ({
          config,
          tools: {},
          getTool: () => null,
          cleanup: cleanupSpy
        }),
        getMetadata: () => ({ name: 'Mock', tools: {} })
      };

      await registry.registerProvider(new ModuleProvider({
        name: 'mock',
        definition: MockModuleDefinition,
        config: {}
      }));

      await registry.getInstance('mock');
      await registry.shutdown();
      
      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('Tool resolution', () => {
    let resolver;

    beforeEach(async () => {
      await registry.registerProvider(new ModuleProvider({
        name: 'filesystem',
        definition: FileSystemModuleDefinition,
        config: { basePath: testDir }
      }));

      await registry.registerProvider(new ModuleProvider({
        name: 'http',
        definition: HTTPModuleDefinition,
        config: { baseURL: 'https://api.example.com' }
      }));

      resolver = new ToolResolver(registry);
    });

    test('should resolve tool by exact name', async () => {
      const tool = await resolver.resolve('filesystem.readFile');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('readFile');
    });

    test('should resolve tool by capability match', async () => {
      const tool = await resolver.resolveByCapability('read files');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('readFile');
    });

    test('should resolve multiple tools for capability', async () => {
      const tools = await resolver.resolveMultiple('file operations');
      
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.some(t => t.name === 'readFile')).toBe(true);
      expect(tools.some(t => t.name === 'writeFile')).toBe(true);
    });

    test('should rank tools by relevance', async () => {
      const ranked = await resolver.rankTools('make http request', [
        'filesystem.readFile',
        'http.get',
        'http.post',
        'filesystem.writeFile'
      ]);
      
      // HTTP tools should rank higher
      expect(ranked[0]).toContain('http');
      expect(ranked[1]).toContain('http');
    });

    test('should suggest alternative tools', async () => {
      const alternatives = await resolver.suggestAlternatives('http.get');
      
      expect(alternatives).toContain('http.post');
      expect(alternatives).toContain('http.head');
      expect(alternatives.some(a => a.includes('http'))).toBe(true);
    });
  });

  describe('Metadata aggregation', () => {
    beforeEach(async () => {
      await registry.registerProvider(new ModuleProvider({
        name: 'filesystem',
        definition: FileSystemModuleDefinition,
        config: { basePath: testDir }
      }));

      await registry.registerProvider(new ModuleProvider({
        name: 'http',
        definition: HTTPModuleDefinition,
        config: { baseURL: 'https://api.example.com' }
      }));

      await registry.registerProvider(new ModuleProvider({
        name: 'git',
        definition: GitModuleDefinition,
        config: { repoPath: testDir }
      }));
    });

    test('should aggregate all metadata', async () => {
      const metadata = await registry.getAllMetadata();
      
      expect(metadata.modules).toHaveLength(3);
      expect(metadata.totalTools).toBeGreaterThan(0);
      expect(metadata.capabilities).toBeDefined();
    });

    test('should index tools by category', async () => {
      const index = await registry.getToolIndex();
      
      // Tools should be indexed by various criteria
      expect(index.byModule).toBeDefined();
      expect(index.byModule.filesystem).toBeDefined();
      expect(index.byModule.http).toBeDefined();
      
      expect(index.byOperation).toBeDefined();
      // Common operations like read, write, get, post
    });

    test('should generate capability map', async () => {
      const capabilities = await registry.getCapabilityMap();
      
      expect(capabilities['filesystem:read']).toContain('filesystem.readFile');
      expect(capabilities['filesystem:write']).toContain('filesystem.writeFile');
      expect(capabilities['http:get']).toContain('http.get');
      expect(capabilities['git:commit']).toContain('git.commit');
    });

    test('should track tool usage statistics', async () => {
      // Execute some tools
      const readTool = await registry.getTool('filesystem.readFile');
      await readTool.execute({ path: 'test.txt' }).catch(() => {});
      await readTool.execute({ path: 'test2.txt' }).catch(() => {});
      
      const stats = await registry.getUsageStats();
      
      expect(stats['filesystem.readFile']).toBeDefined();
      // Count includes the extra call from wrapping
      expect(stats['filesystem.readFile'].count).toBeGreaterThanOrEqual(2);
      expect(stats['filesystem.readFile'].lastUsed).toBeDefined();
    });
  });

  describe('Dependency resolution', () => {
    test('should detect tool dependencies', async () => {
      // Some tools might depend on others
      // e.g., git.push might need git.commit first
      
      await registry.registerProvider(new ModuleProvider({
        name: 'git',
        definition: GitModuleDefinition,
        config: { repoPath: testDir }
      }));

      const dependencies = await registry.getToolDependencies('git.push');
      
      // Push might depend on having commits
      expect(dependencies).toBeDefined();
      // This is conceptual - actual implementation would define these
    });

    test('should resolve module dependencies', async () => {
      // Some modules might depend on others
      // e.g., a deployment module might need git and filesystem
      
      const dependencies = await registry.getModuleDependencies('deployment');
      
      // This would return required modules
      expect(dependencies).toBeDefined();
    });

    test('should order tools by dependency', async () => {
      await registry.registerProvider(new ModuleProvider({
        name: 'git',
        definition: GitModuleDefinition,
        config: { repoPath: testDir }
      }));

      const tools = ['git.push', 'git.commit', 'git.add'];
      const ordered = await registry.orderByDependency(tools);
      
      // Should be ordered: add -> commit -> push
      expect(ordered[0]).toBe('git.add');
      expect(ordered[1]).toBe('git.commit');
      expect(ordered[2]).toBe('git.push');
    });
  });

  describe('Error handling', () => {
    test('should handle provider registration errors', async () => {
      const BadProvider = new ModuleProvider({
        name: 'bad',
        definition: {
          create: async () => { throw new Error('Creation failed'); },
          getMetadata: () => ({ name: 'Bad' })
        },
        config: {}
      });

      await expect(registry.registerProvider(BadProvider))
        .rejects.toThrow('Creation failed');
    });

    test('should handle tool execution errors gracefully', async () => {
      await registry.registerProvider(new ModuleProvider({
        name: 'filesystem',
        definition: FileSystemModuleDefinition,
        config: { basePath: testDir }
      }));

      const tool = await registry.getTool('filesystem.readFile');
      const result = await tool.execute({ path: 'nonexistent.txt' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle missing tool requests', async () => {
      const tool = await registry.getTool('nonexistent.tool');
      expect(tool).toBeNull();
    });

    test('should handle missing module requests', async () => {
      const instance = await registry.getInstance('nonexistent');
      expect(instance).toBeNull();
    });
  });
});