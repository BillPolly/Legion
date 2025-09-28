/**
 * IntrospectionHandle - Unified introspection interface that returns Handles for all metadata
 * 
 * Provides a single entry point for complete introspection of Handle instances.
 * All returned introspection data are Handles, maintaining the meta-circular property.
 * 
 * Key Features:
 * - Returns MetaHandle for prototype information
 * - Returns SchemaHandle for schema information  
 * - Returns capabilities object for operation metadata
 * - Generates LLM-friendly format
 * - Supports subscription to introspection changes
 * 
 * CRITICAL: All operations are synchronous - NO await, NO promises!
 */

import { Handle } from '../Handle.js';
import { MetaHandle } from './MetaHandle.js';
import { SchemaHandle } from './SchemaHandle.js';
import { SimpleObjectDataSource } from '../SimpleObjectDataSource.js';

export class IntrospectionHandle extends Handle {
  /**
   * Create an IntrospectionHandle for a target Handle
   * 
   * @param {Handle} targetHandle - The Handle to introspect
   */
  constructor(targetHandle) {
    // Create a DataSource for the IntrospectionHandle itself
    const introspectionDataSource = new SimpleObjectDataSource();
    super(introspectionDataSource);
    
    if (!targetHandle) {
      throw new Error('Target Handle is required for introspection');
    }
    
    if (!(targetHandle instanceof Handle)) {
      throw new Error('Target must be a Handle instance');
    }
    
    // Store reference to the Handle being introspected
    this._targetHandle = targetHandle;
    
    // Lazily created Handles for metadata (cached)
    this._prototypeHandle = null;
    this._schemaHandle = null;
    this._capabilitiesCache = null;
  }
  
  /**
   * Query introspection information
   * CRITICAL: Synchronous - no await!
   * 
   * @param {Object} querySpec - Query specification
   * @returns {*} Query results (always Handles for metadata)
   */
  query(querySpec) {
    this._validateNotDestroyed();
    
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    const { type } = querySpec;
    
    switch (type) {
      case 'complete':
        // Return all introspection data as Handles
        return this._getCompleteIntrospection();
        
      case 'prototype':
        // Return MetaHandle for prototype
        return this._getPrototypeHandle();
        
      case 'schema':
        // Return SchemaHandle for schema
        return this._getSchemaHandle();
        
      case 'capabilities':
        // Return capabilities object
        return this._getCapabilities();
        
      case 'instance':
        // Return the original Handle instance
        return this._targetHandle;
        
      case 'llm-format':
        // Return LLM-friendly format
        return this._generateLLMFormat();
        
      default:
        throw new Error(`Unknown introspection query type: ${type}`);
    }
  }
  
  /**
   * Subscribe to introspection changes
   * CRITICAL: Synchronous setup - callbacks invoked when changes occur
   * 
   * @param {Object} querySpec - Subscription query
   * @param {Function} callback - Change notification callback
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribe(querySpec, callback) {
    this._validateNotDestroyed();
    
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }
    
    // Subscribe to changes in the target Handle's DataSource
    // This will notify when the underlying data changes
    const targetSubscription = this._targetHandle.dataSource.subscribe(
      querySpec,
      (change) => {
        // Wrap change with introspection context
        callback({
          type: 'introspection-change',
          target: this._targetHandle,
          change,
          timestamp: Date.now()
        });
      }
    );
    
    // Return subscription that cleans up properly
    return {
      id: targetSubscription.id,
      unsubscribe: () => {
        targetSubscription.unsubscribe();
      }
    };
  }
  
  // Private implementation methods
  
  /**
   * Get complete introspection data (all metadata as Handles)
   * @private
   */
  _getCompleteIntrospection() {
    return {
      prototype: this._getPrototypeHandle(),
      schema: this._getSchemaHandle(),
      capabilities: this._getCapabilities(),
      instance: this._targetHandle
    };
  }
  
