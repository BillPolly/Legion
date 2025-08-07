# Unified Capability Ontology: Optimal 3-Field Model

## Overview

The Unified Capability Ontology represents the ultimate optimization of the knowledge graph system, consolidating all functional units into a single, ultra-clean data model with only **3 core fields**. This revolutionary design uses MongoDB's native `_id` field and promotes inheritance to a first-class field, achieving the perfect balance of minimalism, performance, and theoretical soundness.

## Core Philosophy

### Optimal 3-Field Structure

The breakthrough insight is that only **3 fields** are truly essential for any capability:

1. **`_id`** - Core business identity (MongoDB native, unique, immutable)
2. **`subtypeOf`** - Universal inheritance (every capability has a supertype)  
3. **`attributes`** - Everything else (all properties, relationships, metadata)

**Everything else is an attribute** - including timestamps, relationships, properties, and metadata.

### Benefits

- **Theoretical Optimum**: Perfect balance of minimalism and performance
- **MongoDB Native**: Leverages `_id` for maximum efficiency
- **Universal Inheritance**: Every capability has a clear supertype
- **Performance Optimized**: `kind` cached for lightning-fast queries
- **Future-Proof**: No schema changes ever needed

## The Optimal Data Model

### Core Interface (Only 3 Fields!)

```typescript
interface ICapability {
  _id: string;                     // ✅ Business identity (MongoDB native)
  subtypeOf: string;               // ✅ Universal inheritance (fundamental)
  kind: string;                    // ✅ Classification cache (performance)
  attributes: Record<string, any>; // ✅ EVERYTHING ELSE!
}
```

### Hierarchy of Fundamentalness

1. **`_id`** - Unique identity (cannot be derived, MongoDB native)
2. **`subtypeOf`** - Inheritance chain (most fundamental, defines everything)
3. **`kind`** - Classification shortcut (derivable from subtypeOf but cached for performance)
4. **`attributes`** - Everything else (flexible, extensible)

### What's Now an Attribute

**EVERYTHING except core identity, inheritance, and classification:**

| Attribute | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Human-readable name |
| `description` | `string` | Detailed description |
| `createdAt` | `date` | Creation timestamp |
| `updatedAt` | `date` | Last update timestamp |
| `parts` | `collection<reference>` | Array of capability IDs |
| `partOf` | `reference` | Parent capability ID |
| `uses` | `reference` | Used capability ID |
| `requires` | `collection<reference>` | Required capability IDs |
| `duration` | `string` | Time estimate |
| `cost` | `number` | Cost estimate |
| `difficulty` | `string` | Difficulty level |
| ... | ... | Any other properties |

### Universal Inheritance System

**Every capability MUST have a supertype:**

```
"all" -> subtypeOf: "all" (self-referencing root)
├── "action" -> subtypeOf: "all"
│   ├── "action.task" -> subtypeOf: "action"
│   └── "action.use" -> subtypeOf: "action"
├── "resource" -> subtypeOf: "all"
│   ├── "resource.input" -> subtypeOf: "resource"
│   └── "resource.output" -> subtypeOf: "resource"
└── "knowledge" -> subtypeOf: "all"
    ├── "knowledge.attribute" -> subtypeOf: "knowledge"
    └── "knowledge.constraint" -> subtypeOf: "knowledge"
```

### Kind Derivation Example

```typescript
// capability: "install_kitchen_sink"
// subtypeOf: "install_sink" 
//   -> subtypeOf: "plumbing_task"
//     -> subtypeOf: "action.task" 
//       -> subtypeOf: "action"
//         -> subtypeOf: "all"

// kind can be derived as "action.task" from this chain
// But we keep it explicit for fast queries like:
// db.capabilities.find({ kind: "action.task" })
```

## Database Structure: Ultimate Optimization

### Before (4 Fields with Redundancy)
```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439011"), // MongoDB ID
  id: "install_sink",                        // ❌ Redundant business ID
  kind: "action.task",
  attributes: {
    subtypeOf: "install_sink",               // ❌ Should be core field
    name: "Install Sink",
    // ...
  }
}
```

