/**
 * Integration tests for State Projection functionality
 * Tests ScopedDataStoreAdapter integration with DataStoreAdapter
 */

import { ScopedDataStoreAdapter } from '../../src/adapters/ScopedDataStoreAdapter.js';
import { DataStoreAdapter } from '../../src/adapters/DataStoreAdapter.js';

describe('State Projection Integration', () => {
  let mockDataStore;
  let parentAdapter;
  
  beforeEach(async () => {
    // Create mock DataStore with reactive engine
    const subscriptions = new Map();
    
    mockDataStore = {
      on: jest.fn(),
      off: jest.fn(),
      _reactiveEngine: {
        addSubscription: jest.fn((subscription) => {
          subscriptions.set(subscription.id, subscription);
        }),
        removeSubscription: jest.fn((subscriptionId) => {
          subscriptions.delete(subscriptionId);
        }),
        getAllSubscriptions: jest.fn(() => Array.from(subscriptions.values()))
      }
    };
    
    // Create parent adapter with test data
    parentAdapter = new DataStoreAdapter(mockDataStore);
    await parentAdapter.initializeEntities({
      parentState: { 
        title: 'Parent Title', 
        counter: 0, 
        config: { theme: 'dark', language: 'en' } 
      },
      sharedData: { 
        message: 'Shared Message', 
        timestamp: Date.now() 
      },
      arrayData: [
        { id: 1, name: 'Item 1', status: 'active' },
        { id: 2, name: 'Item 2', status: 'inactive' },
        { id: 3, name: 'Item 3', status: 'pending' }
      ]
    });
  });
  
  afterEach(async () => {
    // Cleanup adapters
    if (parentAdapter) {
      parentAdapter.cleanup();
    }
  });

  describe('Basic State Projection Integration', () => {
    it('should create ScopedDataStoreAdapter and project parent state to child', async () => {
      // Create child component with state projection
      const projectionRules = {
        'title': 'parentState.title',
        'count': 'parentState.counter',
        'theme': 'parentState.config.theme'
      };
      
      const childAdapter = new ScopedDataStoreAdapter(parentAdapter, projectionRules);
      
      // Verify child can access projected parent state
      expect(childAdapter.getProperty('title')).toBe('Parent Title');
      expect(childAdapter.getProperty('count')).toBe(0);
      expect(childAdapter.getProperty('theme')).toBe('dark');
      
      // Verify child cannot access non-projected properties
      expect(childAdapter.getProperty('parentState.title')).toBeUndefined();
      expect(childAdapter.getProperty('parentState.config.language')).toBeUndefined();
    });

    it('should update child state when parent state changes', async () => {
      // Create child component with state projection
      const projectionRules = {
        'displayTitle': 'parentState.title',
        'currentCount': 'parentState.counter'
      };
      
      const childAdapter = new ScopedDataStoreAdapter(parentAdapter, projectionRules);
      
      // Initial values
      expect(childAdapter.getProperty('displayTitle')).toBe('Parent Title');
      expect(childAdapter.getProperty('currentCount')).toBe(0);
      
      // Update parent state
      parentAdapter.setProperty('parentState.title', 'Updated Title');
      parentAdapter.setProperty('parentState.counter', 5);
      
      // Verify child sees updated values through projection
      expect(childAdapter.getProperty('displayTitle')).toBe('Updated Title');
      expect(childAdapter.getProperty('currentCount')).toBe(5);
    });

    it('should support bidirectional state projection', async () => {
      // Create child component with bidirectional state projection
      const projectionRules = {
        'title': 'parentState.title',
        'counter': 'parentState.counter'
      };
      
      const childAdapter = new ScopedDataStoreAdapter(parentAdapter, projectionRules);
      
      // Child updates its projected properties
      childAdapter.setProperty('title', 'Child Updated Title');
      childAdapter.setProperty('counter', 10);
      
      // Verify parent state was updated
      expect(parentAdapter.getProperty('parentState.title')).toBe('Child Updated Title');
      expect(parentAdapter.getProperty('parentState.counter')).toBe(10);
    });

    it('should isolate local child state from parent', async () => {
      // Create child with mixed projected and local state
      const projectionRules = {
        'sharedTitle': 'parentState.title'
      };
      
      const childAdapter = new ScopedDataStoreAdapter(parentAdapter, projectionRules);
      
      // Child sets local (non-projected) properties
      childAdapter.setProperty('localData', 'child only');
      childAdapter.setProperty('childConfig.option', true);
      
      // Verify local state doesn't affect parent
      expect(parentAdapter.getProperty('localData')).toBeUndefined();
      expect(parentAdapter.getProperty('childConfig.option')).toBeUndefined();
      expect(parentAdapter.getProperty('child.localData')).toBeUndefined();
      
      // Verify child has access to its own local state
      expect(childAdapter.getProperty('localData')).toBe('child only');
      expect(childAdapter.getProperty('childConfig.option')).toBe(true);
      
      // Verify child still has projected state access (should be initial parent title)
      expect(childAdapter.getProperty('sharedTitle')).toBe('Parent Title');
    });
  });

  describe('Multiple Children State Isolation', () => {
    it('should support multiple children with different projection rules', async () => {
      // Reset parent state to initial values for this test
      parentAdapter.setProperty('parentState.title', 'Parent Title');
      parentAdapter.setProperty('parentState.counter', 0);
      
      // Create first child with specific projections
      const child1Rules = {
        'title': 'parentState.title',
        'count': 'parentState.counter'
      };
      
      const child1Adapter = new ScopedDataStoreAdapter(parentAdapter, child1Rules);
      
      // Create second child with different projections
      const child2Rules = {
        'message': 'sharedData.message',
        'theme': 'parentState.config.theme',
        'timestamp': 'sharedData.timestamp'
      };
      
      const child2Adapter = new ScopedDataStoreAdapter(parentAdapter, child2Rules);
      
      // Verify each child sees only its projected properties
      expect(child1Adapter.getProperty('title')).toBe('Parent Title');
      expect(child1Adapter.getProperty('count')).toBe(0);
      expect(child1Adapter.getProperty('message')).toBeUndefined(); // Not projected to child1
      
      expect(child2Adapter.getProperty('message')).toBe('Shared Message');
      expect(child2Adapter.getProperty('theme')).toBe('dark');
      expect(child2Adapter.getProperty('title')).toBeUndefined(); // Not projected to child2
      
      // Test isolated local state
      child1Adapter.setProperty('child1Local', 'local to child 1');
      child2Adapter.setProperty('child2Local', 'local to child 2');
      
      expect(child1Adapter.getProperty('child1Local')).toBe('local to child 1');
      expect(child1Adapter.getProperty('child2Local')).toBeUndefined();
      
      expect(child2Adapter.getProperty('child2Local')).toBe('local to child 2');
      expect(child2Adapter.getProperty('child1Local')).toBeUndefined();
    });

    it('should handle overlapping projections between children', async () => {
      // Reset parent state to initial values for this test (test isolation)
      parentAdapter.setProperty('parentState.counter', 10);
      
      // Both children project the same parent property
      const sharedProjection = {
        'sharedCounter': 'parentState.counter'
      };
      
      const child1Adapter = new ScopedDataStoreAdapter(parentAdapter, {
        ...sharedProjection,
        'child1Title': 'parentState.title'
      });
      
      const child2Adapter = new ScopedDataStoreAdapter(parentAdapter, {
        ...sharedProjection,
        'child2Message': 'sharedData.message'
      });
      
      // Both children should see the shared projection
      expect(child1Adapter.getProperty('sharedCounter')).toBe(10);
      expect(child2Adapter.getProperty('sharedCounter')).toBe(10);
      
      // One child updates the shared projection
      child1Adapter.setProperty('sharedCounter', 5);
      
      // Both children should see the update
      expect(child1Adapter.getProperty('sharedCounter')).toBe(5);
      expect(child2Adapter.getProperty('sharedCounter')).toBe(5);
      expect(parentAdapter.getProperty('parentState.counter')).toBe(5);
    });
  });

  describe('Array-based State Projection', () => {
    it('should support static array index projection', async () => {
      // Create child projecting specific array elements
      const projectionRules = {
        'firstItem': 'arrayData[0]',
        'secondItemName': 'arrayData[1].name',
        'thirdItemStatus': 'arrayData[2].status'
      };
      
      const childAdapter = new ScopedDataStoreAdapter(parentAdapter, projectionRules);
      
      // Verify array projections work
      expect(childAdapter.getProperty('firstItem')).toEqual({
        id: 1, name: 'Item 1', status: 'active'
      });
      expect(childAdapter.getProperty('secondItemName')).toBe('Item 2');
      expect(childAdapter.getProperty('thirdItemStatus')).toBe('pending');
      
      // Update array elements through child
      childAdapter.setProperty('secondItemName', 'Updated Item 2');
      childAdapter.setProperty('thirdItemStatus', 'completed');
      
      // Verify parent array was updated
      expect(parentAdapter.getProperty('arrayData[1].name')).toBe('Updated Item 2');
      expect(parentAdapter.getProperty('arrayData[2].status')).toBe('completed');
    });

    it('should support dynamic array index projection with variables', async () => {
      // Reset array data to ensure test isolation 
      parentAdapter.setProperty('arrayData[1].name', 'Item 2');
      parentAdapter.setProperty('arrayData[1].status', 'inactive');
      
      // Create child with dynamic array index projection
      const projectionRules = {
        'currentItem': 'arrayData[{index}]',
        'currentItemName': 'arrayData[{index}].name',
        'currentItemStatus': 'arrayData[{index}].status'
      };
      
      const childAdapter = new ScopedDataStoreAdapter(parentAdapter, projectionRules);
      
      // Set dynamic index to first item
      childAdapter.setProjectionVariable('index', 0);
      
      expect(childAdapter.getProperty('currentItemName')).toBe('Item 1');
      expect(childAdapter.getProperty('currentItemStatus')).toBe('active');
      
      // Change index to second item
      childAdapter.setProjectionVariable('index', 1);
      
      expect(childAdapter.getProperty('currentItemName')).toBe('Item 2');
      expect(childAdapter.getProperty('currentItemStatus')).toBe('inactive');
      
      // Update through dynamic projection
      childAdapter.setProperty('currentItemStatus', 'processing');
      
      // Verify correct array element was updated
      expect(parentAdapter.getProperty('arrayData[1].status')).toBe('processing');
      expect(parentAdapter.getProperty('arrayData[0].status')).toBe('active'); // Unchanged
    });
  });
});