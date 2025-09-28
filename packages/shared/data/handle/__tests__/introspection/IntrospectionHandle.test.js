/**
 * Unit tests for IntrospectionHandle
 * 
 * Tests unified introspection interface that returns Handles for all metadata:
 * - MetaHandle for prototype information
 * - SchemaHandle for schema information
 * - CapabilityHandle for capability information
 * 
 * CRITICAL: All operations must be synchronous - no await in tests!
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { IntrospectionHandle } from '../../src/introspection/IntrospectionHandle.js';
import { Handle } from '../../src/Handle.js';
import { MetaHandle } from '../../src/introspection/MetaHandle.js';
import { SchemaHandle } from '../../src/introspection/SchemaHandle.js';
import { SimpleObjectDataSource } from '../../src/SimpleObjectDataSource.js';

describe('IntrospectionHandle', () => {
  let dataSource;
  let testHandle;
  
  beforeEach(() => {
    // Create a test Handle instance with schema
    dataSource = new SimpleObjectDataSource([
      { id: 1, name: 'Test', type: 'entity' }
    ]);
    testHandle = new Handle(dataSource);
  });
  
  describe('Constructor', () => {
    it('should create IntrospectionHandle for a Handle instance', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      expect(introspectionHandle).toBeInstanceOf(IntrospectionHandle);
      expect(introspectionHandle).toBeInstanceOf(Handle);
    });
    
    it('should throw error if target is not provided', () => {
      expect(() => new IntrospectionHandle(null)).toThrow('Target Handle is required');
    });
    
    it('should throw error if target is not a Handle', () => {
      expect(() => new IntrospectionHandle({})).toThrow('Target must be a Handle instance');
    });
    
    it('should store reference to target Handle', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      expect(introspectionHandle._targetHandle).toBe(testHandle);
    });
  });
  
  describe('Query - Complete Introspection', () => {
    it('should return all metadata Handles for complete query', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      const result = introspectionHandle.query({ type: 'complete' });
      
      expect(result).toBeDefined();
      expect(result.prototype).toBeInstanceOf(MetaHandle);
      expect(result.schema).toBeInstanceOf(SchemaHandle);
      expect(result.instance).toBe(testHandle);
    });
    
    it('should return consistent Handles on repeated queries', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      const result1 = introspectionHandle.query({ type: 'complete' });
      const result2 = introspectionHandle.query({ type: 'complete' });
      
      expect(result1.prototype).toBe(result2.prototype);
      expect(result1.schema).toBe(result2.schema);
      expect(result1.instance).toBe(result2.instance);
    });
    
    it('should include capabilities when available', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      const result = introspectionHandle.query({ type: 'complete' });
      
      // Capabilities should be included
      expect(result.capabilities).toBeDefined();
      expect(typeof result.capabilities).toBe('object');
    });
  });
  
  describe('Query - Prototype Information', () => {
    it('should return MetaHandle for prototype query', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      const prototypeHandle = introspectionHandle.query({ type: 'prototype' });
      
      expect(prototypeHandle).toBeInstanceOf(MetaHandle);
    });
    
    it('should return queryable MetaHandle', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      const prototypeHandle = introspectionHandle.query({ type: 'prototype' });
      const members = prototypeHandle.query({ type: 'prototype-members' });
      
      expect(members).toBeDefined();
      expect(members.methods).toBeDefined();
      expect(Array.isArray(members.methods)).toBe(true);
    });
    
    it('should return same MetaHandle on repeated queries', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      const proto1 = introspectionHandle.query({ type: 'prototype' });
      const proto2 = introspectionHandle.query({ type: 'prototype' });
      
      expect(proto1).toBe(proto2);
    });
  });
  
  describe('Query - Schema Information', () => {
    it('should return SchemaHandle for schema query', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      const schemaHandle = introspectionHandle.query({ type: 'schema' });
      
      expect(schemaHandle).toBeInstanceOf(SchemaHandle);
    });
    
    it('should return queryable SchemaHandle', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      const schemaHandle = introspectionHandle.query({ type: 'schema' });
      const metadata = schemaHandle.query({ type: 'schema-metadata' });
      
      expect(metadata).toBeDefined();
      expect(typeof metadata).toBe('object');
    });
    
    it('should return same SchemaHandle on repeated queries', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      const schema1 = introspectionHandle.query({ type: 'schema' });
      const schema2 = introspectionHandle.query({ type: 'schema' });
      
      expect(schema1).toBe(schema2);
    });
  });
  
  describe('Query - Capabilities', () => {
    it('should return capabilities for capabilities query', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      const capabilities = introspectionHandle.query({ type: 'capabilities' });
      
      expect(capabilities).toBeDefined();
      expect(typeof capabilities).toBe('object');
    });
    
    it('should include standard Handle operations', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      const capabilities = introspectionHandle.query({ type: 'capabilities' });
      
      expect(capabilities.operations).toContain('query');
      expect(capabilities.operations).toContain('subscribe');
    });
    
    it('should detect update capability when available', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      const capabilities = introspectionHandle.query({ type: 'capabilities' });
      
      // DataSource has update, so it should be in capabilities
      expect(capabilities.operations).toContain('update');
    });
  });
  
  describe('Query - Instance Reference', () => {
    it('should return original Handle for instance query', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      const instance = introspectionHandle.query({ type: 'instance' });
      
      expect(instance).toBe(testHandle);
    });
  });
  
  describe('LLM Format Generation', () => {
    it('should generate LLM-friendly format', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      const llmFormat = introspectionHandle.query({ type: 'llm-format' });
      
      expect(llmFormat).toBeDefined();
      expect(llmFormat.resource).toBeDefined();
      expect(llmFormat.prototype).toBeDefined();
      expect(llmFormat.schema).toBeDefined();
      expect(llmFormat.capabilities).toBeDefined();
    });
    
    it('should include prototype methods in LLM format', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      const llmFormat = introspectionHandle.query({ type: 'llm-format' });
      
      expect(llmFormat.prototype.methods).toBeDefined();
      expect(Array.isArray(llmFormat.prototype.methods)).toBe(true);
    });
    
    it('should include schema attributes in LLM format', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      const llmFormat = introspectionHandle.query({ type: 'llm-format' });
      
      expect(llmFormat.schema.attributes).toBeDefined();
      expect(typeof llmFormat.schema.attributes).toBe('object');
    });
    
    it('should include capabilities in LLM format', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      const llmFormat = introspectionHandle.query({ type: 'llm-format' });
      
      expect(llmFormat.capabilities.operations).toBeDefined();
      expect(Array.isArray(llmFormat.capabilities.operations)).toBe(true);
    });
  });
  
  describe('Error Handling', () => {
    it('should throw error for invalid query type', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      expect(() => {
        introspectionHandle.query({ type: 'invalid-type' });
      }).toThrow('Unknown introspection query type');
    });
    
    it('should throw error if query spec is not provided', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      expect(() => {
        introspectionHandle.query(null);
      }).toThrow('Query specification must be an object');
    });
    
    it('should throw error if query spec is not an object', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      expect(() => {
        introspectionHandle.query('invalid');
      }).toThrow('Query specification must be an object');
    });
  });
  
  describe('Subscription Support', () => {
    it('should support subscription to introspection changes', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      const events = [];
      
      const subscription = introspectionHandle.subscribe(
        { type: 'complete' },
        (event) => events.push(event)
      );
      
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
      
      subscription.unsubscribe();
    });
    
    it('should notify when underlying Handle changes', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      const events = [];
      
      // Subscribe with a query that matches data changes
      introspectionHandle.subscribe(
        { id: 2 },  // Subscribe to changes matching this query
        (event) => events.push(event)
      );
      
      // Trigger change in DataSource
      dataSource.addData({ id: 2, name: 'Changed', type: 'entity' });
      
      // Should have received notification (subscriptions notify synchronously in our implementation)
      expect(events.length).toBeGreaterThan(0);
    });
  });
  
  describe('Integration with Existing Handles', () => {
    it('should work with Handle instances', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      const result = introspectionHandle.query({ type: 'complete' });
      
      expect(result.instance).toBeInstanceOf(Handle);
      expect(result.prototype).toBeInstanceOf(MetaHandle);
      expect(result.schema).toBeInstanceOf(SchemaHandle);
    });
    
    it('should preserve Handle type information', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      
      const result = introspectionHandle.query({ type: 'complete' });
      
      // Verify we get the original Handle back
      expect(result.instance).toBe(testHandle);
      expect(result.instance.handleType).toBeDefined();
      expect(result.instance.handleType).toBe('Handle');
    });
  });
  
  describe('Meta-Circularity', () => {
    it('should be able to introspect IntrospectionHandle itself', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      const metaIntrospection = new IntrospectionHandle(introspectionHandle);
      
      const result = metaIntrospection.query({ type: 'complete' });
      
      expect(result).toBeDefined();
      expect(result.prototype).toBeInstanceOf(MetaHandle);
    });
    
    it('should detect IntrospectionHandle as queryable', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      const metaIntrospection = new IntrospectionHandle(introspectionHandle);
      
      const capabilities = metaIntrospection.query({ type: 'capabilities' });
      
      expect(capabilities.operations).toContain('query');
    });
  });
});