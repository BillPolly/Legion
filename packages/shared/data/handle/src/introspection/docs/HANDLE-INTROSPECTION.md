# Handle Introspection System: Self-Describing Prototypes Design

## Executive Summary

This document describes the design of a universal introspection system where Handle prototypes themselves are Handles, creating a fully reflexive, self-describing system. Every element - resources, prototypes, schemas, and metadata - follows the same Handle pattern, enabling complete system introspection and modification through a unified interface.

## Core Concept

The fundamental innovation is making Handle prototypes themselves be Handles. This creates true meta-circularity where:
- Prototypes are queryable and updatable through the Handle interface
- Schemas that describe types are Handles
- The factory that creates prototypes is a Handle
- All metadata and introspection data are Handles

## Architecture Overview

### Three Layers of Handles

```
┌─────────────────────────────────────┐
│         Meta Layer                  │
│  (Prototypes as Handles)            │
│  - MetaHandle                       │
│  - PrototypeHandle                  │
│  - SchemaHandle                     │
└─────────────────────────────────────┘
           ↓ creates
┌─────────────────────────────────────┐
│       Instance Layer                │
│  (Regular Handle Instances)         │
│  - UserHandle                       │
│  - DocumentHandle                   │
│  - CollectionHandle                 │
└─────────────────────────────────────┘
           ↓ projects
┌─────────────────────────────────────┐
│       Resource Layer                │
│  (Actual Resources)                 │
│  - MongoDB Documents                │
│  - File System Objects              │
│  - API Endpoints                    │
└─────────────────────────────────────┘
```

## Core Components

### 1. MetaHandle

A Handle whose value IS a prototype/class, making prototypes queryable and introspectable.

```javascript
class MetaHandle extends Handle {
  constructor(resourceManager, PrototypeClass)
  
  // Core Handle methods
  query(querySpec)     // Query prototype members, inheritance chain
  update(updateSpec)   // Add/modify prototype methods and properties
  subscribe(querySpec, callback)  // Watch prototype changes
  
  // MetaHandle specific
  createInstance(...args)  // Manufacture instances from this prototype
  getIntrospectionInfo()   // Complete prototype metadata
}
```

**Key Capabilities:**
- Query prototype members (methods, properties, descriptors)
- Dynamically add methods to prototypes at runtime
- Modify property descriptors
- Track all instances (via WeakSet)
- Subscribe to prototype modifications

### 2. SelfDescribingPrototypeFactory

Factory that creates MetaHandles for prototypes and is itself a Handle.

```javascript
class SelfDescribingPrototypeFactory {
  constructor(resourceManager)
  
  createPrototype(typeName, baseClass)  // Returns MetaHandle
  getPrototypeHandle(typeName)          // Get existing MetaHandle
  asHandle()                             // Factory itself as Handle
}
```

**Key Features:**
- Creates prototypes wrapped as MetaHandles
- Maintains registry of all prototype handles
- Factory is queryable/updatable as a Handle

### 3. SchemaHandle

Makes schemas themselves queryable and updatable Handles.

```javascript
class SchemaHandle extends Handle {
  constructor(resourceManager, schema)
  
  query(querySpec)    // Query schema structure, types, constraints
  update(updateSpec)  // Modify schema definitions
  validate(data)      // Use schema for validation
}
```

### 4. IntrospectionHandle

Unified introspection that returns Handles for all metadata.

```javascript
class IntrospectionHandle extends Handle {
  query(querySpec) {
    // Returns Handles, not plain data
    return {
      prototype: new MetaHandle(...),
      schema: new SchemaHandle(...),
      capabilities: new CapabilityHandle(...)
    }
  }
}
```

## Query Patterns

### Querying Prototypes

```javascript
// Get all methods of a prototype
prototypeHandle.query({ 
  type: 'prototype-members',
  filter: 'methods' 
})

// Get inheritance chain
prototypeHandle.query({ 
  type: 'inheritance-chain' 
})

// Get all instances (if tracked)
prototypeHandle.query({ 
  type: 'instances' 
})
```

### Querying Schemas

