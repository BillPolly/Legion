/**
 * Integration tests for @legion/rdf with @legion/actors
 * 
 * Tests RDF Actor system integration:
 * - RDFHandle Actor inheritance and message handling
 * - Remote capability for frontend/backend communication
 * - Actor pattern compliance for synchronous operations
 * - Message-based subscriptions and lifecycle management
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { RDFDataSource } from '../../src/RDFDataSource.js';
import { RDFHandle } from '../../src/RDFHandle.js';
import { NamespaceManager } from '../../src/NamespaceManager.js';
import { SimpleTripleStore } from '../../src/SimpleTripleStore.js';

// Import Actor system components
import { Actor } from '@legion/actors';

describe('RDF + Actor System Integration', () => {
  let tripleStore;
  let namespaceManager;
  let rdfDataSource;
  let aliceHandle;
  
  beforeEach(() => {
    // Create RDF infrastructure
    tripleStore = new SimpleTripleStore();
    namespaceManager = new NamespaceManager();
    
    // Add standard namespaces
    namespaceManager.addNamespace('rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#');
    namespaceManager.addNamespace('foaf', 'http://xmlns.com/foaf/0.1/');
    namespaceManager.addNamespace('ex', 'http://example.org/');
    
    rdfDataSource = new RDFDataSource(tripleStore, namespaceManager);
    
    // Add test RDF data
    tripleStore.add('ex:alice', 'rdf:type', 'foaf:Person');
    tripleStore.add('ex:alice', 'foaf:name', 'Alice Smith');
    tripleStore.add('ex:alice', 'foaf:age', 30);
    tripleStore.add('ex:alice', 'foaf:email', 'alice@example.com');
    tripleStore.add('ex:alice', 'foaf:knows', 'ex:bob');
    
    tripleStore.add('ex:bob', 'rdf:type', 'foaf:Person');
    tripleStore.add('ex:bob', 'foaf:name', 'Bob Johnson');
    tripleStore.add('ex:bob', 'foaf:age', 25);
    tripleStore.add('ex:bob', 'foaf:email', 'bob@example.com');
    
    // Create RDFHandle for Alice
    aliceHandle = new RDFHandle(rdfDataSource, 'ex:alice');
  });
  
  afterEach(() => {
    if (aliceHandle && !aliceHandle.isDestroyed()) {
      aliceHandle.destroy();
    }
  });
  
  describe('Actor System Inheritance', () => {
    test('RDFHandle should extend Actor through Handle', () => {
      expect(aliceHandle).toBeInstanceOf(Actor);
      expect(aliceHandle).toBeInstanceOf(RDFHandle);
      expect(aliceHandle.isActor).toBe(true);
      
      // Verify Handle properties
      expect(aliceHandle.handleType).toBe('RDFHandle');
      expect(typeof aliceHandle.dataSource).toBe('object');
    });
    
    test('RDFHandle should inherit Actor methods', () => {
      // Check for Actor methods
      expect(typeof aliceHandle.receive).toBe('function');
      expect(typeof aliceHandle.call).toBe('function');
      expect(typeof aliceHandle.query).toBe('function');
      
      // Verify these are not just undefined placeholders
      expect(aliceHandle.receive).toBeDefined();
      expect(aliceHandle.call).toBeDefined();
      expect(aliceHandle.query).toBeDefined();
    });
    
    test('RDFHandle should support Actor isActor property', () => {
      expect(aliceHandle.isActor).toBe(true);
      
      // Should be detectable as Actor in collections
      const actors = [aliceHandle, {}, function() {}];
      const realActors = actors.filter(item => item.isActor);
      expect(realActors).toHaveLength(1);
      expect(realActors[0]).toBe(aliceHandle);
    });
  });
  
  describe('Message Passing via Actor Interface', () => {
    test('should handle value retrieval messages', () => {
      const valueMessage = { type: 'value' };
      const result = aliceHandle.receive(valueMessage);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result['foaf:name']).toBe('Alice Smith');
      expect(result['foaf:age']).toBe(30);
      expect(result['foaf:email']).toBe('alice@example.com');
    });
    
    test('should handle query messages', () => {
      const queryMessage = {
        type: 'query',
        querySpec: {
          find: ['?name', '?age'],
          where: [
            ['ex:alice', 'foaf:name', '?name'],
            ['ex:alice', 'foaf:age', '?age']
          ]
        }
      };
      
      const result = aliceHandle.receive(queryMessage);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'Alice Smith',
        age: 30
      });
    });
    
    test('should handle subscription messages', () => {
      const callbacks = [];
      const subscriptionMessage = {
        type: 'subscribe',
        querySpec: {
          find: ['?p', '?o'],
          where: [['ex:alice', '?p', '?o']]
        },
        callback: (results) => callbacks.push(results)
      };
      
      const subscription = aliceHandle.receive(subscriptionMessage);
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
      
      // Modify data to trigger subscription
      tripleStore.add('ex:alice', 'foaf:nickname', 'Ali');
      
      // Verify subscription fired
      expect(callbacks.length).toBeGreaterThan(0);
      
      // Clean up
      subscription.unsubscribe();
    });
    
    test('should handle introspection messages', () => {
      const introspectMessage = { type: 'introspect' };
      const result = aliceHandle.receive(introspectMessage);
      
      expect(result).toBeDefined();
      expect(result.handleType).toBe('RDFHandle');
      expect(result.isDestroyed).toBe(false);
      expect(typeof result.subscriptionCount).toBe('number');
      expect(result.resourceURI).toBe('ex:alice');
    });
    
    test('should handle destroy messages', () => {
      const destroyMessage = { type: 'destroy' };
      
      expect(aliceHandle.isDestroyed()).toBe(false);
      aliceHandle.receive(destroyMessage);
      expect(aliceHandle.isDestroyed()).toBe(true);
      
      // Should reject operations after destruction
      expect(() => aliceHandle.receive({ type: 'value' })).toThrow('Handle has been destroyed');
    });
  });
  
  describe('Remote Communication Capability', () => {
    test('should support remote-style messages with correlation IDs', () => {
      const remoteMessage = {
        type: 'value',
        correlationId: 'remote-call-123',
        source: 'frontend-client',
        timestamp: Date.now()
      };
      
      const result = aliceHandle.receive(remoteMessage);
      expect(result).toBeDefined();
      expect(result['foaf:name']).toBe('Alice Smith');
      
      // Should work regardless of extra message properties
      expect(result['foaf:age']).toBe(30);
    });
    
    test('should support batched message handling', () => {
      const messages = [
        { type: 'value' },
        { 
          type: 'query', 
          querySpec: { 
            find: ['?name'], 
            where: [['ex:alice', 'foaf:name', '?name']] 
          } 
        },
        { type: 'introspect' }
      ];
      
      const results = messages.map(msg => aliceHandle.receive(msg));
      
      expect(results).toHaveLength(3);
      expect(results[0]['foaf:name']).toBe('Alice Smith'); // value result
      expect(results[1][0].name).toBe('Alice Smith'); // query result
      expect(results[2].handleType).toBe('RDFHandle'); // introspect result
    });
    
    test('should maintain state consistency across remote calls', () => {
      // First remote call
      const result1 = aliceHandle.receive({ 
        type: 'value', 
        correlationId: 'call-1' 
      });
      
      // Modify underlying data
      tripleStore.remove('ex:alice', 'foaf:age', 30);
      tripleStore.add('ex:alice', 'foaf:age', 31);
      
      // Manually invalidate cache since direct tripleStore changes don't trigger subscriptions
      aliceHandle.invalidateCache();
      
      // Second remote call should see the change
      const result2 = aliceHandle.receive({ 
        type: 'value', 
        correlationId: 'call-2' 
      });
      
      expect(result1['foaf:age']).toBe(30);
      expect(result2['foaf:age']).toBe(31);
    });
  });
  
  describe('Actor Pattern Compliance', () => {
    test('should maintain synchronous operations for Actor pattern', () => {
      // All Actor message handling should be synchronous
      const startTime = Date.now();
      
      const result = aliceHandle.receive({ type: 'value' });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result).toBeDefined();
      expect(result['foaf:name']).toBe('Alice Smith');
      
      // Should be virtually instant since it's synchronous
      expect(duration).toBeLessThan(5); // Very generous allowance for slow systems
    });
    
    test('should handle Actor errors synchronously', () => {
      // Invalid message type should throw immediately
      expect(() => {
        aliceHandle.receive({ type: 'invalid-operation' });
      }).toThrow();
      
      // Query with invalid syntax should throw immediately
      expect(() => {
        aliceHandle.receive({
          type: 'query',
          querySpec: { malformed: 'query' }
        });
      }).toThrow();
    });
    
    test('should support Actor call method for chaining', () => {
      // Actor call should return the handle for chaining
      const result = aliceHandle.call({ type: 'value' });
      expect(result).toBe(aliceHandle);
      
      // Should maintain Actor interface
      expect(result.isActor).toBe(true);
    });
  });
  
  describe('Subscription Management via Actor Messages', () => {
    test('should track subscriptions via Actor messages', () => {
      const subscription1 = aliceHandle.receive({
        type: 'subscribe',
        querySpec: { find: ['?p', '?o'], where: [['ex:alice', '?p', '?o']] },
        callback: () => {}
      });
      
      const subscription2 = aliceHandle.receive({
        type: 'subscribe', 
        querySpec: { find: ['?type'], where: [['ex:alice', 'rdf:type', '?type']] },
        callback: () => {}
      });
      
      // Check subscription count via introspection
      const introspect = aliceHandle.receive({ type: 'introspect' });
      expect(introspect.subscriptionCount).toBe(2);
      
      // Clean up first subscription
      subscription1.unsubscribe();
      
      const introspect2 = aliceHandle.receive({ type: 'introspect' });
      expect(introspect2.subscriptionCount).toBe(1);
      
      // Clean up remaining
      subscription2.unsubscribe();
    });
    
    test('should cleanup subscriptions on Actor destroy', () => {
      // Create multiple subscriptions
      aliceHandle.receive({
        type: 'subscribe',
        querySpec: { find: ['?p'], where: [['ex:alice', '?p', '?o']] },
        callback: () => {}
      });
      
      aliceHandle.receive({
        type: 'subscribe',
        querySpec: { find: ['?o'], where: [['?s', 'foaf:knows', 'ex:alice']] },
        callback: () => {}
      });
      
      const introspectBefore = aliceHandle.receive({ type: 'introspect' });
      expect(introspectBefore.subscriptionCount).toBe(2);
      
      // Destroy handle via Actor message
      aliceHandle.receive({ type: 'destroy' });
      
      // Should reject operations after destroy (subscriptions were cleaned up)
      expect(() => aliceHandle.receive({ type: 'introspect' })).toThrow('Handle has been destroyed');
      expect(aliceHandle.isDestroyed()).toBe(true);
    });
  });
  
  describe('RDF-specific Actor Extensions', () => {
    test('should support RDF URI access via Actor messages', () => {
      // RDFHandle should expose RDF-specific functionality via Actor interface
      const introspect = aliceHandle.receive({ type: 'introspect' });
      
      expect(introspect.resourceURI).toBe('ex:alice');
      expect(introspect.handleType).toBe('RDFHandle');
      
      // Should provide RDF-specific metadata
      expect(introspect.rdfType).toBe('foaf:Person');
      expect(Array.isArray(introspect.properties)).toBe(true);
      expect(introspect.properties).toContain('foaf:name');
      expect(introspect.properties).toContain('foaf:age');
    });
    
    test('should support relationship navigation via Actor messages', () => {
      // Test following RDF links via Actor message
      const followMessage = {
        type: 'follow',
        property: 'foaf:knows'
      };
      
      const bobHandle = aliceHandle.receive(followMessage);
      expect(bobHandle).toBeInstanceOf(RDFHandle);
      expect(bobHandle.getURI()).toBe('ex:bob');
      
      // Bob handle should also be an Actor
      expect(bobHandle.isActor).toBe(true);
      
      // Should be able to get Bob's data via Actor message
      const bobData = bobHandle.receive({ type: 'value' });
      expect(bobData['foaf:name']).toBe('Bob Johnson');
      
      // Clean up
      bobHandle.destroy();
    });
    
    test('should support property listing via Actor messages', () => {
      const propertiesMessage = { type: 'properties' };
      const properties = aliceHandle.receive(propertiesMessage);
      
      expect(Array.isArray(properties)).toBe(true);
      expect(properties).toContain('rdf:type');
      expect(properties).toContain('foaf:name');
      expect(properties).toContain('foaf:age');
      expect(properties).toContain('foaf:email');
      expect(properties).toContain('foaf:knows');
    });
  });
  
  describe('Cross-Handle Actor Communication', () => {
    test('should support Actor-to-Actor communication between RDF handles', () => {
      const bobHandle = new RDFHandle(rdfDataSource, 'ex:bob');
      
      try {
        // Both handles should be Actors
        expect(aliceHandle.isActor).toBe(true);
        expect(bobHandle.isActor).toBe(true);
        
        // They should be able to reference each other
        const aliceKnows = aliceHandle.receive({
          type: 'query',
          querySpec: {
            find: ['?friend'],
            where: [['ex:alice', 'foaf:knows', '?friend']]
          }
        });
        
        expect(aliceKnows[0].friend).toBe('ex:bob');
        
        // Bob handle should have corresponding data
        const bobData = bobHandle.receive({ type: 'value' });
        expect(bobData['foaf:name']).toBe('Bob Johnson');
        
      } finally {
        bobHandle.destroy();
      }
    });
    
    test('should maintain Actor isolation between handles', () => {
      const bobHandle = new RDFHandle(rdfDataSource, 'ex:bob');
      
      try {
        // Each handle should have independent Actor state
        const aliceIntrospect = aliceHandle.receive({ type: 'introspect' });
        const bobIntrospect = bobHandle.receive({ type: 'introspect' });
        
        expect(aliceIntrospect.resourceURI).toBe('ex:alice');
        expect(bobIntrospect.resourceURI).toBe('ex:bob');
        
        expect(aliceIntrospect.subscriptionCount).toBe(0);
        expect(bobIntrospect.subscriptionCount).toBe(0);
        
        // Subscribe to Alice only
        aliceHandle.receive({
          type: 'subscribe',
          querySpec: { find: ['?p'], where: [['ex:alice', '?p', '?o']] },
          callback: () => {}
        });
        
        // Check isolation
        const aliceAfter = aliceHandle.receive({ type: 'introspect' });
        const bobAfter = bobHandle.receive({ type: 'introspect' });
        
        expect(aliceAfter.subscriptionCount).toBe(1);
        expect(bobAfter.subscriptionCount).toBe(0); // Should remain isolated
        
      } finally {
        bobHandle.destroy();
      }
    });
  });
});