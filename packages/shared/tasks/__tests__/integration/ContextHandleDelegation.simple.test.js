/**
 * Simple integration tests for Context Handle Delegation Pattern
 * Tests without external dependencies like MongoDB
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ExecutionContext from '../../src/core/ExecutionContext.js';
import { ContextHandle } from '../../src/core/ContextHandle.js';
import { ContextResourceManager } from '../../src/core/ContextResourceManager.js';
import { ContextDataSource } from '../../src/core/ContextDataSource.js';

// Mock data source for testing
class MockDataSource extends ContextDataSource {
  constructor() {
    super();
    this.data = new Map();
  }

  async query(querySpec) {
    const { selector = {} } = querySpec;
    
    // Simple mock query implementation
    if (selector.id) {
      return this.data.get(selector.id) || null;
    }
    
    return Array.from(this.data.values());
  }

  async update(updateSpec) {
    const { selector = {}, updates = {} } = updateSpec;
    
    if (selector.id) {
      const existing = this.data.get(selector.id) || {};
      const updated = { ...existing, ...updates };
      this.data.set(selector.id, updated);
      return updated;
    }
    
    throw new Error('Update requires id selector');
  }

  subscribe(querySpec, callback) {
    // Simple mock subscription
    return {
      unsubscribe: () => {}
    };
  }

  getSchema() {
    return {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        value: { type: 'any' }
      }
    };
  }
}

describe('Context Handle Delegation (Simple)', () => {
  let context;
  let mockDataSource;
  
  beforeEach(() => {
    // Create mock data source
    mockDataSource = new MockDataSource();
    
    // Add some test data
    mockDataSource.data.set('item1', { id: 'item1', name: 'Test Item 1', value: 100 });
    mockDataSource.data.set('item2', { id: 'item2', name: 'Test Item 2', value: 200 });
    
    // Create execution context
    context = new ExecutionContext({
      workspaceDir: '/test/workspace'
    });
  });

  describe('Basic Handle Operations', () => {
    it('should create and store handles in context', () => {
      // Create resource manager
      const resourceManager = new ContextResourceManager(mockDataSource);
      
      // Create handle
      const handle = new ContextHandle(resourceManager);
      
      // Store in context
      context.set('testHandle', handle);
      
      // Retrieve handle
      const retrieved = context.get('testHandle');
      expect(retrieved).toBe(handle);
    });

    it('should query through handle', async () => {
      const resourceManager = new ContextResourceManager(mockDataSource);
      const handle = new ContextHandle(resourceManager);
      
      context.set('data', handle);
      
      // Query all items
      const allItems = await context.get('data').query({});
      expect(allItems).toHaveLength(2);
      
      // Query specific item
      const item1 = await context.get('data').query({ selector: { id: 'item1' } });
      expect(item1).toEqual({ id: 'item1', name: 'Test Item 1', value: 100 });
    });

    it('should update through handle', async () => {
      const resourceManager = new ContextResourceManager(mockDataSource);
      const handle = new ContextHandle(resourceManager);
      
      context.set('data', handle);
      
      // Update item
      const updated = await context.get('data').update({
        selector: { id: 'item1' },
        updates: { value: 150, modified: true }
      });
      
      expect(updated.value).toBe(150);
      expect(updated.modified).toBe(true);
      
      // Verify update persisted
      const retrieved = await context.get('data').query({ selector: { id: 'item1' } });
      expect(retrieved.value).toBe(150);
    });

    it('should support subscriptions', () => {
      const resourceManager = new ContextResourceManager(mockDataSource);
      const handle = new ContextHandle(resourceManager);
      
      context.set('data', handle);
      
      const callback = jest.fn();
      const subscription = context.get('data').subscribe({}, callback);
      
      expect(subscription).toBeDefined();
      expect(subscription.unsubscribe).toBeDefined();
      
      // Clean up
      subscription.unsubscribe();
    });

    it('should get schema information', () => {
      const resourceManager = new ContextResourceManager(mockDataSource);
      const handle = new ContextHandle(resourceManager);
      
      context.set('data', handle);
      
      const schema = context.get('data').getSchema();
      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
    });
  });

  describe('Multiple Handles', () => {
    it('should manage multiple handles independently', async () => {
      // Create two separate data sources
      const dataSource1 = new MockDataSource();
      dataSource1.data.set('a', { id: 'a', type: 'source1' });
      
      const dataSource2 = new MockDataSource();
      dataSource2.data.set('b', { id: 'b', type: 'source2' });
      
      // Create handles
      const handle1 = new ContextHandle(new ContextResourceManager(dataSource1));
      const handle2 = new ContextHandle(new ContextResourceManager(dataSource2));
      
      // Store in context
      context.set('source1', handle1);
      context.set('source2', handle2);
      
      // Query from different sources
      const result1 = await context.get('source1').query({ selector: { id: 'a' } });
      const result2 = await context.get('source2').query({ selector: { id: 'b' } });
      
      expect(result1.type).toBe('source1');
      expect(result2.type).toBe('source2');
    });

    it('should handle nested contexts', () => {
      const resourceManager = new ContextResourceManager(mockDataSource);
      const handle = new ContextHandle(resourceManager);
      
      // Create nested structure
      context.set('database', {
        users: handle,
        settings: new ContextHandle(new ContextResourceManager(new MockDataSource()))
      });
      
      // Access nested handles
      const users = context.get('database').users;
      const settings = context.get('database').settings;
      
      expect(users).toBeInstanceOf(ContextHandle);
      expect(settings).toBeInstanceOf(ContextHandle);
    });
  });

  describe('Error Handling', () => {
    it('should handle query errors gracefully', async () => {
      // Create data source that throws errors
      const errorDataSource = new MockDataSource();
      errorDataSource.query = jest.fn().mockRejectedValue(new Error('Query failed'));
      
      const resourceManager = new ContextResourceManager(errorDataSource);
      const handle = new ContextHandle(resourceManager);
      
      context.set('errorHandle', handle);
      
      await expect(
        context.get('errorHandle').query({})
      ).rejects.toThrow('Query failed');
    });

    it('should handle update errors gracefully', async () => {
      const resourceManager = new ContextResourceManager(mockDataSource);
      const handle = new ContextHandle(resourceManager);
      
      context.set('data', handle);
      
      // Try to update without id selector
      await expect(
        context.get('data').update({ updates: { value: 999 } })
      ).rejects.toThrow('Update requires id selector');
    });

    it('should handle missing handles', () => {
      expect(context.get('nonexistent')).toBeUndefined();
    });
  });
});