```javascript
// Get all entity types
schemaHandle.query({ 
  type: 'entity-types' 
})

// Get relationships for a type
schemaHandle.query({ 
  type: 'relationships',
  entityType: 'User' 
})

// Get validation rules
schemaHandle.query({ 
  type: 'constraints',
  entityType: 'User' 
})
```

### Querying the Factory

```javascript
// List all registered prototypes
factoryHandle.query({ 
  type: 'list-prototypes' 
})

// Get specific prototype handle
factoryHandle.query({ 
  type: 'get-prototype',
  typeName: 'User' 
})
```

## Update Patterns

### Updating Prototypes

```javascript
// Add new method to prototype
prototypeHandle.update({
  type: 'add-method',
  name: 'newMethod',
  method: function() { ... }
})

// Modify property descriptor
prototypeHandle.update({
  type: 'modify-property',
  name: 'propertyName',
  descriptor: { enumerable: false, ... }
})
```

### Updating Schemas

```javascript
// Add new entity type
schemaHandle.update({
  type: 'add-entity-type',
  typeName: 'Product',
  attributes: { ... }
})

// Add relationship
schemaHandle.update({
  type: 'add-relationship',
  source: 'User',
  target: 'Product',
  relationship: 'owns'
})
```

## Subscription Patterns

```javascript
// Subscribe to prototype changes
prototypeHandle.subscribe(
  { type: 'prototype-changes' },
  (change) => {
    console.log(`Prototype modified: ${change.property}`)
  }
)

// Subscribe to schema changes
schemaHandle.subscribe(
  { type: 'schema-changes' },
  (change) => {
    console.log(`Schema modified: ${change.type}`)
  }
)

// Subscribe to new prototype creation
factoryHandle.subscribe(
  { type: 'prototype-created' },
  (event) => {
    console.log(`New prototype: ${event.typeName}`)
  }
)
```

## Introspection Format for LLMs

The system provides a unified format for LLM consumption:

```javascript
{
  "resource": {
    "type": "Handle",
    "entityType": "User",
    "id": "123"
  },
  "prototype": {
    "type": "MetaHandle",
    "name": "UserHandle",
    "methods": ["get", "set", "validate", ...],
    "properties": ["id", "name", "email", ...],
    "relationships": ["belongsTo", "hasMany", ...]
  },
  "schema": {
    "type": "SchemaHandle",
    "attributes": {
      "name": { "type": "string", "required": true },
      "email": { "type": "string", "format": "email" }
    },
    "relationships": {
      "organization": { "type": "belongsTo", "target": "Organization" }
    }
  },
  "capabilities": {
    "type": "CapabilityHandle",
    "operations": ["read", "write", "delete", "subscribe"],
    "constraints": ["unique:email", "required:name"]
  }
}
```

## Usage Examples

### Creating a Self-Describing System

```javascript
// Initialize the system
const factory = new SelfDescribingPrototypeFactory(resourceManager);
const factoryHandle = factory.asHandle();

// Create a prototype - returns a MetaHandle
const userPrototypeHandle = factoryHandle.update({
  type: 'create-prototype',
  typeName: 'User',
  baseClass: Handle
});

// Create an instance from the prototype handle
const userInstance = userPrototypeHandle.createInstance(
  resourceManager, 
  { id: 1 }
);

// Query the prototype through the instance
const prototypeInfo = userInstance.queryPrototype({
  type: 'prototype-members'
});

// Dynamically extend the prototype
userPrototypeHandle.update({
  type: 'add-method',
  name: 'calculateAge',
  method: function() { 
    return new Date().getFullYear() - this.birthYear; 
  }
});

// All instances immediately have the new method
console.log(userInstance.calculateAge());
```

### Complete Introspection

```javascript
// Get complete introspection as Handles
const introspection = new IntrospectionHandle(userInstance);

const info = introspection.query({ type: 'complete' });
// Returns:
{
  prototype: MetaHandle { ... },    // Handle to the prototype
  schema: SchemaHandle { ... },     // Handle to the schema
  instance: Handle { ... },         // The instance itself
  capabilities: Handle { ... }      // Handle to capabilities
}

// Each piece is independently queryable
const methods = info.prototype.query({ type: 'methods' });
const constraints = info.schema.query({ type: 'constraints' });
```