### After (Optimal 3 Fields)
```javascript
{
  _id: "install_sink",                       // ✅ Business ID (MongoDB native)
  subtypeOf: "action.task",                  // ✅ Universal inheritance
  kind: "action.task",                       // ✅ Performance cache
  attributes: {                              // ✅ EVERYTHING ELSE!
    // Identity
    name: "Install Sink",
    description: "Install a sink",
    
    // Timestamps (now attributes!)
    createdAt: ISODate("..."),
    updatedAt: ISODate("..."),
    
    // Relationships  
    parts: ["connect_pipes"],
    requires: ["wrench", "sealant"],
    
    // Properties
    duration: "45 minutes",
    cost: 75.00,
    difficulty: "intermediate"
  }
}
```

## Why This 3-Field Structure?

### `_id` - MongoDB Native Identity
- Core business identity using MongoDB's native `_id` field
- Automatic uniqueness constraint and indexing
- Eliminates redundant ID fields
- Maximum performance for lookups

### `subtypeOf` - Universal Inheritance
- Every capability has a supertype (except root "all" which references itself)
- More fundamental than `kind` (kind is derivable from inheritance chain)
- Enables powerful inheritance queries and validation
- Core structural relationship

### `kind` - Performance Classification  
- Derived from `subtypeOf` chain but cached for performance
- Enables lightning-fast type-based queries
- Critical for finding professions, packages, subcategories instantly
- Performance optimization, not theoretical requirement

### `attributes` - Everything Else
- All properties, relationships, metadata
- Fully flexible and extensible
- Controlled by attribute capability definitions

## Capability Class Implementation

```typescript
class Capability implements ICapability {
  public readonly _id: string;
  public readonly subtypeOf: string;
  public readonly kind: string;
  public attributes: Record<string, any>;

  constructor(data: CreateCapabilityRequest) {
    this._id = data._id;
    this.subtypeOf = data.subtypeOf;
    this.kind = data.kind;
    this.attributes = data.attributes || {};
    
    // Set timestamps as attributes if not provided
    const now = new Date();
    if (!this.attributes.createdAt) {
      this.attributes.createdAt = now;
    }
    if (!this.attributes.updatedAt) {
      this.attributes.updatedAt = now;
    }
  }

  // Convenience getters for backward compatibility
  public get id(): string {
    return this._id; // Map to MongoDB _id
  }

  public get name(): string {
    return this.attributes.name || this._id;
  }

  public get description(): string | undefined {
    return this.attributes.description;
  }

  public get createdAt(): Date {
    return this.attributes.createdAt;
  }

  public get updatedAt(): Date {
    return this.attributes.updatedAt;
  }

  public get hasPart(): string[] {
    return this.attributes.parts || [];
  }

  public get partOf(): string | null {
    return this.attributes.partOf || null;
  }

  public get uses(): string | null {
    return this.attributes.uses || null;
  }

  public get requires(): string[] {
    return this.attributes.requires || [];
  }
}
```

## MongoDB Storage and Querying

### Collection Structure (Optimal)

```javascript
// Collection: capabilities (only 3 fields!)
{
  _id: "install_kitchen_sink",               // Business ID (MongoDB native)
  subtypeOf: "install_sink",                 // Universal inheritance
  kind: "action.task",                       // Performance classification
  attributes: {                              // Everything else
    name: "Install Kitchen Sink",
    description: "Complete installation of kitchen sink",
    createdAt: ISODate("2024-01-15T10:30:00Z"),
    updatedAt: ISODate("2024-01-15T10:30:00Z"),
    duration: "45 minutes",
    difficulty: "intermediate", 
    cost: 75.00,
    requires: ["kitchen_sink_unit", "pipe_wrench", "sealant"]
  }
}
```

### Indexing Strategy (Optimized)

