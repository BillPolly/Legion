/**
 * ContextHandle - Handle implementation for ExecutionContext
 * 
 * Provides Handle interface for contexts, enabling:
 * - Fluent query API on context data
 * - Projections that create new Handle views
 * - Integration with universal Handle pattern
 */

import { Handle } from '@legion/handle';

export class ContextHandle extends Handle {
  constructor(contextResourceManager) {
    super(contextResourceManager);
    this.contextRM = contextResourceManager;
  }
  
  /**
   * Get current context value
   * SYNCHRONOUS - no await!
   */
  value() {
    return this.contextRM._getAllContextData();
  }
  
  /**
   * Execute query with this handle as context
   * SYNCHRONOUS - no await!
   */
  query(querySpec) {
    return this.contextRM.query(querySpec);
  }
  
  /**
   * Override where to create context-specific projections
   */
  where(predicate) {
    this._validateNotDestroyed();
    
    if (!predicate || typeof predicate !== 'function') {
      throw new Error('Where predicate function is required');
    }
    
    // Create a filtered context view
    return new FilteredContextHandle(this.contextRM, predicate);
  }
  
  /**
   * Override select to create transformed context views
   */
  select(mapper) {
    this._validateNotDestroyed();
    
    if (!mapper || typeof mapper !== 'function') {
      throw new Error('Select mapper function is required');
    }
    
    // Create a mapped context view
    return new MappedContextHandle(this.contextRM, mapper);
  }
  
  /**
   * Get a specific resource from context
   */
  resource(resourceName) {
    const resource = this.contextRM._queryPath(`resources.${resourceName}`);
    
    if (!resource) {
      throw new Error(`Resource not found: ${resourceName}`);
    }
    
    // If it's already a Handle, return it
    if (resource instanceof Handle) {
      return resource;
    }
    
    // Wrap non-Handle resources
    return new ResourceHandle(this.contextRM, resourceName, resource);
  }
  
  /**
   * Get data at a specific path
   */
  path(pathStr) {
    return new PathHandle(this.contextRM, pathStr);
  }
  
  /**
   * Subscribe to context changes
   */
  onChange(callback) {
    return this.subscribe({ all: true }, callback);
  }
}

/**
 * FilteredContextHandle - Handle for filtered context views
 */
class FilteredContextHandle extends ContextHandle {
  constructor(contextResourceManager, predicate) {
    super(contextResourceManager);
    this.predicate = predicate;
  }
  
  value() {
    const data = this.contextRM._getAllContextData();
    const entries = Object.entries(data);
    const filtered = {};
    
    for (const [key, value] of entries) {
      if (this.predicate(value, key)) {
        filtered[key] = value;
      }
    }
    
    return filtered;
  }
  
  query(querySpec) {
    // Apply filter before query
    const filtered = this.value();
    
    // Execute query on filtered data
    if (querySpec.path) {
      const parts = querySpec.path.split('.');
      let current = filtered;
      
      for (const part of parts) {
        if (current === null || current === undefined) {
          return undefined;
        }
        current = current[part];
      }
      
      return current;
    }
    
    return filtered;
  }
}

/**
 * MappedContextHandle - Handle for transformed context views
 */
class MappedContextHandle extends ContextHandle {
  constructor(contextResourceManager, mapper) {
    super(contextResourceManager);
    this.mapper = mapper;
  }
  
  value() {
    const data = this.contextRM._getAllContextData();
    const entries = Object.entries(data);
    const mapped = {};
    
    for (const [key, value] of entries) {
      const mappedValue = this.mapper(value, key);
      if (mappedValue !== undefined) {
        mapped[key] = mappedValue;
      }
    }
    
    return mapped;
  }
  
  query(querySpec) {
    // Apply mapping before query
    const mapped = this.value();
    
    // Execute query on mapped data
    if (querySpec.path) {
      const parts = querySpec.path.split('.');
      let current = mapped;
      
      for (const part of parts) {
        if (current === null || current === undefined) {
          return undefined;
        }
        current = current[part];
      }
      
      return current;
    }
    
    return mapped;
  }
}

/**
 * PathHandle - Handle for specific path in context
 */
class PathHandle extends Handle {
  constructor(contextResourceManager, path) {
    super(contextResourceManager);
    this.contextRM = contextResourceManager;
    this.path = path;
  }
  
  value() {
    return this.contextRM._queryPath(this.path);
  }
  
  query(querySpec) {
    const value = this.value();
    
    // If value is queryable, delegate to it
    if (value && typeof value.query === 'function') {
      return value.query(querySpec);
    }
    
    // Otherwise apply query to value
    if (querySpec.path) {
      const parts = querySpec.path.split('.');
      let current = value;
      
      for (const part of parts) {
        if (current === null || current === undefined) {
          return undefined;
        }
        current = current[part];
      }
      
      return current;
    }
    
    return value;
  }
  
  /**
   * Update value at this path
   */
  set(value) {
    return this.contextRM.update({
      path: this.path,
      value
    });
  }
  
  /**
   * Merge value at this path
   */
  merge(value) {
    const existing = this.value() || {};
    return this.set({ ...existing, ...value });
  }
  
  /**
   * Push to array at this path
   */
  push(value) {
    const array = this.value() || [];
    if (!Array.isArray(array)) {
      throw new Error(`Path ${this.path} is not an array`);
    }
    array.push(value);
    return this.set(array);
  }
}

/**
 * ResourceHandle - Handle for context resources
 * This is a thin wrapper that delegates to the underlying resource handle
 */
class ResourceHandle extends Handle {
  constructor(contextResourceManager, resourceName, resource) {
    super(contextResourceManager);
    this.contextRM = contextResourceManager;
    this.resourceName = resourceName;
    this.resource = resource;
  }
  
  value() {
    // Return the resource handle itself, not its value
    // The test can then call .value() on the resource if needed
    return this.resource;
  }
  
  query(querySpec) {
    // If resource is queryable, delegate to it
    if (this.resource && typeof this.resource.query === 'function') {
      return this.resource.query(querySpec);
    }
    
    // Otherwise treat as data
    if (querySpec.path) {
      const parts = querySpec.path.split('.');
      let current = this.resource;
      
      for (const part of parts) {
        if (current === null || current === undefined) {
          return undefined;
        }
        current = current[part];
      }
      
      return current;
    }
    
    return this.resource;
  }
  
  /**
   * Execute method on resource if available
   */
  execute(methodName, ...args) {
    if (typeof this.resource[methodName] === 'function') {
      return this.resource[methodName](...args);
    }
    
    throw new Error(`Resource ${this.resourceName} does not have method: ${methodName}`);
  }
  
  /**
   * Update resource in context
   */
  update(updateSpec) {
    if (this.resource && typeof this.resource.update === 'function') {
      // Resource handles its own updates
      return this.resource.update(updateSpec);
    }
    
    // Update resource value in context
    return this.contextRM.update({
      path: `resources.${this.resourceName}`,
      value: updateSpec.value || updateSpec
    });
  }
}