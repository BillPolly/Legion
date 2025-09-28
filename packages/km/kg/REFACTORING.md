# Knowledge Graph Package Refactoring

## Overview
The `@legion/kg` package has been refactored from a monolithic 2.1MB package with 151 files to a more modular architecture with ~66 core files.

## Changes Made

### 1. Extracted Storage Providers
Created separate packages for storage implementations:
- `@legion/kg-storage-core` - Base interfaces and error classes
- `@legion/kg-storage-memory` - In-memory storage
- `@legion/kg-storage-file` - File system storage
- Other storage providers (GitHub, SQL, MongoDB, GraphDB, Remote) remain in core for now

### 2. Extracted RDF Support
- `@legion/kg-rdf` - RDF parsing, serialization, and namespace management

### 3. ~~Extracted Examples~~ (Removed)
- ~~`@legion/kg-examples`~~ - Removed: example code not needed, tests now use inline mocks

### 4. Extracted Gellish CNL
- `@legion/kg-gellish` - Gellish Controlled Natural Language support

### 5. Renamed Conflicting Classes
- `ToolRegistry` → `KGToolRegistry` (to avoid confusion with `@legion/tools-registry`)
- `SchemaGenerator` → `KGSchemaGenerator` (to avoid confusion with `@legion/schema`)

## Benefits
- **Reduced core size**: From 2.1MB to ~2.0MB (more reduction possible)
- **Better separation of concerns**: Optional features are now separate packages
- **Cleaner dependencies**: Only load what you need
- **No duplicate functionality**: Clarified naming to avoid confusion with other Legion packages

## Migration Guide

### For Storage
```javascript
// Before
import { InMemoryTripleStore } from '@legion/kg';

// After
import { InMemoryTripleStore } from '@legion/kg-storage-memory';
// OR still works via facade:
import { InMemoryTripleStore } from '@legion/kg';
```

### ~~For Examples~~ (No Longer Applicable)
The examples package has been removed. Tests now use inline mocks as needed.

### For RDF
```javascript
// Before (internal use)
import { RDFParser } from '@legion/kg/src/rdf/RDFParser.js';

// After
import { RDFParser } from '@legion/kg-rdf';
// OR still works via facade:
import { RDFParser } from '@legion/kg';
```

### For Tool Registry
```javascript
// Before (if used directly)
import { ToolRegistry } from '@legion/kg';

// After (renamed to avoid confusion)
import { KGToolRegistry } from '@legion/kg';
```

## Next Steps
Further refactoring could include:
1. Extracting remaining storage providers to separate packages
2. Breaking down large query system into smaller modules
3. Creating a plugin architecture for extensions
4. Further size optimization of core files