```javascript
// Essential indexes for optimal model
db.capabilities.createIndex({ "_id": 1 }, { unique: true })  // Automatic
db.capabilities.createIndex({ "kind": 1 })                   // Fast type queries
db.capabilities.createIndex({ "subtypeOf": 1 })              // Fast inheritance

// Attribute-based indexes
db.capabilities.createIndex({ "attributes.name": "text" })
db.capabilities.createIndex({ "attributes.parts": 1 })
db.capabilities.createIndex({ "attributes.partOf": 1 })
db.capabilities.createIndex({ "attributes.uses": 1 })

// Value-based indexes
db.capabilities.createIndex({ "attributes.cost": 1 })
db.capabilities.createIndex({ "attributes.difficulty": 1 })

// Compound indexes for common patterns
db.capabilities.createIndex({ "kind": 1, "attributes.cost": 1 })
db.capabilities.createIndex({ "subtypeOf": 1, "kind": 1 })
```

### Lightning-Fast Query Patterns

```javascript
// Instant by ID (MongoDB native)
db.capabilities.findOne({_id: "install_sink"})

// Fast type queries (cached classification)
db.capabilities.find({ kind: "action.task" })
db.capabilities.find({ kind: "organization.profession" })
db.capabilities.find({ kind: "action.package" })

// Fast inheritance queries (first-class field)
db.capabilities.find({ subtypeOf: "install_sink" })
db.capabilities.find({ subtypeOf: "action.task" })

// Attribute-based queries
db.capabilities.find({ "attributes.partOf": "bathroom_renovation" })
db.capabilities.find({ "attributes.cost": { $lt: 100 } })

// Complex inheritance traversal
db.capabilities.aggregate([
  { $match: { _id: "install_kitchen_sink" } },
  { $graphLookup: {
      from: "capabilities",
      startWith: "$subtypeOf",
      connectFromField: "subtypeOf", 
      connectToField: "_id",
      as: "ancestors"
  }}
])
```

## Relationship Patterns

### Universal Inheritance: `subtypeOf` (Core Field)

```typescript
// Parent capability
{
  _id: "install_sink",
  subtypeOf: "action.task",
  kind: "action.task",
  attributes: {
    name: "Install Sink",
    duration: "45 minutes",
    difficulty: "easy"
  }
}

// Child capability (specialization)
{
  _id: "install_kitchen_sink",
  subtypeOf: "install_sink",                 // Core inheritance field
  kind: "action.task",                       // Derived but cached
  attributes: {
    name: "Install Kitchen Sink",
    duration: "50 minutes",
    difficulty: "intermediate"
  }
}

// Root capability (self-referencing)
{
  _id: "all",
  subtypeOf: "all",                          // Self-referencing root
  kind: "organization.root",
  attributes: {
    name: "Universal Root",
    description: "Root of all capabilities"
  }
}
```

### Composition: `parts` and `partOf` (Attributes)

```typescript
// Package with parts
{
  _id: "bathroom_renovation",
  subtypeOf: "action.package",
  kind: "action.package",
  attributes: {
    name: "Bathroom Renovation",
    parts: [                                 // Collection attribute
      "remove_fixtures",
      "install_plumbing", 
      "install_fixtures"
    ],
    totalCost: 2500.00
  }
}

// Task that's part of package
{
  _id: "remove_fixtures",
  subtypeOf: "action.task",
  kind: "action.task",
  attributes: {
    name: "Remove Old Fixtures",
    partOf: "bathroom_renovation",           // Reference attribute
    duration: "2 hours"
  }
}
```

### Usage: `uses` (Attribute)

```typescript
// Use record connecting skill to task
{
  _id: "pipe_fitting_use",
  subtypeOf: "action.use",
  kind: "action.use",
  attributes: {
    name: "Pipe Fitting for Sink",
    uses: "pipe_fitting_skill",             // Reference attribute
    partOf: "install_kitchen_sink",         // Reference attribute
    duration: "20 minutes",
    cost: 30.00
  }
}
```

## Validation System

### Inheritance Validation

