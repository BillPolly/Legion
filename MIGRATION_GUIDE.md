# Migration Guide: module-loader → tool-system

## Overview

This guide helps you migrate from `@legion/module-loader` to the simpler, cleaner `@legion/tool-system`.

## Why Migrate?

- **90% less code** - tool-system is ~400 lines vs module-loader's 3000+
- **Cleaner API** - Proxy-based ResourceManager with transparent access
- **Better performance** - Fewer abstractions and indirection
- **Easier debugging** - Simple, straightforward code paths
- **Full compatibility** - Backward compatible during migration

## Quick Start

### Automated Migration

Use the migration script for automatic conversion:

```bash
# Migrate a single package
node scripts/migrate-to-tool-system.js packages/your-package

# The script will:
# 1. Update package.json dependencies
# 2. Convert imports
# 3. Update ResourceManager calls
# 4. Create backups of all changed files
```

### Manual Migration

If you prefer manual migration or need to handle special cases:

#### 1. Update package.json

```json
// Before
"dependencies": {
  "@legion/module-loader": "*"
}

// After
"dependencies": {
  "@legion/tool-system": "^1.0.0"
}
```

#### 2. Update Imports

```javascript
// Before
import { Module, Tool, ToolResult } from '@legion/module-loader';

// After (with compatibility)
import { Module, Tool, ToolResult } from '@legion/tool-system';

// After (clean migration)
import { ModuleInstance, Tool } from '@legion/tool-system';
```

#### 3. Update ResourceManager Usage

```javascript
// Before - explicit get() calls
const apiKey = resourceManager.get('env.OPENAI_API_KEY');
const config = resourceManager.get('config');

// After - transparent access
const apiKey = resourceManager.env.OPENAI_API_KEY;
const config = resourceManager.config;
```

## Migration Patterns

### Pattern 1: Simple Module

**Before (module-loader):**
```javascript
import { Module, Tool } from '@legion/module-loader';

export class MyModule extends Module {
  constructor() {
    super('MyModule');
  }
  
  async initialize() {
    this.registerTool(new MyTool());
  }
}
```

**After (tool-system with compatibility):**
```javascript
import { Module, Tool } from '@legion/tool-system';

export class MyModule extends Module {
  constructor() {
    super('MyModule');
  }
  
  async initialize() {
    this.registerTool(new MyTool());
  }
}
```

No changes needed! The compatibility layer handles it.

### Pattern 2: ResourceManager Factory

**Before:**
```javascript
static async create(resourceManager) {
  const apiKey = resourceManager.get('env.API_KEY');
  const endpoint = resourceManager.get('config.endpoint');
  
  return new MyModule({
    apiKey,
    endpoint
  });
}
```

**After:**
```javascript
static async create(resourceManager) {
  const apiKey = resourceManager.env.API_KEY;
  const endpoint = resourceManager.config.endpoint;
  
  return new MyModule({
    apiKey,
    endpoint
  });
}
```

### Pattern 3: Tool with Events

**Before:**
```javascript
class MyTool extends Tool {
  async execute(input) {
    this.emit('event', {
      type: 'progress',
      message: 'Starting...'
    });
    // ...
  }
}
```

**After:**
```javascript
class MyTool extends Tool {
  async execute(input) {
    this.progress('Starting...', 0);
    // ... do work
    this.progress('Complete', 100);
  }
}
```

### Pattern 4: Clean Migration (Recommended)

For new code or full refactoring:

```javascript
// Use the new clean API
import { 
  ModuleInstance,  // Instead of Module
  Tool,
  ResourceManager 
} from '@legion/tool-system';

export class MyModule extends ModuleInstance {
  constructor(config) {
    super({ name: 'MyModule' }, config);
    this.createTools();
  }
  
  createTools() {
    const tool = new Tool({
      name: 'my_tool',
      inputSchema: { /* JSON schema */ },
      execute: async (input) => {
        // Access config naturally
        const apiKey = this.config.apiKey;
        
        tool.progress('Working...', 50);
        
        return { success: true };
      }
    });
    
    this.registerTool('my_tool', tool);
  }
}

// Usage with ResourceManager
const rm = new ResourceManager();
rm.apiKey = 'sk-123';  // Set like plain object
rm.endpoint = 'https://api.example.com';

const module = new MyModule(rm);
```

## Feature Comparison

| Feature | module-loader | tool-system | Migration Notes |
|---------|--------------|-------------|-----------------|
| Module base class | `Module` | `ModuleInstance` | Compatibility export available |
| Tool class | `Tool` | `Tool` | Same API, simpler implementation |
| Events | `emit('event', {...})` | `progress()`, `error()`, etc. | Helper methods available |
| ResourceManager | `rm.get('key')` | `rm.key` | Proxy-based transparent access |
| Schema validation | Zod only | JSON Schema + Zod | Both supported |
| ToolResult | Class-based | Plain objects | Compatibility class available |

## Testing After Migration

1. **Run existing tests** - Should pass without changes due to compatibility layer
2. **Check event handling** - Ensure progress/error events still flow correctly
3. **Verify ResourceManager** - Check that resource access works
4. **Test tools** - Ensure tool execution and validation work

## Rollback Plan

If you need to rollback:

1. Restore backup files: `find packages/your-package -name "*.backup" -exec sh -c 'mv "$1" "${1%.backup}"' _ {} \;`
2. Revert package.json: `git checkout packages/your-package/package.json`
3. Run `npm install` to restore dependencies

## Common Issues and Solutions

### Issue 1: "Cannot find module '@legion/tool-system'"

**Solution:** Run `npm install` from the Legion root directory to link the package.

### Issue 2: "resourceManager.get is not a function"

**Solution:** You're using the new ResourceManager with old syntax. Either:
- Use direct access: `rm.key` instead of `rm.get('key')`
- Wrap in CompatResourceManager for gradual migration

### Issue 3: Tests failing after migration

**Solution:** The compatibility layer should handle most cases, but check:
- Event names (use helper methods like `progress()` instead of generic `emit()`)
- ResourceManager usage patterns
- Any direct instanceof checks against old classes

## Migration Checklist

- [ ] Back up your package
- [ ] Run migration script or update manually
- [ ] Update package.json dependencies
- [ ] Convert ResourceManager.get() to direct access
- [ ] Update import statements
- [ ] Run tests
- [ ] Update any custom event handling
- [ ] Remove backup files when satisfied
- [ ] Update documentation

## Getting Help

If you encounter issues:

1. Check this guide for patterns
2. Look at successfully migrated packages (e.g., voice module)
3. Use the compatibility layer for gradual migration
4. File an issue with specific error messages

## Benefits After Migration

Once migrated, you'll enjoy:

- **Cleaner code** - Less boilerplate, more readable
- **Better performance** - Fewer layers of abstraction
- **Easier debugging** - Simple, direct code paths
- **Modern patterns** - Proxy-based configuration
- **Smaller bundle** - 90% less framework code

The migration is worth it for the simplicity alone!