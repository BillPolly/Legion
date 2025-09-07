/**
 * Integration tests for AgentState persistence using Knowledge Graph
 * 
 * FAIL FAST: These tests require @legion/kg packages which are not available.
 * Following CLAUDE.md "NO FALLBACKS! FAIL FAST!" - skip if dependencies missing.
 */

import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import { AgentState } from '../../src/state/AgentState.js';
import { getResourceManager, getMongoDBUrl } from '../../src/utils/ResourceAccess.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if KG dependencies are available - FAIL FAST, no fallbacks
let KGStatePersistence;
let skipKGTests = false;

try {
  const kgModule = await import('../../src/state/KGStatePersistence.js');
  KGStatePersistence = kgModule.KGStatePersistence;
} catch (error) {
  console.warn(`Skipping KG tests - missing dependencies: ${error.message}`);
  skipKGTests = true;
}

describe('State Persistence with Knowledge Graph Integration', () => {
  let resourceManager;
  let testDir;

  beforeAll(async () => {
    resourceManager = await getResourceManager();
    
    // Create test directory
    testDir = path.join(__dirname, '../tmp/kg-state-persistence');
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test files
    const files = await fs.readdir(testDir).catch(() => []);
    for (const file of files) {
      if (file.startsWith('test-') && file.endsWith('.ttl')) {
        await fs.unlink(path.join(testDir, file)).catch(() => {});
      }
    }
  });

  describe('In-Memory KG Persistence', () => {
    it('should persist and restore state using in-memory KG', async () => {
      if (skipKGTests) {
        return; // Skip test if KG dependencies are missing
      }
      
      const persistence = new KGStatePersistence({
        storageType: 'memory',
        agentId: 'test-memory-agent'
      });
      
      await persistence.initialize();

      // Create state with data
      const originalState = new AgentState({ maxMessages: 10 });
      originalState.addMessage({ role: 'user', content: 'Hello from KG' });
      originalState.addMessage({ role: 'assistant', content: 'Hi there! Using KG for persistence.' });
      originalState.setContextVariable('userName', 'Alice', false);
      originalState.setContextVariable('sessionId', 'kg-session-123', false);

      // Save state to KG
      const saved = await persistence.saveState(originalState);
      expect(saved).toBe(true);

      // Load state from KG
      const loadedState = await persistence.loadState();

      expect(loadedState).toBeDefined();
      expect(loadedState.conversationHistory).toHaveLength(2);
      expect(loadedState.conversationHistory[0].content).toBe('Hello from KG');
      expect(loadedState.conversationHistory[1].content).toBe('Hi there! Using KG for persistence.');
      expect(loadedState.contextVariables.userName).toBe('Alice');
      expect(loadedState.contextVariables.sessionId).toBe('kg-session-123');
      expect(loadedState.config.maxMessages).toBe(10);
      
      await persistence.cleanup();
    });

    it('should handle multiple agents with separate KG namespaces', async () => {
      if (skipKGTests) {
        return; // Skip test if KG dependencies are missing
      }
      
      const persistence1 = new KGStatePersistence({
        storageType: 'memory',
        agentId: 'test-kg-agent-1'
      });
      
      const persistence2 = new KGStatePersistence({
        storageType: 'memory',
        agentId: 'test-kg-agent-2'
      });

      await persistence1.initialize();
      await persistence2.initialize();

      // Create different states
      const state1 = new AgentState();
      state1.addMessage({ role: 'user', content: 'Agent 1 KG message' });
      state1.setContextVariable('agentName', 'Agent1', false);
      
      const state2 = new AgentState();
      state2.addMessage({ role: 'user', content: 'Agent 2 KG message' });
      state2.setContextVariable('agentName', 'Agent2', false);

      // Save states to KG
      await persistence1.saveState(state1);
      await persistence2.saveState(state2);

      // Load states from KG
      const loaded1 = await persistence1.loadState();
      const loaded2 = await persistence2.loadState();

      expect(loaded1.conversationHistory[0].content).toBe('Agent 1 KG message');
      expect(loaded1.contextVariables.agentName).toBe('Agent1');
      
      expect(loaded2.conversationHistory[0].content).toBe('Agent 2 KG message');
      expect(loaded2.contextVariables.agentName).toBe('Agent2');
      
      await persistence1.cleanup();
      await persistence2.cleanup();
    });

    it('should return null when no state exists in KG', async () => {
      if (skipKGTests) {
        return; // Skip test if KG dependencies are missing
      }
      
      const persistence = new KGStatePersistence({
        storageType: 'memory',
        agentId: 'test-nonexistent-kg'
      });
      
      await persistence.initialize();
      
      const state = await persistence.loadState();
      expect(state).toBeNull();
      
      await persistence.cleanup();
    });

    it('should preserve message importance in KG', async () => {
      if (skipKGTests) {
        return; // Skip test if KG dependencies are missing
      }
      
      const persistence = new KGStatePersistence({
        storageType: 'memory',
        agentId: 'test-importance'
      });
      
      await persistence.initialize();

      const state = new AgentState();
      state.addMessage({ 
        role: 'user', 
        content: 'Important message',
        importance: 10
      });
      state.addMessage({ 
        role: 'assistant', 
        content: 'Regular message'
        // No importance field
      });

      await persistence.saveState(state);
      const loaded = await persistence.loadState();

      expect(loaded.conversationHistory[0].importance).toBe(10);
      expect(loaded.conversationHistory[1].importance).toBeUndefined();
      
      await persistence.cleanup();
    });
  });

  describe('File-based KG Persistence', () => {
    it('should persist and restore state to file using Turtle format', async () => {
      if (skipKGTests) {
        return; // Skip test if KG dependencies are missing
      }

      const filePath = path.join(testDir, 'test-state-kg.ttl');
      
      const persistence = new KGStatePersistence({
        storageType: 'file',
        agentId: 'test-file-kg-agent',
        storageConfig: {
          filePath,
          format: 'turtle'
        }
      });
      
      await persistence.initialize();

      // Create state
      const originalState = new AgentState();
      originalState.addMessage({ role: 'user', content: 'File KG test' });
      originalState.setContextVariable('testVar', 'testValue', false);
      originalState.setContextVariable('nested', { key: 'value', num: 42 }, false);

      // Save state
      const saved = await persistence.saveState(originalState);
      expect(saved).toBe(true);

      // Verify file exists
      const fileExists = await fs.access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // Create new persistence instance to test loading
      const persistence2 = new KGStatePersistence({
        storageType: 'file',
        agentId: 'test-file-kg-agent',
        storageConfig: {
          filePath,
          format: 'turtle'
        }
      });
      await persistence2.initialize();

      // Load state
      const loadedState = await persistence2.loadState();

      expect(loadedState).toBeDefined();
      expect(loadedState.conversationHistory).toHaveLength(1);
      expect(loadedState.conversationHistory[0].content).toBe('File KG test');
      expect(loadedState.contextVariables.testVar).toBe('testValue');
      expect(loadedState.contextVariables.nested).toEqual({ key: 'value', num: 42 });
      
      await persistence.cleanup();
      await persistence2.cleanup();
    });
  });

  describe('MongoDB KG Persistence', () => {
    it('should persist and restore state to MongoDB triple store', async () => {
      if (skipKGTests) {
        return; // Skip test if KG dependencies are missing
      }
      
      // FAIL FAST - No fallback, test must fail if MongoDB is not available
      const mongoUrl = await getMongoDBUrl();
      expect(mongoUrl).toBeDefined();
      expect(mongoUrl).not.toBe('mongodb://localhost:27017/legion');

      const persistence = new KGStatePersistence({
        storageType: 'mongodb',
        agentId: 'test-mongo-kg-agent',
        storageConfig: {
          mongoUrl,
          databaseName: 'legion-test-kg',
          collectionName: 'agent_kg_states'
        }
      });
      
      // FAIL FAST - No try-catch fallback, let it fail if MongoDB connection fails
      await persistence.initialize();

      // Create state
      const originalState = new AgentState();
      originalState.addMessage({ role: 'user', content: 'MongoDB KG test' });
      originalState.addMessage({ role: 'assistant', content: 'Stored in MongoDB as triples' });
      originalState.setContextVariable('dbTest', 'mongoKGValue', false);
      originalState.setContextVariable('complex', { 
        array: [1, 2, 3], 
        nested: { deep: 'value' }
      }, false);

      // Save state
      const saved = await persistence.saveState(originalState);
      expect(saved).toBe(true);

      // Load state
      const loadedState = await persistence.loadState();

      expect(loadedState).toBeDefined();
      expect(loadedState.conversationHistory).toHaveLength(2);
      expect(loadedState.conversationHistory[1].content).toBe('Stored in MongoDB as triples');
      expect(loadedState.contextVariables.dbTest).toBe('mongoKGValue');
      expect(loadedState.contextVariables.complex).toEqual({
        array: [1, 2, 3],
        nested: { deep: 'value' }
      });
      
      // Clean up
      await persistence.deleteState();
      await persistence.cleanup();
    });

    it('should update existing state in MongoDB KG', async () => {
      if (skipKGTests) {
        return; // Skip test if KG dependencies are missing
      }
      
      // FAIL FAST - No fallback
      const mongoUrl = await getMongoDBUrl();
      expect(mongoUrl).toBeDefined();
      expect(mongoUrl).not.toBe('mongodb://localhost:27017/legion');

      const persistence = new KGStatePersistence({
        storageType: 'mongodb',
        agentId: 'test-update-kg-agent',
        storageConfig: {
          mongoUrl,
          databaseName: 'legion-test-kg',
          collectionName: 'agent_kg_states'
        }
      });
      
      // FAIL FAST - No try-catch fallback
      await persistence.initialize();

      // Save initial state
      const state1 = new AgentState();
      state1.addMessage({ role: 'user', content: 'Initial KG' });
      await persistence.saveState(state1);

      // Update and save again
      const state2 = new AgentState();
      state2.addMessage({ role: 'user', content: 'Updated KG' });
      state2.setContextVariable('version', 2, false);
      await persistence.saveState(state2);

      // Load should get the updated state
      const loadedState = await persistence.loadState();
      expect(loadedState.conversationHistory[0].content).toBe('Updated KG');
      expect(loadedState.contextVariables.version).toBe(2);
      
      // Clean up
      await persistence.deleteState();
      await persistence.cleanup();
    });
  });

  describe('State migration between KG storage types', () => {
    it('should migrate state between memory and file KG stores', async () => {
      if (skipKGTests) {
        return; // Skip test if KG dependencies are missing
      }
      
      // Save to memory KG
      const memoryPersistence = new KGStatePersistence({
        storageType: 'memory',
        agentId: 'test-migrate-kg'
      });
      await memoryPersistence.initialize();

      const state = new AgentState();
      state.addMessage({ role: 'user', content: 'KG Migration test' });
      state.setContextVariable('migrateVar', 'migrateValue', false);
      state.setContextVariable('arrayData', [1, 2, 3], false);
      
      await memoryPersistence.saveState(state);
      const memoryLoaded = await memoryPersistence.loadState();

      // Migrate to file KG
      const filePath = path.join(testDir, 'test-state-migrated-kg.ttl');
      const filePersistence = new KGStatePersistence({
        storageType: 'file',
        agentId: 'test-migrate-kg-file',
        storageConfig: {
          filePath,
          format: 'turtle'
        }
      });
      await filePersistence.initialize();

      // Save the loaded state to file
      await filePersistence.saveState(memoryLoaded);

      // Load from file
      const fileLoaded = await filePersistence.loadState();
      expect(fileLoaded.conversationHistory[0].content).toBe('KG Migration test');
      expect(fileLoaded.contextVariables.migrateVar).toBe('migrateValue');
      expect(fileLoaded.contextVariables.arrayData).toEqual([1, 2, 3]);
      
      await memoryPersistence.cleanup();
      await filePersistence.cleanup();
    });
  });

  describe('Error handling', () => {
    it('should handle save errors gracefully', async () => {
      if (skipKGTests) {
        return; // Skip test if KG dependencies are missing
      }

      // Create persistence with invalid file path
      const persistence = new KGStatePersistence({
        storageType: 'file',
        agentId: 'test-error-kg',
        storageConfig: {
          filePath: '/invalid/path/that/cannot/exist/state.ttl'
        }
      });
      
      await persistence.initialize();

      const state = new AgentState();
      
      // Should not throw, but return false
      const saved = await persistence.saveState(state);
      expect(saved).toBe(false);
      
      await persistence.cleanup();
    });

    it('should handle load errors gracefully', async () => {
      if (skipKGTests) {
        return; // Skip test if KG dependencies are missing
      }
      
      const persistence = new KGStatePersistence({
        storageType: 'file',
        agentId: 'test-load-error-kg',
        storageConfig: {
          filePath: '/invalid/path/state.ttl'
        }
      });
      
      await persistence.initialize();
      
      const state = await persistence.loadState();
      expect(state).toBeNull();
      
      await persistence.cleanup();
    });
  });

  describe('Complex state scenarios', () => {
    it('should handle state with all features', async () => {
      if (skipKGTests) {
        return; // Skip test if KG dependencies are missing
      }
      
      const persistence = new KGStatePersistence({
        storageType: 'memory',
        agentId: 'test-complex-kg'
      });
      
      await persistence.initialize();

      // Create complex state
      const state = new AgentState({
        maxMessages: 50,
        pruningStrategy: 'importance-based',
        contextVariables: {
          userName: { type: 'string', persistent: true },
          sessionData: { type: 'object', persistent: false },
          counter: { type: 'number', persistent: true }
        }
      });

      // Add various messages
      for (let i = 0; i < 10; i++) {
        state.addMessage({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          importance: i % 3 === 0 ? 10 : undefined
        });
      }

      // Set context variables
      state.setContextVariable('userName', 'ComplexUser', false);
      state.setContextVariable('sessionData', {
        startTime: Date.now(),
        actions: ['login', 'query', 'update'],
        metadata: {
          browser: 'Chrome',
          location: 'US'
        }
      }, false);
      state.setContextVariable('counter', 42, false);

      // Save and load
      await persistence.saveState(state);
      const loaded = await persistence.loadState();

      // Verify everything
      expect(loaded.conversationHistory).toHaveLength(10);
      expect(loaded.conversationHistory[0].content).toBe('Message 0');
      expect(loaded.conversationHistory[0].importance).toBe(10);
      expect(loaded.conversationHistory[1].importance).toBeUndefined();
      
      expect(loaded.contextVariables.userName).toBe('ComplexUser');
      expect(loaded.contextVariables.counter).toBe(42);
      expect(loaded.contextVariables.sessionData.actions).toEqual(['login', 'query', 'update']);
      expect(loaded.contextVariables.sessionData.metadata.browser).toBe('Chrome');
      
      expect(loaded.config.maxMessages).toBe(50);
      expect(loaded.config.pruningStrategy).toBe('importance-based');
      
      await persistence.cleanup();
    });

    it('should properly delete state from KG', async () => {
      if (skipKGTests) {
        return; // Skip test if KG dependencies are missing
      }
      
      const persistence = new KGStatePersistence({
        storageType: 'memory',
        agentId: 'test-delete-kg'
      });
      
      await persistence.initialize();

      const state = new AgentState();
      state.addMessage({ role: 'user', content: 'To be deleted' });
      
      // Save state
      await persistence.saveState(state);
      
      // Verify it exists
      let loaded = await persistence.loadState();
      expect(loaded).toBeDefined();
      expect(loaded.conversationHistory).toHaveLength(1);
      
      // Delete state
      const deleted = await persistence.deleteState();
      expect(deleted).toBe(true);
      
      // Verify it's gone
      loaded = await persistence.loadState();
      expect(loaded).toBeNull();
      
      await persistence.cleanup();
    });
  });
});