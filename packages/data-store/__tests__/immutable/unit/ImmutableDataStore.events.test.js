/**
 * Unit Tests for ImmutableDataStore State Management and Events
 * Per implementation plan Phase 3 Step 3.4
 * TDD approach - tests written first before implementation
 */

import { ImmutableDataStore } from '../../../src/immutable/ImmutableDataStore.js';
import { CardinalityConstraint } from '../../../src/immutable/constraints/CardinalityConstraint.js';
import { Edge } from '../../../src/Edge.js';
import { RelationshipType } from '../../../src/RelationshipType.js';

describe('ImmutableDataStore State Management and Events', () => {
  let store;

  beforeEach(() => {
    store = new ImmutableDataStore();
  });

  describe('Event Emission for State Transitions', () => {
    test('should emit edgeAdded event when edge is added', () => {
      let eventData = null;
      const eventListener = (data) => { eventData = data; };
      store.on('edgeAdded', eventListener);
      
      const edge = new Edge('worksAt', 'alice', 'company1');
      const newStore = store.addEdge(edge);
      
      expect(eventData).toEqual({
        type: 'edgeAdded',
        edge,
        previousState: store,
        newState: newStore,
        timestamp: expect.any(Number)
      });
    });

    test('should emit edgeRemoved event when edge is removed', () => {
      const edge = new Edge('worksAt', 'alice', 'company1');
      const storeWithEdge = store.addEdge(edge);
      
      let eventData = null;
      const eventListener = (data) => { eventData = data; };
      storeWithEdge.on('edgeRemoved', eventListener);
      
      const newStore = storeWithEdge.removeEdge(edge);
      
      expect(eventData).toEqual({
        type: 'edgeRemoved',
        edge,
        previousState: storeWithEdge,
        newState: newStore,
        timestamp: expect.any(Number)
      });
    });

    test('should emit constraintAdded event when constraint is added', () => {
      let eventData = null;
      const eventListener = (data) => { eventData = data; };
      store.on('constraintAdded', eventListener);
      
      const constraint = new CardinalityConstraint('c1', 'worksAt', 'source', 0, 5);
      const newStore = store.addConstraint(constraint);
      
      expect(eventData).toEqual({
        type: 'constraintAdded',
        constraint,
        previousState: store,
        newState: newStore,
        timestamp: expect.any(Number)
      });
    });

    test('should emit constraintRemoved event when constraint is removed', () => {
      const constraint = new CardinalityConstraint('c1', 'worksAt', 'source', 0, 5);
      const storeWithConstraint = store.addConstraint(constraint);
      
      let eventData = null;
      const eventListener = (data) => { eventData = data; };
      storeWithConstraint.on('constraintRemoved', eventListener);
      
      const newStore = storeWithConstraint.removeConstraint('c1');
      
      expect(eventData).toEqual({
        type: 'constraintRemoved',
        constraintId: 'c1',
        constraint,
        previousState: storeWithConstraint,
        newState: newStore,
        timestamp: expect.any(Number)
      });
    });

    test('should emit relationTypeAdded event when relationship type is defined', () => {
      let eventData = null;
      const eventListener = (data) => { eventData = data; };
      store.on('relationTypeAdded', eventListener);
      
      const relType = new RelationshipType('worksAt', 'employs');
      const newStore = store.defineRelationType(relType);
      
      expect(eventData).toEqual({
        type: 'relationTypeAdded',
        relationType: relType,
        previousState: store,
        newState: newStore,
        timestamp: expect.any(Number)
      });
    });

    test('should emit batchExecuted event for batch operations', () => {
      let eventData = null;
      const eventListener = (data) => { eventData = data; };
      store.on('batchExecuted', eventListener);
      
      const newStore = store.batch(batch => {
        batch.addEdge(new Edge('worksAt', 'alice', 'company1'));
        batch.addEdge(new Edge('worksAt', 'bob', 'company1'));
      });
      
      expect(eventData).toEqual({
        type: 'batchExecuted',
        operationCount: 2,
        previousState: store,
        newState: newStore,
        timestamp: expect.any(Number)
      });
    });

    test('should emit constraintViolation event when validation fails', () => {
      const constraint = new CardinalityConstraint('c1', 'worksAt', 'source', 0, 1);
      const storeWithConstraint = store.addConstraint(constraint);
      const edge1 = new Edge('worksAt', 'alice', 'company1');
      const storeWithEdge = storeWithConstraint.addEdge(edge1);
      
      let eventData = null;
      const eventListener = (data) => { eventData = data; };
      storeWithEdge.on('constraintViolation', eventListener);
      
      const edge2 = new Edge('worksAt', 'alice', 'company2');
      
      try {
        storeWithEdge.addEdge(edge2);
      } catch (error) {
        // Expected to fail
      }
      
      expect(eventData).toEqual({
        type: 'constraintViolation',
        edge: edge2,
        violations: expect.arrayContaining([
          expect.objectContaining({
            constraintId: 'c1'
          })
        ]),
        timestamp: expect.any(Number)
      });
    });

    test('should support multiple event listeners', () => {
      let event1Data = null;
      let event2Data = null;
      const listener1 = (data) => { event1Data = data; };
      const listener2 = (data) => { event2Data = data; };
      
      store.on('edgeAdded', listener1);
      store.on('edgeAdded', listener2);
      
      const edge = new Edge('worksAt', 'alice', 'company1');
      store.addEdge(edge);
      
      expect(event1Data).toBeDefined();
      expect(event2Data).toBeDefined();
      expect(event1Data.type).toBe('edgeAdded');
      expect(event2Data.type).toBe('edgeAdded');
    });

    test('should support removing event listeners', () => {
      let eventData = null;
      const listener = (data) => { eventData = data; };
      
      store.on('edgeAdded', listener);
      store.off('edgeAdded', listener);
      
      const edge = new Edge('worksAt', 'alice', 'company1');
      store.addEdge(edge);
      
      expect(eventData).toBeNull();
    });

    test('should support once() for single-use listeners', () => {
      let callCount = 0;
      const listener = () => { callCount++; };
      
      store.once('edgeAdded', listener);
      
      const edge1 = new Edge('worksAt', 'alice', 'company1');
      const edge2 = new Edge('worksAt', 'bob', 'company1');
      
      store.addEdge(edge1);
      store.addEdge(edge2);
      
      expect(callCount).toBe(1);
    });
  });

  describe('History Recording (Basic)', () => {
    test('should record operation history', () => {
      const edge = new Edge('worksAt', 'alice', 'company1');
      const constraint = new CardinalityConstraint('c1', 'worksAt', 'source', 0, 5);
      
      const store1 = store.addEdge(edge);
      const store2 = store1.addConstraint(constraint);
      const store3 = store2.removeEdge(edge);
      
      const history = store3.getHistory();
      
      expect(history).toHaveLength(3);
      expect(history[0]).toEqual({
        operation: 'addEdge',
        edge,
        timestamp: expect.any(Number),
        stateVersion: expect.any(Number)
      });
      expect(history[1]).toEqual({
        operation: 'addConstraint',
        constraint,
        timestamp: expect.any(Number),
        stateVersion: expect.any(Number)
      });
      expect(history[2]).toEqual({
        operation: 'removeEdge',
        edge,
        timestamp: expect.any(Number),
        stateVersion: expect.any(Number)
      });
    });

    test('should record batch operations as single history entry', () => {
      const finalStore = store.batch(batch => {
        batch.addEdge(new Edge('worksAt', 'alice', 'company1'));
        batch.addEdge(new Edge('worksAt', 'bob', 'company1'));
        batch.addConstraint(new CardinalityConstraint('c1', 'worksAt', 'source', 0, 5));
      });
      
      const history = finalStore.getHistory();
      
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual({
        operation: 'batch',
        operationCount: 3,
        timestamp: expect.any(Number),
        stateVersion: expect.any(Number)
      });
    });

    test('should provide history diff between states', () => {
      const edge1 = new Edge('worksAt', 'alice', 'company1');
      const edge2 = new Edge('worksAt', 'bob', 'company1');
      
      const store1 = store.addEdge(edge1);
      const store2 = store1.addEdge(edge2);
      
      const diff = store2.getHistoryDiff(store);
      
      expect(diff).toEqual({
        edgesAdded: [edge1, edge2],
        edgesRemoved: [],
        constraintsAdded: [],
        constraintsRemoved: [],
        relationTypesAdded: expect.arrayContaining([
          expect.objectContaining({ forwardName: 'worksAt' })
        ])
      });
    });

    test('should support history traversal', () => {
      const edge = new Edge('worksAt', 'alice', 'company1');
      const constraint = new CardinalityConstraint('c1', 'worksAt', 'source', 0, 5);
      
      const store1 = store.addEdge(edge);
      const store2 = store1.addConstraint(constraint);
      
      const previousState = store2.getPreviousState();
      
      expect(previousState).toBe(store1);
      expect(previousState.hasEdge(edge)).toBe(true);
      expect(previousState.getConstraintCount()).toBe(0);
    });

    test('should limit history size', () => {
      let currentStore = store;
      
      // Add 20 operations
      for (let i = 0; i < 20; i++) {
        currentStore = currentStore.addEdge(new Edge('worksAt', `person${i}`, 'company1'));
      }
      
      const history = currentStore.getHistory();
      
      // Should limit to last 10 operations (default limit)
      expect(history).toHaveLength(10);
      expect(history[0].edge.src).toBe('person10'); // First kept entry
      expect(history[9].edge.src).toBe('person19'); // Last entry
    });

    test('should support custom history limit', () => {
      const storeWithCustomLimit = new ImmutableDataStore({ historyLimit: 5 });
      let currentStore = storeWithCustomLimit;
      
      // Add 10 operations
      for (let i = 0; i < 10; i++) {
        currentStore = currentStore.addEdge(new Edge('worksAt', `person${i}`, 'company1'));
      }
      
      const history = currentStore.getHistory();
      
      expect(history).toHaveLength(5);
      expect(history[0].edge.src).toBe('person5'); // First kept entry
      expect(history[4].edge.src).toBe('person9'); // Last entry
    });
  });

  describe('Enhanced Read-only Accessors', () => {
    test('should provide state metadata', () => {
      const edge = new Edge('worksAt', 'alice', 'company1');
      const constraint = new CardinalityConstraint('c1', 'worksAt', 'source', 0, 5);
      
      const finalStore = store
        .addEdge(edge)
        .addConstraint(constraint);
      
      const metadata = finalStore.getStateMetadata();
      
      expect(metadata).toEqual({
        version: expect.any(Number),
        createdAt: expect.any(Number),
        lastModified: expect.any(Number),
        operationCount: 2,
        edgeCount: 1,
        constraintCount: 1,
        relationTypeCount: 1
      });
    });

    test('should provide state fingerprint for comparison', () => {
      const edge = new Edge('worksAt', 'alice', 'company1');
      
      const store1 = store.addEdge(edge);
      const store2 = store.addEdge(edge); // Same operation
      
      const fingerprint1 = store1.getStateFingerprint();
      const fingerprint2 = store2.getStateFingerprint();
      
      expect(fingerprint1).toBe(fingerprint2);
      expect(typeof fingerprint1).toBe('string');
      expect(fingerprint1).toHaveLength(64); // Padded hash
    });

    test('should detect state changes with fingerprint', () => {
      const edge1 = new Edge('worksAt', 'alice', 'company1');
      const edge2 = new Edge('worksAt', 'bob', 'company1');
      
      const store1 = store.addEdge(edge1);
      const store2 = store1.addEdge(edge2);
      
      const fingerprint1 = store1.getStateFingerprint();
      const fingerprint2 = store2.getStateFingerprint();
      
      expect(fingerprint1).not.toBe(fingerprint2);
    });

    test('should provide performance statistics', () => {
      const finalStore = store.batch(batch => {
        for (let i = 0; i < 100; i++) {
          batch.addEdge(new Edge('worksAt', `person${i}`, 'company1'));
        }
      });
      
      const stats = finalStore.getPerformanceStats();
      
      expect(stats).toEqual({
        totalOperations: 100, // Individual operations within batch
        lastOperationTime: expect.any(Number),
        averageOperationTime: expect.any(Number),
        totalValidationTime: expect.any(Number)
      });
    });
  });

  describe('Event Error Handling', () => {
    test('should handle event listener errors gracefully', () => {
      let errorThrown = false;
      let normalCalled = false;
      
      const errorListener = () => {
        errorThrown = true;
        throw new Error('Listener error');
      };
      const normalListener = () => {
        normalCalled = true;
      };
      
      store.on('edgeAdded', errorListener);
      store.on('edgeAdded', normalListener);
      
      const edge = new Edge('worksAt', 'alice', 'company1');
      
      // Should not throw despite listener error
      expect(() => store.addEdge(edge)).not.toThrow();
      
      // Both listeners should be called
      expect(errorThrown).toBe(true);
      expect(normalCalled).toBe(true);
    });

    test('should emit listenerError event for failed listeners', () => {
      let errorEventData = null;
      const errorEventListener = (data) => { errorEventData = data; };
      
      const errorListener = () => {
        throw new Error('Listener error');
      };
      
      store.on('edgeAdded', errorListener);
      store.on('listenerError', errorEventListener);
      
      const edge = new Edge('worksAt', 'alice', 'company1');
      store.addEdge(edge);
      
      expect(errorEventData).toEqual({
        type: 'listenerError',
        originalEvent: 'edgeAdded',
        error: expect.any(Error),
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Event Inheritance', () => {
    test('should inherit events from previous store state', () => {
      let callCount = 0;
      const listener = () => { callCount++; };
      
      store.on('edgeAdded', listener);
      
      const edge1 = new Edge('worksAt', 'alice', 'company1');
      const store1 = store.addEdge(edge1);
      
      // New store should inherit event listeners
      const edge2 = new Edge('worksAt', 'bob', 'company1');
      store1.addEdge(edge2);
      
      expect(callCount).toBe(2);
    });

    test('should allow disabling event inheritance', () => {
      const storeNoInherit = new ImmutableDataStore({ inheritEvents: false });
      let callCount = 0;
      const listener = () => { callCount++; };
      
      storeNoInherit.on('edgeAdded', listener);
      
      const edge1 = new Edge('worksAt', 'alice', 'company1');
      const store1 = storeNoInherit.addEdge(edge1);
      
      // New store should not inherit event listeners
      const edge2 = new Edge('worksAt', 'bob', 'company1');
      store1.addEdge(edge2);
      
      expect(callCount).toBe(1); // Only original store event
    });
  });
});