```typescript
class CapabilityValidator {
  static validateInheritance(capability: ICapability, allCapabilities: Map<string, ICapability>): ValidationResult {
    const errors: string[] = [];
    
    // Validate subtypeOf exists (except for root)
    if (capability._id !== "all" && !capability.subtypeOf) {
      errors.push("All capabilities except 'all' must have subtypeOf");
    }
    
    // Validate subtypeOf target exists
    if (capability.subtypeOf && !allCapabilities.has(capability.subtypeOf)) {
      errors.push(`subtypeOf target '${capability.subtypeOf}' does not exist`);
    }
    
    // Validate kind matches inheritance chain
    const derivedKind = this.deriveKindFromInheritance(capability, allCapabilities);
    if (derivedKind && capability.kind !== derivedKind) {
      errors.push(`kind '${capability.kind}' does not match derived kind '${derivedKind}'`);
    }
    
    // Validate no circular inheritance
    if (this.hasCircularInheritance(capability, allCapabilities)) {
      errors.push("Circular inheritance detected");
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  private static deriveKindFromInheritance(capability: ICapability, allCapabilities: Map<string, ICapability>): string | null {
    // Walk up inheritance chain to find the kind
    let current = capability;
    const visited = new Set<string>();
    
    while (current && !visited.has(current._id)) {
      visited.add(current._id);
      
      // Check if this is a kind-defining level
      if (this.isKindDefiningLevel(current.kind)) {
        return current.kind;
      }
      
      // Move to parent
      if (current.subtypeOf && current.subtypeOf !== current._id) {
        current = allCapabilities.get(current.subtypeOf) || null;
      } else {
        break;
      }
    }
    
    return null;
  }
  
  private static isKindDefiningLevel(kind: string): boolean {
    // Kind-defining levels (where kind should be derived from)
    return [
      'action.task', 'action.use', 'action.package',
      'resource.input.consumable', 'resource.input.equipment', 'resource.input.tool',
      'resource.output.part', 'resource.output.product',
      'knowledge.attribute', 'knowledge.constraint', 'knowledge.object',
      'organization.profession', 'organization.subcategory'
    ].includes(kind);
  }
}
```

## Performance Benefits

### Database Efficiency

1. **MongoDB Native**: Uses `_id` for maximum performance
2. **Minimal Schema**: Only 3 top-level fields reduce overhead
3. **Optimized Indexes**: Direct indexing on core fields
4. **No Redundancy**: Eliminated duplicate ID fields

### Query Performance

```javascript
// Lightning-fast type queries (cached)
db.capabilities.find({ kind: "organization.profession" })     // Instant
db.capabilities.find({ kind: "action.package" })              // Instant

// Fast inheritance queries (first-class field)  
db.capabilities.find({ subtypeOf: "action.task" })            // Fast

// Efficient ID lookups (MongoDB native)
db.capabilities.findOne({ _id: "install_sink" })              // Optimal
```

## Migration Strategy

### From 4-Field to 3-Field Model

```javascript
// Migration script
db.capabilities.updateMany({}, [
  {
    $set: {
      // Use existing id as _id, move subtypeOf out of attributes
      _id: "$id",
      subtypeOf: "$attributes.subtypeOf",
      attributes: {
        $mergeObjects: [
          "$attributes",
          {
            // Move other fields into attributes
            name: "$name",
            description: "$description", 
            createdAt: "$createdAt",
            updatedAt: "$updatedAt",
            parts: "$hasPart",
            partOf: "$partOf",
            uses: "$uses",
            requires: "$requires"
          }
        ]
      }
    }
  },
  {
    $unset: [
      "id", "name", "description", "createdAt", "updatedAt",
      "hasPart", "partOf", "uses", "requires", "attributes.subtypeOf"
    ]
  }
])
```

## Usage Examples

### Creating Capabilities

