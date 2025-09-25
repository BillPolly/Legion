# DataStore Integration Plan for Coding Strategies

## Overview
This plan outlines how to integrate DataStore with all coding strategies, creating a unified data model for software deliverables to replace the current ad-hoc artifact storage system.

## Core Concept
The ProjectManagerStrategy owns the DataStore. Child strategies receive PROXIES that provide them with a focused view of the data they need. This uses the EXISTING proxy infrastructure from `@legion/data-proxies`.

## Step 1: Define the DataStore Schema

Create `packages/agents/roma-agent/src/data/deliverables-schema.js`:

```javascript
export const deliverablesSchema = {
  // Project entity - root of all deliverables
  'project/name': { type: 'string', cardinality: 'one' },
  'project/description': { type: 'string', cardinality: 'one' },
  'project/type': { type: 'string', cardinality: 'one' }, // api, webapp, cli, library
  'project/status': { type: 'string', cardinality: 'one' }, // planning, in_progress, completed
  'project/created': { type: 'instant', cardinality: 'one' },
  'project/rootPath': { type: 'string', cardinality: 'one' },
  
  // Source files - actual code files created
  'file/path': { type: 'string', cardinality: 'one', unique: true },
  'file/content': { type: 'string', cardinality: 'one' },
  'file/type': { type: 'string', cardinality: 'one' }, // source, test, config, documentation
  'file/language': { type: 'string', cardinality: 'one' },
  'file/project': { type: 'ref', cardinality: 'one' },
  'file/created': { type: 'instant', cardinality: 'one' },
  'file/modified': { type: 'instant', cardinality: 'one' },
  
  // Requirements - what needs to be built
  'requirement/description': { type: 'string', cardinality: 'one' },
  'requirement/type': { type: 'string', cardinality: 'one' }, // functional, nonfunctional
  'requirement/priority': { type: 'string', cardinality: 'one' },
  'requirement/status': { type: 'string', cardinality: 'one' }, // pending, implemented, tested
  'requirement/project': { type: 'ref', cardinality: 'one' },
  
  // Tests - test cases and results
  'test/name': { type: 'string', cardinality: 'one' },
  'test/type': { type: 'string', cardinality: 'one' }, // unit, integration, e2e
  'test/status': { type: 'string', cardinality: 'one' }, // pending, passed, failed
  'test/file': { type: 'ref', cardinality: 'one' },
  'test/project': { type: 'ref', cardinality: 'one' },
  
  // Dependencies - packages needed
  'dependency/name': { type: 'string', cardinality: 'one' },
  'dependency/version': { type: 'string', cardinality: 'one' },
  'dependency/type': { type: 'string', cardinality: 'one' }, // runtime, dev, peer
  'dependency/project': { type: 'ref', cardinality: 'one' },
  
  // Errors/Issues - problems encountered
  'error/message': { type: 'string', cardinality: 'one' },
  'error/stack': { type: 'string', cardinality: 'one' },
  'error/file': { type: 'ref', cardinality: 'one' },
  'error/timestamp': { type: 'instant', cardinality: 'one' },
  'error/resolved': { type: 'boolean', cardinality: 'one' },
  'error/project': { type: 'ref', cardinality: 'one' },
  
  // Tasks - work items
  'task/description': { type: 'string', cardinality: 'one' },
  'task/strategy': { type: 'string', cardinality: 'one' },
  'task/status': { type: 'string', cardinality: 'one' },
  'task/parent': { type: 'ref', cardinality: 'one' },
  'task/project': { type: 'ref', cardinality: 'one' }
};
```

## Step 2: Create ProjectManagerStrategy (Owns DataStore)

Create `packages/agents/roma-agent/src/strategies/ProjectManagerStrategy.js`:

