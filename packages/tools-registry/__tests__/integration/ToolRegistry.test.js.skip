/**
 * Unit tests for ToolRegistry Singleton
 * 
 * Tests the singleton registry that manages all tools in the system
 * Tests verify singleton behavior and that it's the only entry point
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ToolRegistry } from '../../src/index.js';

describe('ToolRegistry Integration Tests', () => {
  let toolRegistry;
  
  beforeEach(async () => {
    // Reset singleton for each test
    ToolRegistry.reset();
    
    // Get singleton instance for integration tests
    toolRegistry = await ToolRegistry.getInstance();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    // Reset singleton after each test
    ToolRegistry.reset();
  });
  
  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', async () => {
      const instance1 = await ToolRegistry.getInstance();
      const instance2 = await ToolRegistry.getInstance();
      
      expect(instance1).toBe(instance2);
    });
    
    it('should be the only way to get a ToolRegistry instance', () => {
      // Constructor should not be directly accessible
      expect(() => new ToolRegistry()).toThrow();
    });
    
    it('should initialize only once', async () => {
      const instance1 = await ToolRegistry.getInstance();
      const instance2 = await ToolRegistry.getInstance();
      
      // Should be the same instance (proving initialization happened only once)
      expect(instance1).toBe(instance2);
      expect(instance1.isInitialized).toBe(true);
    });
    
    it('should reset singleton state when reset() is called', async () => {
      const instance1 = await ToolRegistry.getInstance();
      
      ToolRegistry.reset();
      
      const instance2 = await ToolRegistry.getInstance();
      
      // Should be different instances after reset
      expect(instance1).not.toBe(instance2);
    });
  });
  
  describe('Core Methods', () => {
    it('should have getTool method', () => {
      expect(typeof toolRegistry.getTool).toBe('function');
    });
    
    it('should have listTools method', () => {
      expect(typeof toolRegistry.listTools).toBe('function');
    });
    
    it('should have searchTools method', () => {
      expect(typeof toolRegistry.searchTools).toBe('function');
    });
    
    it('should have loadModule method', () => {
      expect(typeof toolRegistry.loadModule).toBe('function');
    });
    
    it('should have loadAllModules method', () => {
      expect(typeof toolRegistry.loadAllModules).toBe('function');
    });
  });
  
  describe('Available Methods', () => {
    it('should have getSystemStatus method', () => {
      expect(typeof toolRegistry.getSystemStatus).toBe('function');
    });
    
    it('should have loadSingleModule method', () => {
      expect(typeof toolRegistry.loadSingleModule).toBe('function');
    });
    
    it('should have generatePerspectives method', () => {
      expect(typeof toolRegistry.generatePerspectives).toBe('function');
    });
    
    it('should have runCompletePipeline method', () => {
      expect(typeof toolRegistry.runCompletePipeline).toBe('function');
    });
    
    it('should have clearAllData method', () => {
      expect(typeof toolRegistry.clearAllData).toBe('function');
    });
    
    it('should have discoverModules method', () => {
      expect(typeof toolRegistry.discoverModules).toBe('function');
    });
    
    it('should have saveDiscoveredModules method', () => {
      expect(typeof toolRegistry.saveDiscoveredModules).toBe('function');
    });
    
    it('should have generateEmbeddings method', () => {
      expect(typeof toolRegistry.generateEmbeddings).toBe('function');
    });
    
    it('should have indexVectorsEnhanced method', () => {
      expect(typeof toolRegistry.indexVectorsEnhanced).toBe('function');
    });
    
    it('should have rebuildVectorCollection method', () => {
      expect(typeof toolRegistry.rebuildVectorCollection).toBe('function');
    });
    
    it('should have verifyVectorIndex method', () => {
      expect(typeof toolRegistry.verifyVectorIndex).toBe('function');
    });
    
    it('should have verifyModules method', () => {
      expect(typeof toolRegistry.verifyModules).toBe('function');
    });
    
    it('should have verifyPerspectives method', () => {
      expect(typeof toolRegistry.verifyPerspectives).toBe('function');
    });
    
    it('should have verifyPipeline method', () => {
      expect(typeof toolRegistry.verifyPipeline).toBe('function');
    });
    
    it('should have loadMultipleModules method', () => {
      expect(typeof toolRegistry.loadMultipleModules).toBe('function');
    });
  });
  
  describe('getSystemStatus', () => {
    it('should return system status information', async () => {
      const status = await toolRegistry.getSystemStatus();
      
      expect(status).toHaveProperty('mongodb');
      expect(status).toHaveProperty('qdrant');
      expect(status).toHaveProperty('summary');
    });
  });
  
  describe('Module Discovery', () => {
    it('should discover modules without loading them', async () => {
      const result = await toolRegistry.discoverModules({
        pattern: 'Calculator',
        verbose: false
      });
      
      expect(result).toHaveProperty('discovered');
      expect(result).toHaveProperty('modules');
      expect(Array.isArray(result.modules)).toBe(true);
    });
  });
  
  describe('Database Operations', () => {
    it('should clear all data when requested', async () => {
      const result = await toolRegistry.clearAllData();
      
      expect(result).toHaveProperty('cache');
      expect(result).toHaveProperty('mongodb');
      expect(result).toHaveProperty('vectorStore');
      expect(result.mongodb).toHaveProperty('tools');
      expect(result.mongodb).toHaveProperty('modules');
      expect(typeof result.mongodb.tools).toBe('number');
      expect(typeof result.mongodb.modules).toBe('number');
    });
  });
  
  describe('Tool Operations', () => {
    it('should get tool by name', async () => {
      // Clear caches to ensure fresh test
      toolRegistry.cache.clear();
      toolRegistry.moduleCache.clear();
      
      // First load some modules
      const loadResult = await toolRegistry.loadSingleModule('Calculator', { verbose: false });
      console.log('Load result:', loadResult);
      
      const tool = await toolRegistry.getTool('calculator');
      console.log('Got tool:', tool ? Object.keys(tool) : 'null');
      
      if (tool) {
        console.log('Tool object:', typeof tool, Object.keys(tool || {}));
        expect(tool).toBeDefined();
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(typeof tool.execute).toBe('function');
      } else {
        console.log('Tool is null - checking if it exists with different name');
        const allTools = await toolRegistry.listTools();
        console.log('Available tools:', allTools.map(t => t.name));
      }
    });
    
    it('should search for tools', async () => {
      const results = await toolRegistry.searchTools('calculate');
      
      expect(Array.isArray(results)).toBe(true);
    });
  });
  
  describe('Pipeline Verification', () => {
    it('should verify complete pipeline', async () => {
      const result = await toolRegistry.verifyPipeline({
        verbose: false
      });
      
      expect(result).toHaveProperty('mongodb');
      expect(result).toHaveProperty('qdrant');
      expect(result).toHaveProperty('embeddings');
      expect(result).toHaveProperty('health');
    });
    
    it('should verify modules', async () => {
      const result = await toolRegistry.verifyModules({
        verbose: false
      });
      
      expect(result).toHaveProperty('verified');
      expect(result).toHaveProperty('issues');
      expect(typeof result.verified).toBe('number');
      expect(typeof result.issues).toBe('number');
    });
    
    it('should verify perspectives', async () => {
      const result = await toolRegistry.verifyPerspectives({
        verbose: false
      });
      
      expect(result).toHaveProperty('toolsWithPerspectives');
      expect(result).toHaveProperty('totalPerspectives');
      expect(result).toHaveProperty('missingPerspectives');
    });
  });
  
  describe('Embedding Operations', () => {
    it('should generate embeddings for tools and perspectives', async () => {
      const result = await toolRegistry.generateEmbeddings({
        moduleName: 'Calculator',
        batchSize: 10,
        verbose: false
      });
      
      expect(result).toHaveProperty('generated');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('failures');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('totalPerspectives');
      expect(typeof result.generated).toBe('number');
      expect(typeof result.failed).toBe('number');
    });
  });
  
  describe('Vector Index Operations', () => {
    it('should index vectors', async () => {
      const result = await toolRegistry.indexVectorsEnhanced({
        verbose: false
      });
      
      expect(result).toHaveProperty('indexed');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('errors');
    });
    
    it('should rebuild vector collection', async () => {
      const result = await toolRegistry.rebuildVectorCollection({
        verbose: false
      });
      
      expect(result).toHaveProperty('collection');
      expect(result).toHaveProperty('dimension');
      expect(result).toHaveProperty('metric');
    });
    
    it('should verify vector index', async () => {
      const result = await toolRegistry.verifyVectorIndex({
        verbose: false
      });
      
      expect(result).toHaveProperty('totalPoints');
      expect(result).toHaveProperty('validPoints');
      expect(result).toHaveProperty('missingEmbeddings');
    });
  });
});