  /**
   * Get or create MetaHandle for the target's prototype
   * @private
   */
  _getPrototypeHandle() {
    // Lazily create and cache MetaHandle
    if (!this._prototypeHandle) {
      // Get the prototype of the target Handle
      const TargetClass = this._targetHandle.constructor;
      
      // Create a DataSource for the MetaHandle
      const metaDataSource = new SimpleObjectDataSource();
      
      // Wrap prototype as MetaHandle
      this._prototypeHandle = new MetaHandle(metaDataSource, TargetClass);
    }
    
    return this._prototypeHandle;
  }
  
  /**
   * Get or create SchemaHandle for the target's schema
   * @private
   */
  _getSchemaHandle() {
    // Lazily create and cache SchemaHandle
    if (!this._schemaHandle) {
      // Get schema from target Handle's DataSource
      const schema = this._targetHandle.dataSource.getSchema();
      
      // Create a DataSource for the SchemaHandle
      const schemaDataSource = new SimpleObjectDataSource();
      
      // Wrap schema as SchemaHandle
      this._schemaHandle = new SchemaHandle(schemaDataSource, schema);
    }
    
    return this._schemaHandle;
  }
  
  /**
   * Get capabilities of the target Handle
   * @private
   */
  _getCapabilities() {
    // Lazily compute and cache capabilities
    if (!this._capabilitiesCache) {
      const operations = ['query', 'subscribe'];
      
      // Check if DataSource supports update
      if (typeof this._targetHandle.dataSource.update === 'function') {
        operations.push('update');
      }
      
      // Check for other optional operations
      if (typeof this._targetHandle.destroy === 'function') {
        operations.push('destroy');
      }
      
      if (typeof this._targetHandle.value === 'function') {
        operations.push('value');
      }
      
      this._capabilitiesCache = {
        operations,
        isQueryable: true,
        isSubscribable: true,
        isUpdatable: operations.includes('update'),
        hasSchema: true,
        hasPrototype: true
      };
    }
    
    return this._capabilitiesCache;
  }
  
  /**
   * Generate LLM-friendly format of all introspection data
   * @private
   */
  _generateLLMFormat() {
    // Get all metadata
    const prototypeHandle = this._getPrototypeHandle();
    const schemaHandle = this._getSchemaHandle();
    const capabilities = this._getCapabilities();
    
    // Query metadata for LLM format
    const prototypeMembers = prototypeHandle.query({ type: 'prototype-members' });
    
    // Get schema structure - SchemaHandle uses 'schema-metadata' not 'attributes'
    const schemaMetadata = schemaHandle.query({ type: 'schema-metadata' });
    
    return {
      resource: {
        type: 'Handle',
        handleType: this._targetHandle.constructor.name,
        metadata: this._targetHandle.metadata || {}
      },
      prototype: {
        type: 'MetaHandle',
        name: prototypeHandle.getTypeName(),
        methods: prototypeMembers.methods.map(m => m.name || m),
        properties: prototypeMembers.properties.map(p => p.name || p),
        inheritanceChain: prototypeHandle.query({ type: 'inheritance-chain' })
          .map(c => c.name)
      },
      schema: {
        type: 'SchemaHandle',
        attributes: schemaMetadata,
        relationships: schemaHandle.query({ type: 'relationships' }),
        constraints: schemaHandle.query({ type: 'constraints' })
      },
      capabilities: {
        type: 'CapabilityInfo',
        operations: capabilities.operations,
        isQueryable: capabilities.isQueryable,
        isSubscribable: capabilities.isSubscribable,
        isUpdatable: capabilities.isUpdatable
      }
    };
  }
  
  /**
   * Clean up IntrospectionHandle resources
   */
  destroy() {
    // Clear cached Handles
    if (this._prototypeHandle) {
      this._prototypeHandle.destroy();
      this._prototypeHandle = null;
    }
    
    if (this._schemaHandle) {
      this._schemaHandle.destroy();
      this._schemaHandle = null;
    }
    
    this._capabilitiesCache = null;
    this._targetHandle = null;
    
    // Call parent cleanup
    super.destroy();
  }
}