```javascript
import { createTypedStrategy } from './utils/StandardTaskStrategy.js';
import { DataStore, EntityProxy, CollectionProxy } from '@legion/data-proxies';
import { deliverablesSchema } from '../data/deliverables-schema.js';

export const createProjectManagerStrategy = createTypedStrategy(
  'project-manager',
  [],  // No required tools
  {}   // No prompts needed
);

createProjectManagerStrategy.doWork = async function() {
  console.log('🎯 ProjectManager: Initializing project data model');
  
  // ONLY ProjectManagerStrategy creates and owns the DataStore
  const dataStore = new DataStore(deliverablesSchema);
  this.dataStore = dataStore;  // Store reference for later
  
  // Create the root project entity
  const projectData = dataStore.createEntity({
    'project/name': this.description,
    'project/description': this.description,
    'project/type': this.detectProjectType(this.description),
    'project/status': 'planning',
    'project/created': new Date(),
    'project/rootPath': `/tmp/roma-projects/${Date.now()}`
  });
  
  const projectId = projectData.entityId;
  console.log(`📊 Created project entity: ${projectId}`);
  
  // Create an EntityProxy for the project
  const projectProxy = new EntityProxy(dataStore, projectId);
  
  // Create a CollectionProxy for files in this project
  const filesProxy = new CollectionProxy(dataStore, {
    find: ['?file', '?path', '?content'],
    where: [
      ['?file', 'file/project', projectId],
      ['?file', 'file/path', '?path'],
      ['?file', 'file/content', '?content']
    ]
  });
  
  // Analyze the task to determine which strategy to use
  const strategyType = this.determineStrategy(this.description);
  
  // Create child task with PROXIES, not the DataStore
  const childTask = this.createChildTask({
    description: this.description,
    strategy: strategyType,
    context: {
      ...this.context,
      // Child strategies get proxies, not the DataStore
      project: projectProxy,        // EntityProxy for the project
      files: filesProxy,            // CollectionProxy for files
      projectId: projectId          // ID for creating relationships
    }
  });
  
  // Delegate to the appropriate coding strategy
  this.delegateToChild(childTask);
};

// Helper to create specialized proxies for different strategies
createProjectManagerStrategy.createProxiesForStrategy = function(strategyType, projectId) {
  const proxies = {
    project: new EntityProxy(this.dataStore, projectId)
  };
  
  // Different strategies get different collection proxies
  switch(strategyType) {
    case 'SimpleNodeServerStrategy':
      proxies.files = new CollectionProxy(this.dataStore, {
        find: ['?file'],
        where: [
          ['?file', 'file/project', projectId],
          ['?file', 'file/type', 'source']
        ]
      });
      break;
      
    case 'SimpleNodeTestStrategy':
      proxies.tests = new CollectionProxy(this.dataStore, {
        find: ['?test'],
        where: [
          ['?test', 'test/project', projectId]
        ]
      });
      proxies.testFiles = new CollectionProxy(this.dataStore, {
        find: ['?file'],
        where: [
          ['?file', 'file/project', projectId],
          ['?file', 'file/type', 'test']
        ]
      });
      break;
      
    case 'MonitoringStrategy':
      proxies.errors = new CollectionProxy(this.dataStore, {
        find: ['?error'],
        where: [
          ['?error', 'error/project', projectId],
          ['?error', 'error/resolved', false]
        ]
      });
      break;
  }
  
  return proxies;
};
```

## Step 3: Update SimpleNodeServerStrategy (Uses Proxies, Not DataStore)

Modify `packages/agents/roma-agent/src/strategies/simple-node/SimpleNodeServerStrategy.js`:

```javascript
createSimpleNodeServerStrategy.doWork = async function doWork() {
  console.log(`🚀 Generating Node.js server for: ${this.description}`);
  
  // Get PROXIES from context (NOT the DataStore!)
  const project = this.context?.project;  // EntityProxy
  const files = this.context?.files;      // CollectionProxy
  const projectId = this.context?.projectId;
  
  // ... existing requirement analysis and code generation ...
  
  // Use proxies to interact with data
  if (project && files) {
    // Update project status through EntityProxy
    project.status = 'in_progress';  // Natural property access via proxy
    
    // Add files through CollectionProxy (or create directly if proxy doesn't support add)
    // Since CollectionProxy is read-focused, we might need to create entities directly
    // But we do it through the proxy's underlying store
    const serverFile = files.add({
      'file/path': 'server.js',
      'file/content': serverCode.code,
      'file/type': 'source',
      'file/language': 'javascript',
      'file/project': projectId,
      'file/created': new Date(),
      'file/modified': new Date()
    });
    
    const packageFile = files.add({
      'file/path': 'package.json',
      'file/content': JSON.stringify(packageJson, null, 2),
      'file/type': 'config',
      'file/language': 'json',
      'file/project': projectId,
      'file/created': new Date(),
      'file/modified': new Date()
    });
    
    // Query existing files through proxy
    const existingFiles = files.query();  // Returns current files
    console.log(`📊 Project now has ${existingFiles.length} files`);
    
    // Complete without artifacts
    this.complete({
      success: true,
      message: `Created ${requirements.serverType} server with ${requirements.endpoints.length} endpoints`,
      projectId: projectId
    });
  } else {
    // Fallback to old artifact system during migration
    const artifacts = {
      'server.js': {
        value: serverCode.code,
        description: `${requirements.serverType} server`,
        type: 'file'
      },
      'package.json': {
        value: JSON.stringify(packageJson, null, 2),
        description: 'Package configuration',
        type: 'file'
      }
    };
    
    this.completeWithArtifacts(artifacts, {
      success: true,
      message: `Created ${requirements.serverType} server`
    });
  }
};
```

