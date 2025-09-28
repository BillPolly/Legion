/**
 * Integration tests for IntrospectionHandle
 * 
 * Tests complete workflows using real components:
 * - IntrospectionHandle with real Handle instances
 * - MetaHandle with real prototypes
 * - SchemaHandle with real schemas
 * - SimpleObjectDataSource with real data
 * 
 * CRITICAL: No mocks - all tests use real components!
 * CRITICAL: All operations must be synchronous - no await in tests!
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { IntrospectionHandle } from '../../src/introspection/IntrospectionHandle.js';
import { Handle } from '../../src/Handle.js';
import { MetaHandle } from '../../src/introspection/MetaHandle.js';
import { SchemaHandle } from '../../src/introspection/SchemaHandle.js';
import { SimpleObjectDataSource } from '../../src/SimpleObjectDataSource.js';

describe('IntrospectionHandle Integration Tests', () => {
  let dataSource;
  let userHandle;
  let schema;
  
  beforeEach(() => {
    // Create a realistic schema with entity types, properties, and relationships
    schema = {
      version: '1.0.0',
      entities: {
        'User': {
          attributes: {
            id: { type: 'number', required: true },
            name: { type: 'string', required: true },
            email: { type: 'string', required: true },
            age: { type: 'number' }
          },
          relationships: {
            posts: { type: 'hasMany', target: 'Post' }
          }
        },
        'Post': {
          attributes: {
            id: { type: 'number', required: true },
            title: { type: 'string', required: true },
            content: { type: 'string' },
            userId: { type: 'number', required: true }
          },
          relationships: {
            author: { type: 'belongsTo', target: 'User' }
          }
        }
      }
    };
    
    // Create DataSource with real data
    dataSource = new SimpleObjectDataSource([
      { id: 1, name: 'Alice', email: 'alice@example.com', age: 30 },
      { id: 2, name: 'Bob', email: 'bob@example.com', age: 25 }
    ]);
    
    // Create Handle instance
    userHandle = new Handle(dataSource);
  });
  
  describe('Complete Introspection Workflow', () => {
    it('should introspect Handle instance and get all metadata as Handles', () => {
      // Create IntrospectionHandle for the user Handle
      const introspection = new IntrospectionHandle(userHandle);
      
      // Query for complete introspection
      const result = introspection.query({ type: 'complete' });
      
      // Verify all metadata is returned as Handles
      expect(result).toBeDefined();
      expect(result.prototype).toBeInstanceOf(MetaHandle);
      expect(result.schema).toBeInstanceOf(SchemaHandle);
      expect(result.instance).toBeInstanceOf(Handle);
      expect(result.instance).toBe(userHandle);
      
      // Verify capabilities object
      expect(result.capabilities).toBeDefined();
      expect(result.capabilities.operations).toContain('query');
      expect(result.capabilities.operations).toContain('subscribe');
      expect(result.capabilities.operations).toContain('update');
    });
    
    it('should query each metadata Handle independently', () => {
      const introspection = new IntrospectionHandle(userHandle);
      
      // Get complete introspection
      const result = introspection.query({ type: 'complete' });
      
      // Query the MetaHandle for prototype information
      const prototypeMembers = result.prototype.query({ type: 'prototype-members' });
      expect(prototypeMembers).toBeDefined();
      expect(prototypeMembers.methods).toBeDefined();
      expect(Array.isArray(prototypeMembers.methods)).toBe(true);
      expect(prototypeMembers.methods.length).toBeGreaterThan(0);
      
      // Query the SchemaHandle for schema structure
      const schemaMetadata = result.schema.query({ type: 'schema-metadata' });
      expect(schemaMetadata).toBeDefined();
      expect(typeof schemaMetadata).toBe('object');
      
      // Verify instance Handle is queryable
      const instanceData = result.instance.dataSource.query({});
      expect(Array.isArray(instanceData)).toBe(true);
      expect(instanceData.length).toBe(2);
    });
    
    it('should maintain Handle semantics throughout introspection chain', () => {
      const introspection = new IntrospectionHandle(userHandle);
      
      // Get complete introspection
      const result = introspection.query({ type: 'complete' });
      
      // Verify all Handles have handleType property
      expect(result.prototype.handleType).toBe('MetaHandle');
      expect(result.schema.handleType).toBe('SchemaHandle');
      expect(result.instance.handleType).toBe('Handle');
      expect(introspection.handleType).toBe('IntrospectionHandle');
    });
  });
  
  describe('Introspection with Different Handle Types', () => {
    it('should introspect IntrospectionHandle itself (meta-circularity)', () => {
      // Create first-level introspection
      const introspection1 = new IntrospectionHandle(userHandle);
      
      // Create second-level introspection (introspecting the IntrospectionHandle)
      const introspection2 = new IntrospectionHandle(introspection1);
      
      // Query complete introspection of IntrospectionHandle
      const result = introspection2.query({ type: 'complete' });
      
      // Verify we can introspect IntrospectionHandle
      expect(result.prototype).toBeInstanceOf(MetaHandle);
      expect(result.schema).toBeInstanceOf(SchemaHandle);
      expect(result.instance).toBe(introspection1);
      
      // Verify the prototype is for IntrospectionHandle class
      const prototypeMembers = result.prototype.query({ type: 'prototype-members' });
      expect(prototypeMembers.methods).toBeDefined();
      
      // IntrospectionHandle should have specialized methods
      const methodNames = prototypeMembers.methods.map(m => m.name || m);
      expect(methodNames).toContain('query');
      expect(methodNames).toContain('subscribe');
    });
    
    it('should introspect MetaHandle', () => {
      const introspection1 = new IntrospectionHandle(userHandle);
      const metaHandle = introspection1.query({ type: 'prototype' });
      
      // Introspect the MetaHandle itself
      const introspection2 = new IntrospectionHandle(metaHandle);
      const result = introspection2.query({ type: 'complete' });
      
      // Verify MetaHandle introspection
      expect(result.prototype).toBeInstanceOf(MetaHandle);
      expect(result.instance).toBe(metaHandle);
      expect(result.instance.handleType).toBe('MetaHandle');
    });
    
    it('should introspect SchemaHandle', () => {
      const introspection1 = new IntrospectionHandle(userHandle);
      const schemaHandle = introspection1.query({ type: 'schema' });
      
      // Introspect the SchemaHandle itself
      const introspection2 = new IntrospectionHandle(schemaHandle);
      const result = introspection2.query({ type: 'complete' });
      
      // Verify SchemaHandle introspection
      expect(result.prototype).toBeInstanceOf(MetaHandle);
      expect(result.instance).toBe(schemaHandle);
      expect(result.instance.handleType).toBe('SchemaHandle');
    });
  });
  
  describe('Querying Individual Metadata Handles', () => {
    it('should query prototype Handle for method information', () => {
      const introspection = new IntrospectionHandle(userHandle);
      
      // Get prototype Handle
      const prototypeHandle = introspection.query({ type: 'prototype' });
      
      // Query for specific method information
      const prototypeMembers = prototypeHandle.query({ type: 'prototype-members' });
      expect(prototypeMembers.methods).toBeDefined();
      expect(Array.isArray(prototypeMembers.methods)).toBe(true);
      
      // Verify Handle has standard methods
      const methodNames = prototypeMembers.methods.map(m => m.name || m);
      expect(methodNames).toContain('query');
      expect(methodNames).toContain('subscribe');
      expect(methodNames).toContain('destroy');
      
      // Query for inheritance chain
      const inheritanceChain = prototypeHandle.query({ type: 'inheritance-chain' });
      expect(Array.isArray(inheritanceChain)).toBe(true);
      expect(inheritanceChain.length).toBeGreaterThan(0);
      
      // Should include Handle in the chain
      const chainNames = inheritanceChain.map(c => c.name);
      expect(chainNames).toContain('Handle');
    });
    
    it('should query schema Handle for structure information', () => {
      const introspection = new IntrospectionHandle(userHandle);
      
      // Get schema Handle
      const schemaHandle = introspection.query({ type: 'schema' });
      
      // Query for schema metadata
      const metadata = schemaHandle.query({ type: 'schema-metadata' });
      expect(metadata).toBeDefined();
      expect(typeof metadata).toBe('object');
      
      // Query for schema type
      const schemaType = schemaHandle.query({ type: 'schema-type' });
      expect(schemaType).toBeDefined();
      
      // SchemaHandle should provide comprehensive schema information
      expect(schemaHandle).toBeInstanceOf(SchemaHandle);
    });
    
    it('should query capabilities for operation metadata', () => {
      const introspection = new IntrospectionHandle(userHandle);
      
      // Get capabilities
      const capabilities = introspection.query({ type: 'capabilities' });
      
      // Verify capabilities structure
      expect(capabilities).toBeDefined();
      expect(capabilities.operations).toBeDefined();
      expect(Array.isArray(capabilities.operations)).toBe(true);
      
      // Verify standard operations
      expect(capabilities.operations).toContain('query');
      expect(capabilities.operations).toContain('subscribe');
      expect(capabilities.operations).toContain('update');
      
      // Verify capability flags
      expect(capabilities.isQueryable).toBe(true);
      expect(capabilities.isSubscribable).toBe(true);
      expect(capabilities.isUpdatable).toBe(true);
    });
  });
  
  describe('LLM Format Generation', () => {
    it('should generate complete LLM format for complex Handle', () => {
      const introspection = new IntrospectionHandle(userHandle);
      
      // Generate LLM format
      const llmFormat = introspection.query({ type: 'llm-format' });
      
      // Verify structure matches design specification
      expect(llmFormat).toBeDefined();
      expect(llmFormat.resource).toBeDefined();
      expect(llmFormat.prototype).toBeDefined();
      expect(llmFormat.schema).toBeDefined();
      expect(llmFormat.capabilities).toBeDefined();
      
      // Verify resource information
      expect(llmFormat.resource.type).toBe('Handle');
      expect(llmFormat.resource.handleType).toBe('Handle');
      
      // Verify prototype information
      expect(llmFormat.prototype.type).toBe('MetaHandle');
      expect(llmFormat.prototype.name).toBeDefined();
      expect(Array.isArray(llmFormat.prototype.methods)).toBe(true);
      expect(llmFormat.prototype.methods.length).toBeGreaterThan(0);
      expect(Array.isArray(llmFormat.prototype.inheritanceChain)).toBe(true);
      
      // Verify schema information
      expect(llmFormat.schema.type).toBe('SchemaHandle');
      expect(llmFormat.schema.attributes).toBeDefined();
      
      // Verify capabilities information
      expect(llmFormat.capabilities.type).toBe('CapabilityInfo');
      expect(Array.isArray(llmFormat.capabilities.operations)).toBe(true);
      expect(llmFormat.capabilities.isQueryable).toBe(true);
      expect(llmFormat.capabilities.isSubscribable).toBe(true);
    });
    
    it('should generate LLM format suitable for planning', () => {
      const introspection = new IntrospectionHandle(userHandle);
      const llmFormat = introspection.query({ type: 'llm-format' });
      
      // Verify format is serializable (suitable for LLM input)
      expect(() => JSON.stringify(llmFormat)).not.toThrow();
      
      // Verify format contains useful information for planning
      const json = JSON.stringify(llmFormat);
      expect(json).toContain('Handle');
      expect(json).toContain('query');
      expect(json).toContain('subscribe');
      
      // Should not contain circular references
      const parsed = JSON.parse(json);
      expect(parsed).toBeDefined();
      expect(parsed.resource).toBeDefined();
      expect(parsed.prototype).toBeDefined();
      expect(parsed.schema).toBeDefined();
      expect(parsed.capabilities).toBeDefined();
    });
  });
  
  describe('Subscription Integration', () => {
    it('should support subscriptions to introspection changes', () => {
      const introspection = new IntrospectionHandle(userHandle);
      const events = [];
      
      // Subscribe to introspection changes
      const subscription = introspection.subscribe(
        { id: 3 },
        (event) => events.push(event)
      );
      
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
      
      // Trigger change in underlying data
      dataSource.addData({ id: 3, name: 'Charlie', email: 'charlie@example.com', age: 35 });
      
      // Should receive notification
      expect(events.length).toBeGreaterThan(0);
      
      // Clean up
      subscription.unsubscribe();
    });
    
    it('should notify when metadata Handles are queried after data changes', () => {
      const introspection = new IntrospectionHandle(userHandle);
      
      // Get initial metadata
      const result1 = introspection.query({ type: 'complete' });
      const schemaHandle1 = result1.schema;
      
      // Add data that might affect schema inference
      dataSource.addData({ id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'admin' });
      
      // Get metadata again
      const result2 = introspection.query({ type: 'complete' });
      const schemaHandle2 = result2.schema;
      
      // Schema Handle should be cached (same instance)
      expect(schemaHandle2).toBe(schemaHandle1);
      
      // But querying it should reflect updated data
      const metadata = schemaHandle2.query({ type: 'schema-metadata' });
      expect(metadata).toBeDefined();
    });
  });
  
  describe('Handle Lifecycle Integration', () => {
    it('should handle destruction properly', () => {
      const introspection = new IntrospectionHandle(userHandle);
      
      // Get metadata Handles
      const result = introspection.query({ type: 'complete' });
      expect(result.prototype).toBeInstanceOf(MetaHandle);
      expect(result.schema).toBeInstanceOf(SchemaHandle);
      
      // Destroy IntrospectionHandle
      introspection.destroy();
      
      // Should not be able to query after destruction
      expect(() => {
        introspection.query({ type: 'complete' });
      }).toThrow();
    });
    
    it('should clean up cached Handles on destruction', () => {
      const introspection = new IntrospectionHandle(userHandle);
      
      // Create cached Handles
      introspection.query({ type: 'prototype' });
      introspection.query({ type: 'schema' });
      
      // Verify caches are populated
      expect(introspection._prototypeHandle).toBeDefined();
      expect(introspection._schemaHandle).toBeDefined();
      
      // Destroy
      introspection.destroy();
      
      // Caches should be cleared
      expect(introspection._prototypeHandle).toBeNull();
      expect(introspection._schemaHandle).toBeNull();
      expect(introspection._targetHandle).toBeNull();
    });
  });
  
  describe('Real-World Usage Scenarios', () => {
    it('should support debugging workflow: inspect Handle, query capabilities, test operations', () => {
      // Scenario: Developer wants to understand what operations a Handle supports
      
      // 1. Create introspection
      const introspection = new IntrospectionHandle(userHandle);
      
      // 2. Get capabilities to see what's available
      const capabilities = introspection.query({ type: 'capabilities' });
      expect(capabilities.operations).toContain('query');
      expect(capabilities.operations).toContain('update');
      
      // 3. Get schema to understand data structure
      const schemaHandle = introspection.query({ type: 'schema' });
      const schemaMetadata = schemaHandle.query({ type: 'schema-metadata' });
      expect(schemaMetadata).toBeDefined();
      
      // 4. Get prototype to see available methods
      const prototypeHandle = introspection.query({ type: 'prototype' });
      const members = prototypeHandle.query({ type: 'prototype-members' });
      expect(members.methods.length).toBeGreaterThan(0);
      
      // 5. Now developer knows how to use the Handle
      expect(capabilities.isQueryable).toBe(true);
      expect(capabilities.isUpdatable).toBe(true);
    });
    
    it('should support LLM planning workflow: generate format, pass to LLM, execute plan', () => {
      // Scenario: LLM needs to understand Handle capabilities to generate a plan
      
      // 1. Create introspection
      const introspection = new IntrospectionHandle(userHandle);
      
      // 2. Generate LLM format
      const llmFormat = introspection.query({ type: 'llm-format' });
      
      // 3. Verify format has everything LLM needs
      expect(llmFormat.capabilities.operations).toBeDefined();
      expect(llmFormat.prototype.methods).toBeDefined();
      expect(llmFormat.schema.attributes).toBeDefined();
      
      // 4. Format is JSON-serializable for LLM input
      const json = JSON.stringify(llmFormat);
      expect(json.length).toBeGreaterThan(0);
      
      // 5. LLM can determine Handle supports query and update operations
      expect(llmFormat.capabilities.isQueryable).toBe(true);
      expect(llmFormat.capabilities.isUpdatable).toBe(true);
    });
  });
});