## Integration Points

### With Existing Handle System

The MetaHandle and related classes extend the base Handle class, maintaining full compatibility:

```javascript
class MetaHandle extends Handle {
  // Inherits all Handle functionality
  // Adds prototype-specific capabilities
}
```

### With ResourceManager

ResourceManagers provide schemas that are automatically wrapped as SchemaHandles:

```javascript
class ResourceManager {
  getSchema() {
    const rawSchema = this.loadSchema();
    return new SchemaHandle(this, rawSchema);
  }
}
```

### With PrototypeFactory

The existing PrototypeFactory is enhanced to return MetaHandles:

```javascript
class PrototypeFactory {
  getEntityPrototype(typeName, baseClass) {
    const TypedPrototype = this.createPrototype(...);
    return new MetaHandle(this.resourceManager, TypedPrototype);
  }
}
```

## Benefits

### 1. Complete Reflexivity
The system can fully examine and modify itself at runtime.

### 2. Unified Interface
Everything uses the same Handle query/update/subscribe pattern.

### 3. Dynamic Evolution
Prototypes can evolve at runtime, affecting all instances.

### 4. LLM-Friendly
Provides structured, queryable metadata perfect for LLM planning.

### 5. True Meta-Circularity
The factory that creates prototypes is itself a Handle.

## Implementation Guidelines

### Base Classes Required

1. **MetaHandle** - Extends Handle to wrap prototypes
2. **SchemaHandle** - Extends Handle to wrap schemas
3. **IntrospectionHandle** - Extends Handle for unified introspection
4. **SelfDescribingPrototypeFactory** - Creates and manages MetaHandles

### Key Principles

1. **Everything is a Handle** - No exceptions
2. **Synchronous Operations** - All Handle operations are synchronous
3. **Lazy Evaluation** - Only compute when queried
4. **Immutable Schemas** - Schema updates create new versions
5. **Weak References** - Use WeakSet/WeakMap for instance tracking

### Critical Constraints

1. **No Promises in Core** - Handle interface is synchronous
2. **No Direct Access** - Everything goes through Handle interface
3. **Preserve Prototype Chain** - Wrapping doesn't break inheritance
4. **Maintain Performance** - Introspection shouldn't slow normal operations

## API Reference

### MetaHandle API

```typescript
class MetaHandle extends Handle {
  constructor(resourceManager: ResourceManager, PrototypeClass: Function)
  
  // Query prototype information
  query(querySpec: {
    type: 'prototype-members' | 'inheritance-chain' | 'instances'
  }): any
  
  // Modify prototype
  update(updateSpec: {
    type: 'add-method' | 'modify-property',
    name: string,
    method?: Function,
    descriptor?: PropertyDescriptor
  }): boolean
  
  // Watch prototype changes
  subscribe(querySpec: object, callback: Function): Function
  
  // Create instances
  createInstance(...args: any[]): Handle
  
  // Get introspection data
  getIntrospectionInfo(): object
}
```

### SchemaHandle API

```typescript
class SchemaHandle extends Handle {
  constructor(resourceManager: ResourceManager, schema: object)
  
  // Query schema information
  query(querySpec: {
    type: 'entity-types' | 'relationships' | 'constraints',
    entityType?: string
  }): any
  
  // Modify schema
  update(updateSpec: {
    type: 'add-entity-type' | 'add-relationship' | 'modify-constraint',
    // ... type-specific fields
  }): boolean
  
  // Validate data against schema
  validate(data: any): ValidationResult
}
```

### SelfDescribingPrototypeFactory API

```typescript
class SelfDescribingPrototypeFactory {
  constructor(resourceManager: ResourceManager)
  
  // Create prototype wrapped as MetaHandle
  createPrototype(typeName: string, baseClass?: Function): MetaHandle
  
  // Get existing prototype handle
  getPrototypeHandle(typeName: string): MetaHandle | undefined
  
  // Factory itself as Handle
  asHandle(): Handle
}
```

---

**Document Status**: Complete MVP Design
**Version**: 1.0
**Date**: 2025-01-27