## Step 4: Create Helper Proxies for Common Patterns

Since strategies don't have direct DataStore access, we need helper methods on proxies:

```javascript
// Extend CollectionProxy for file operations
class FilesProxy extends CollectionProxy {
  constructor(dataStore, projectId) {
    super(dataStore, {
      find: ['?file', '?path', '?content'],
      where: [
        ['?file', 'file/project', projectId],
        ['?file', 'file/path', '?path'],
        ['?file', 'file/content', '?content']
      ]
    });
    this.projectId = projectId;
  }
  
  // Add method to create files (since CollectionProxy is read-focused)
  add(fileData) {
    return this.dataStore.createEntity({
      ...fileData,
      'file/project': this.projectId
    });
  }
  
  // Check if file exists
  exists(path) {
    const results = this.dataStore.query({
      find: ['?file'],
      where: [
        ['?file', 'file/project', this.projectId],
        ['?file', 'file/path', path]
      ]
    });
    return results.length > 0;
  }
  
  // Get file by path
  getByPath(path) {
    const results = this.dataStore.query({
      find: ['?file'],
      where: [
        ['?file', 'file/project', this.projectId],
        ['?file', 'file/path', path]
      ]
    });
    return results[0] ? new EntityProxy(this.dataStore, results[0]) : null;
  }
}
```

## Step 5: Update StrategyHelpers to Work with Proxies

Modify `packages/agents/roma-agent/src/strategies/utils/StrategyHelpers.js`:

```javascript
// Update completeWithArtifacts to use proxies
export function completeWithArtifacts(strategy, artifacts, result) {
  const files = strategy.context?.files;  // CollectionProxy
  const projectId = strategy.context?.projectId;
  
  if (files && projectId) {
    // Use proxy to add files
    const fileIds = [];
    Object.entries(artifacts).forEach(([filepath, artifact]) => {
      const entity = files.add({
        'file/path': filepath,
        'file/content': artifact.value,
        'file/type': artifact.type || 'source',
        'file/language': detectLanguage(filepath),
        'file/created': new Date(),
        'file/modified': new Date()
      });
      fileIds.push(entity.entityId);
    });
    
    strategy.complete({
      ...result,
      projectId: projectId,
      files: fileIds
    });
  } else {
    // Fallback to old artifact system
    Object.entries(artifacts).forEach(([key, artifact]) => {
      strategy.addArtifact(key, artifact);
    });
    strategy.complete(result);
  }
}

// Update getAllArtifacts to use proxies
export function getAllArtifacts(strategy) {
  const files = strategy.context?.files;  // CollectionProxy
  
  if (files) {
    // Query through proxy
    const fileData = files.query();  // Returns array of [id, path, content]
    
    // Convert to artifact format for backward compatibility
    const artifacts = {};
    fileData.forEach(([fileId, path, content]) => {
      artifacts[path] = {
        value: content,
        type: 'file'
      };
    });
    return artifacts;
  }
  
  // Fallback to old system
  return strategy._artifacts || {};
}
```

## Step 6: Different Proxy Types for Different Strategies

Each strategy type gets appropriate proxies:

