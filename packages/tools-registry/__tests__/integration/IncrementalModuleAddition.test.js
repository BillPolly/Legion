/**
 * Integration test for incremental module addition functionality
 * Tests the new addModule and addModuleComplete methods
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ToolRegistry } from '../../src/index.js';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Incremental Module Addition Integration', () => {
  let toolRegistry;
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    toolRegistry = await ToolRegistry.getInstance();
    
    // Clear any existing test data
    await toolRegistry.clearAllData({ includeRegistry: true });
  }, 60000);

  afterAll(async () => {
    if (toolRegistry) {
      await toolRegistry.cleanup();
    }
    ToolRegistry.reset();
  }, 30000);

  describe('addModule functionality', () => {
    it('should add a single module incrementally', async () => {
      const testModulePath = path.join(__dirname, '../fixtures/MockCalculatorModule.js');
      
      // Add the module
      const result = await toolRegistry.addModule(testModulePath);
      
      expect(result.success).toBe(true);
      expect(result.moduleName).toBe('mock-calculator-module');
      expect(result.toolCount).toBeGreaterThan(0);
      expect(result.moduleId).toBeDefined();
      expect(result.alreadyExists).toBe(false);

      // Verify module is in database
      const stats = await toolRegistry.getStatistics();
      expect(stats.modules.totalDiscovered).toBe(1);
      expect(stats.modules.totalLoaded).toBe(1);
      expect(stats.tools.total).toBe(result.toolCount);

      // Verify tools are accessible
      const allTools = await toolRegistry.listTools();
      expect(allTools.length).toBe(result.toolCount);
      expect(allTools.every(tool => tool.moduleName === 'mock-calculator-module')).toBe(true);
    }, 30000);

    it('should handle adding same module again', async () => {
      const testModulePath = path.join(__dirname, '../fixtures/MockCalculatorModule.js');
      
      // Add the same module again
      const result = await toolRegistry.addModule(testModulePath);
      
      expect(result.success).toBe(true);
      expect(result.moduleName).toBe('mock-calculator-module');
      expect(result.alreadyExists).toBe(true);

      // Verify stats haven't increased
      const stats = await toolRegistry.getStatistics();
      expect(stats.modules.totalDiscovered).toBe(1);
      expect(stats.modules.totalLoaded).toBe(1);
    }, 30000);

    it('should handle invalid module path', async () => {
      const invalidPath = './nonexistent/module.js';
      
      const result = await toolRegistry.addModule(invalidPath);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not found');
    }, 15000);
  });

  describe('addModuleComplete functionality', () => {
    it('should add module with complete pipeline', async () => {
      // Clear existing data for clean test
      await toolRegistry.clearAllData({ includeRegistry: true });
      
      const testModulePath = path.join(__dirname, '../fixtures/MockCalculatorModule.js');
      
      // Add module with complete pipeline
      const result = await toolRegistry.addModuleComplete(testModulePath, {
        generatePerspectives: true,
        generateEmbeddings: true,
        indexVectors: true,
        verbose: true
      });
      
      expect(result.success).toBe(true);
      expect(result.module.success).toBe(true);
      expect(result.module.moduleName).toBe('mock-calculator-module');
      expect(result.module.toolCount).toBeGreaterThan(0);
      
      // Check pipeline steps
      const stepNames = result.steps.map(s => s.name);
      expect(stepNames).toContain('add-module');
      expect(stepNames).toContain('generate-perspectives');
      expect(stepNames).toContain('generate-embeddings');
      expect(stepNames).toContain('index-vectors');
      
      // Verify all steps succeeded
      const failedSteps = result.steps.filter(s => !s.success);
      if (failedSteps.length > 0) {
        console.log('Failed steps:', failedSteps);
        console.log('All errors:', result.errors);
      }
      expect(failedSteps.length).toBe(0);

      // Verify final statistics
      const stats = await toolRegistry.getStatistics();
      expect(stats.modules.totalDiscovered).toBe(1);
      expect(stats.modules.totalLoaded).toBe(1);
      expect(stats.tools.total).toBe(result.module.toolCount);
      
      // Should have perspectives and embeddings
      expect(stats.search.perspectivesGenerated).toBeGreaterThan(0);
      expect(stats.search.perspectivesWithEmbeddings).toBeGreaterThan(0);
      expect(stats.search.vectorsIndexed).toBeGreaterThan(0);
    }, 60000);
  });

  describe('multiple incremental additions', () => {
    it('should add multiple modules incrementally without clearing', async () => {
      // Start fresh
      await toolRegistry.clearAllData({ includeRegistry: true });
      
      const testModules = [
        path.join(__dirname, '../fixtures/MockCalculatorModule.js')
      ];
      
      let totalToolsExpected = 0;
      
      // Add modules one by one
      for (let i = 0; i < testModules.length; i++) {
        const modulePath = testModules[i];
        console.log(`Adding module ${i + 1}/${testModules.length}: ${modulePath}`);
        
        const result = await toolRegistry.addModule(modulePath);
        expect(result.success).toBe(true);
        totalToolsExpected += result.toolCount;
        
        // Verify cumulative stats
        const stats = await toolRegistry.getStatistics();
        expect(stats.modules.totalDiscovered).toBe(i + 1);
        expect(stats.modules.totalLoaded).toBe(i + 1);
        expect(stats.tools.total).toBe(totalToolsExpected);
      }
      
      // Final verification
      const finalStats = await toolRegistry.getStatistics();
      expect(finalStats.modules.totalDiscovered).toBe(testModules.length);
      expect(finalStats.tools.total).toBe(totalToolsExpected);
      
      // All tools should be accessible
      const allTools = await toolRegistry.listTools();
      expect(allTools.length).toBe(totalToolsExpected);
    }, 45000);
  });
});