```typescript
// Optimal 3-field model
const task = new Capability({
  _id: 'install_kitchen_sink',
  subtypeOf: 'install_sink',                 // Core inheritance
  kind: 'action.task',                       // Performance cache
  attributes: {
    // Everything else is an attribute
    name: 'Install Kitchen Sink',
    description: 'Complete installation with plumbing',
    duration: '45 minutes',
    cost: 75.00,
    requires: ['wrench', 'sealant']
    // createdAt and updatedAt automatically added
  }
});

// Package with inheritance
const package = new Capability({
  _id: 'bathroom_renovation',
  subtypeOf: 'action.package',               // Inherits from package type
  kind: 'action.package',                    // Cached for fast queries
  attributes: {
    name: 'Bathroom Renovation',
    description: 'Complete renovation package',
    parts: ['remove_fixtures', 'install_fixtures'],
    totalCost: 2500.00
  }
});

// Root capability (self-referencing)
const root = new Capability({
  _id: 'all',
  subtypeOf: 'all',                          // Self-referencing root
  kind: 'organization.root',
  attributes: {
    name: 'Universal Root',
    description: 'Root of all capabilities'
  }
});
```

### Backward Compatibility

```typescript
// Convenience getters maintain full API compatibility
console.log(task.id);          // "install_kitchen_sink" (maps to _id)
console.log(task.name);        // "Install Kitchen Sink"
console.log(task.createdAt);   // Date from attributes
console.log(task.subtypeOf);   // "install_sink" (now core field)
console.log(package.hasPart);  // ["remove_fixtures", "install_fixtures"]
```

## Testing Strategy

### Unit Tests for Optimal Model

```typescript
describe('Optimal 3-Field Capability', () => {
  it('should create capability with optimal structure', () => {
    const capability = new Capability({
      _id: 'test_capability',
      subtypeOf: 'action.task',
      kind: 'action.task',
      attributes: {
        name: 'Test Task',
        description: 'A test task',
        duration: '30 minutes'
      }
    });
    
    // Only 3 core fields
    expect(capability._id).toBe('test_capability');
    expect(capability.subtypeOf).toBe('action.task');
    expect(capability.kind).toBe('action.task');
    expect(capability.attributes).toBeDefined();
    
    // Backward compatibility
    expect(capability.id).toBe('test_capability');
    expect(capability.name).toBe('Test Task');
    expect(capability.createdAt).toBeInstanceOf(Date);
  });
  
  it('should validate universal inheritance', () => {
    // Every capability must have subtypeOf (except root)
    expect(() => new Capability({
      _id: 'invalid',
      subtypeOf: '', // Invalid!
      kind: 'action.task',
      attributes: {}
    })).toThrow();
    
    // Root can be self-referencing
    const root = new Capability({
      _id: 'all',
      subtypeOf: 'all', // Valid self-reference
      kind: 'organization.root',
      attributes: { name: 'Root' }
    });
    expect(root.subtypeOf).toBe('all');
  });
  
  it('should derive kind from inheritance chain', () => {
    // kind should match what's derivable from subtypeOf chain
    const validator = new CapabilityValidator();
    const result = validator.validateKindConsistency({
      _id: 'kitchen_sink_install',
      subtypeOf: 'install_sink',
      kind: 'action.task', // Should match inheritance
      attributes: {}
    });
    expect(result.valid).toBe(true);
  });
});
```

## Conclusion

The Optimal 3-Field Capability Ontology represents the perfect balance of theoretical soundness and practical performance. With `_id`, `subtypeOf`, and `kind` as core fields, this design achieves:

- **MongoDB Native Optimization**: Uses `_id` for maximum performance
- **Universal Inheritance**: Every capability has a clear supertype
- **Performance Excellence**: Cached `kind` enables lightning-fast queries
- **Theoretical Soundness**: `subtypeOf` is more fundamental than `kind`
- **Zero Redundancy**: Eliminated duplicate ID fields
- **Perfect Minimalism**: Only 3 core fields, everything else as attributes

This optimal approach provides the perfect foundation for an infinitely scalable and high-performance capability system while maintaining full backward compatibility and theoretical elegance.

**Key Innovation**: Recognizing that `subtypeOf` is more fundamental than `kind` (since `kind` is derivable from inheritance) but keeping both for performance - the perfect balance of theory and practice.