### SimpleNodeTestStrategy
```javascript
// In ProjectManagerStrategy when creating child context:
context: {
  project: projectProxy,           // EntityProxy for project
  tests: testsProxy,              // CollectionProxy for test entities
  testFiles: testFilesProxy,      // CollectionProxy for test files
  sourceFiles: sourceFilesProxy,  // CollectionProxy to query source files to test
  projectId: projectId
}

// In SimpleNodeTestStrategy:
const tests = this.context.tests;
const testFiles = this.context.testFiles;

// Add a test file
const testFile = testFiles.add({
  'file/path': 'server.test.js',
  'file/content': testCode,
  'file/type': 'test'
});

// Add test cases
testCases.forEach(tc => {
  tests.add({
    'test/name': tc.name,
    'test/type': 'unit',
    'test/status': 'pending',
    'test/file': testFile.entityId
  });
});
```

### MonitoringStrategy
```javascript
// Gets error proxy
context: {
  project: projectProxy,
  errors: errorsProxy,  // CollectionProxy for unresolved errors
  files: filesProxy,    // CollectionProxy to find files with errors
  projectId: projectId
}

// In MonitoringStrategy:
const errors = this.context.errors;

// Query unresolved errors through proxy
const unresolvedErrors = errors.query();

// Update error status (need EntityProxy for specific error)
unresolvedErrors.forEach(([errorId]) => {
  const errorProxy = new EntityProxy(errors.dataStore, errorId);
  errorProxy.resolved = true;  // Natural property update
});
```

### AnalysisStrategy
```javascript
// Gets read-only proxies for analysis
context: {
  project: projectProxy,
  files: filesProxy,           // All files
  requirements: requirementsProxy,  // All requirements
  dependencies: dependenciesProxy,  // All dependencies
  projectId: projectId
}

// Strategy can query but typically doesn't modify
const allFiles = this.context.files.query();
const requirements = this.context.requirements.query();
// Analyze relationships, complexity, etc.
```

## Key Principles

1. **Only ProjectManagerStrategy has DataStore** - It's the single source of truth
2. **Child strategies get proxies** - Focused views of the data they need
3. **Proxies provide natural access** - `project.status = 'done'` just works
4. **CollectionProxy for queries** - Pre-configured queries for each strategy's needs
5. **EntityProxy for single entities** - Natural property access to specific items
6. **No direct DataStore access** - Strategies work through proxies only

## Benefits of Proxy Approach

1. **Encapsulation** - Strategies can't mess with data they shouldn't touch
2. **Focused Interface** - Each strategy only sees relevant data
3. **Natural Syntax** - Proxies make it feel like regular JavaScript objects
4. **Query Optimization** - CollectionProxies can have pre-optimized queries
5. **Change Tracking** - Proxies can track what strategies modify
6. **Security** - Can add validation/permissions at proxy level

## Migration Strategy

1. **Phase 1**: Create ProjectManagerStrategy with DataStore
2. **Phase 2**: Update strategies one-by-one to use proxies
3. **Phase 3**: Each strategy tested with both proxy and fallback paths
4. **Phase 4**: Remove old artifact system once all strategies migrated

## Testing Approach

### Test Proxy Creation
```javascript
it('should create appropriate proxies for strategies', () => {
  const store = new DataStore(deliverablesSchema);
  const projectId = store.createEntity({ 'project/name': 'Test' }).entityId;
  
  const projectProxy = new EntityProxy(store, projectId);
  const filesProxy = new CollectionProxy(store, {
    find: ['?file'],
    where: [['?file', 'file/project', projectId]]
  });
  
  // Test natural access
  projectProxy.status = 'in_progress';
  expect(projectProxy.status).toBe('in_progress');
  
  // Test collection operations
  expect(filesProxy.query()).toHaveLength(0);
});
```

### Test Strategy with Proxies
```javascript
it('should work with proxies instead of DataStore', async () => {
  // ProjectManagerStrategy creates everything
  const manager = await createProjectManagerStrategy();
  await manager.doWork();
  
  // Verify child strategy got proxies, not DataStore
  const childContext = manager.lastChildTask.context;
  expect(childContext.dataStore).toBeUndefined();
  expect(childContext.project).toBeDefined();  // EntityProxy
  expect(childContext.files).toBeDefined();     // CollectionProxy
});
```

## Summary

The key insight is that **only ProjectManagerStrategy owns the DataStore**. All other strategies receive **proxies** that give them focused, controlled access to just the data they need. This leverages the existing proxy infrastructure while maintaining clean separation of concerns and preventing strategies from accessing data they shouldn't touch.