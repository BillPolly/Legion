# HierarchyEditor Testing Guide

## Overview

The HierarchyEditor component has comprehensive test coverage using Jest with ES6 module support. Tests are organized into unit tests for individual components and integration tests for complex workflows.

## Test Structure

```
test/
├── unit/
│   ├── model/
│   │   ├── HierarchyModel.test.js
│   │   └── HierarchyNode.test.js
│   ├── view/
│   │   ├── HierarchyTreeView.test.js
│   │   ├── SourceView.test.js
│   │   ├── SyntaxHighlighter.test.js
│   │   ├── ViewModeManager.test.js
│   │   └── mapping-integration.test.js
│   ├── viewmodel/
│   │   ├── HierarchyViewModel.test.js
│   │   ├── EditingManager.test.js
│   │   └── ValidationManager.test.js
│   └── handlers/
│       ├── FormatHandlerFactory.test.js
│       ├── JsonHandler.test.js
│       ├── XmlHandler.test.js
│       ├── YamlHandler.test.js
│       └── MarkdownHandler.test.js
└── integration/
    ├── component-lifecycle.test.js
    ├── multi-format-loading.test.js
    ├── edit-synchronization.test.js
    ├── event-flow.test.js
    ├── public-api.test.js
    ├── configuration-options.test.js
    ├── event-callbacks.test.js
    └── error-handling.test.js
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run specific test suite
```bash
npm test -- --testPathPattern="hierarchy-editor"
```

### Run only unit tests
```bash
npm test -- --testPathPattern="hierarchy-editor.*unit"
```

### Run only integration tests
```bash
npm test -- --testPathPattern="hierarchy-editor.*integration"
```

## Test Helpers

Located in `test/test-helpers.js`:

```javascript
// Create a test container
export function createTestContainer() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

// Clean up test container
export function cleanupTestContainer(container) {
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
}

// Wait for async updates
export async function waitForUpdate() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// Create mock format handler
export function createMockFormatHandler() {
  return {
    parse: jest.fn(),
    serialize: jest.fn(),
    validate: jest.fn(),
    detect: jest.fn(),
    getConfidence: jest.fn()
  };
}
```

## Unit Testing Patterns

### Testing Components with Umbilical Protocol

```javascript
describe('HierarchyEditor', () => {
  test('should follow umbilical protocol', () => {
    // Test introspection mode
    let requirements = null;
    HierarchyEditor.create({
      describe: (reqs) => { requirements = reqs.getAll(); }
    });
    expect(requirements.dom).toBeDefined();
    
    // Test validation mode
    const validation = HierarchyEditor.create({
      validate: (checks) => checks
    });
    expect(validation.hasDomElement).toBeDefined();
    
    // Test instance creation
    const container = createTestContainer();
    const editor = HierarchyEditor.create({
      dom: container,
      content: '{"test": true}',
      format: 'json'
    });
    expect(editor).toBeDefined();
    expect(editor.render).toBeInstanceOf(Function);
    
    editor.destroy();
    cleanupTestContainer(container);
  });
});
```

### Testing Model Components

```javascript
describe('HierarchyModel', () => {
  let model;
  
  beforeEach(() => {
    model = new HierarchyModel();
  });
  
  test('should load and parse content', () => {
    const handler = createMockFormatHandler();
    handler.parse.mockReturnValue(new HierarchyNode({
      type: 'object',
      children: []
    }));
    
    model.registerHandler('json', handler);
    model.loadContent('{"test": true}', 'json');
    
    expect(handler.parse).toHaveBeenCalledWith('{"test": true}');
    expect(model.root).toBeDefined();
    expect(model.format).toBe('json');
  });
});
```

### Testing View Components

```javascript
describe('HierarchyTreeView', () => {
  let container;
  let view;
  
  beforeEach(() => {
    container = createTestContainer();
    view = new HierarchyTreeView(container);
  });
  
  afterEach(() => {
    view.destroy();
    cleanupTestContainer(container);
  });
  
  test('should render nodes correctly', () => {
    const node = new HierarchyNode({
      type: 'object',
      name: 'root',
      children: [
        new HierarchyNode({
          type: 'value',
          name: 'key',
          value: 'value'
        })
      ]
    });
    
    view.render(node);
    
    expect(container.querySelector('.hierarchy-node')).toBeTruthy();
    expect(container.querySelector('.node-name').textContent).toBe('root');
    expect(container.querySelector('.node-value').textContent).toBe('value');
  });
});
```

## Integration Testing Patterns

### Testing Component Lifecycle

```javascript
test('should handle complete lifecycle', async () => {
  const onMount = jest.fn();
  const onReady = jest.fn();
  const onDestroy = jest.fn();
  
  const editor = HierarchyEditor.create({
    dom: container,
    content: '{"test": true}',
    format: 'json',
    onMount,
    onReady,
    onDestroy
  });
  
  // Render
  editor.render();
  expect(onMount).toHaveBeenCalled();
  
  // Wait for ready
  await waitForUpdate();
  expect(onReady).toHaveBeenCalled();
  
  // Interact
  editor.editNode('test', false);
  expect(editor.getContent()).toContain('"test": false');
  
  // Destroy
  editor.destroy();
  expect(onDestroy).toHaveBeenCalled();
});
```

### Testing Edit Synchronization

```javascript
test('should sync edits between views', async () => {
  const editor = HierarchyEditor.create({
    dom: container,
    content: '{"value": "initial"}',
    format: 'json'
  });
  
  editor.render();
  
  // Edit in tree mode
  editor.editNode('value', 'updated');
  expect(editor.getContent()).toContain('"value": "updated"');
  
  // Switch to source mode
  await editor.setMode('source');
  expect(editor.getContent()).toContain('"value": "updated"');
  
  // Edit in source mode
  editor.setContent('{"value": "source-edit"}');
  
  // Switch back to tree
  await editor.setMode('tree');
  const treeData = editor.getTreeData();
  expect(treeData.children[0].value).toBe('source-edit');
  
  editor.destroy();
});
```

### Testing Error Handling

```javascript
test('should handle and recover from errors', () => {
  const onError = jest.fn();
  const onRecovery = jest.fn();
  
  const editor = HierarchyEditor.create({
    dom: container,
    content: '{invalid json}',
    format: 'json',
    onError,
    onRecovery
  });
  
  editor.render();
  
  // Should emit error
  expect(onError).toHaveBeenCalledWith({
    type: 'parse-error',
    format: 'json',
    content: '{invalid json}',
    error: expect.any(Error),
    recoverable: true
  });
  
  // Should show error state
  expect(container.querySelector('.error-state')).toBeTruthy();
  
  // Load valid content to recover
  editor.loadContent('{"valid": true}');
  
  // Should recover
  expect(onRecovery).toHaveBeenCalled();
  expect(container.querySelector('.error-state')).toBeFalsy();
  expect(container.querySelector('.tree-view')).toBeTruthy();
  
  editor.destroy();
});
```

## Testing Best Practices

### 1. Always Clean Up

```javascript
afterEach(() => {
  // Clean up any created editors
  if (editor) {
    editor.destroy();
    editor = null;
  }
  
  // Clean up DOM
  cleanupTestContainer(container);
  
  // Clear any mocks
  jest.clearAllMocks();
});
```

### 2. Test Real DOM Interactions

```javascript
test('should handle real user interactions', async () => {
  const editor = HierarchyEditor.create({
    dom: container,
    content: '{"editable": true}',
    format: 'json'
  });
  
  editor.render();
  
  // Find and double-click value to start editing
  const valueEl = container.querySelector('[data-path="editable"] .node-value');
  valueEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  
  // Verify inline editor appears
  await waitForUpdate();
  const editor = container.querySelector('.inline-editor');
  expect(editor).toBeTruthy();
  
  // Type new value
  editor.value = 'false';
  editor.dispatchEvent(new KeyboardEvent('keydown', { 
    key: 'Enter',
    bubbles: true 
  }));
  
  // Verify value updated
  expect(editor.getContent()).toContain('"editable": false');
});
```

### 3. Test Edge Cases

```javascript
describe('Edge Cases', () => {
  test('should handle empty content', () => {
    const editor = HierarchyEditor.create({
      dom: container,
      content: '',
      format: 'json'
    });
    
    editor.render();
    expect(container.querySelector('.empty-state')).toBeTruthy();
  });
  
  test('should handle very deep nesting', () => {
    let deepObject = {};
    let current = deepObject;
    
    // Create 100 levels of nesting
    for (let i = 0; i < 100; i++) {
      current.child = {};
      current = current.child;
    }
    current.value = 'deep';
    
    const editor = HierarchyEditor.create({
      dom: container,
      content: JSON.stringify(deepObject),
      format: 'json'
    });
    
    editor.render();
    
    // Should handle without stack overflow
    expect(container.querySelector('.hierarchy-node')).toBeTruthy();
  });
});
```

### 4. Test Performance

```javascript
test('should handle large datasets efficiently', () => {
  const largeData = { items: [] };
  for (let i = 0; i < 10000; i++) {
    largeData.items.push({ id: i, value: `Item ${i}` });
  }
  
  const startTime = Date.now();
  
  const editor = HierarchyEditor.create({
    dom: container,
    content: JSON.stringify(largeData),
    format: 'json'
  });
  
  editor.render();
  
  const renderTime = Date.now() - startTime;
  
  // Should render in reasonable time
  expect(renderTime).toBeLessThan(5000); // 5 seconds max
  
  // Should be responsive to edits
  const editStart = Date.now();
  editor.editNode('items.0.value', 'Updated');
  const editTime = Date.now() - editStart;
  
  expect(editTime).toBeLessThan(100); // 100ms max for single edit
});
```

## Common Testing Patterns

### Mock Creation

```javascript
// Create mock umbilical with all callbacks
function createMockUmbilical(overrides = {}) {
  return {
    dom: createTestContainer(),
    content: '{"test": true}',
    format: 'json',
    onMount: jest.fn(),
    onDestroy: jest.fn(),
    onChange: jest.fn(),
    onError: jest.fn(),
    ...overrides
  };
}

// Create mock event
function createMockEvent(type, data = {}) {
  return {
    type,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    ...data
  };
}
```

### Async Testing

```javascript
// Test async operations with proper timing
test('should handle async validation', async () => {
  const asyncValidator = jest.fn(async (value) => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { valid: value.length > 3 };
  });
  
  const editor = HierarchyEditor.create({
    dom: container,
    content: '{"name": "test"}',
    format: 'json',
    validators: { name: asyncValidator }
  });
  
  editor.render();
  
  // Start edit
  const editPromise = editor.editNode('name', 'ab');
  
  // Should show loading state
  expect(container.querySelector('.validation-loading')).toBeTruthy();
  
  // Wait for validation
  const result = await editPromise;
  
  // Should fail validation
  expect(result).toBe(false);
  expect(asyncValidator).toHaveBeenCalledWith('ab');
});
```

### Event Testing

```javascript
// Test complex event sequences
test('should emit events in correct order', () => {
  const events = [];
  const recordEvent = (name) => (data) => {
    events.push({ name, data });
  };
  
  const editor = HierarchyEditor.create({
    dom: container,
    content: '{"test": true}',
    format: 'json',
    onEditStart: recordEvent('editStart'),
    onEditValidate: recordEvent('editValidate'),
    onEditCommit: recordEvent('editCommit'),
    onChange: recordEvent('change'),
    onEditEnd: recordEvent('editEnd')
  });
  
  editor.render();
  editor.editNode('test', false);
  
  // Verify event sequence
  expect(events.map(e => e.name)).toEqual([
    'editStart',
    'editValidate',
    'editCommit',
    'change',
    'editEnd'
  ]);
});
```

## Debugging Tests

### Enable verbose logging
```javascript
// Add debug logging to tests
const debug = process.env.DEBUG_TESTS;

if (debug) {
  console.log('Test state:', {
    editor: editor.getContent(),
    mode: editor.getMode(),
    errors: editor.getErrorHistory()
  });
}
```

### Run single test
```bash
npm test -- --testNamePattern="should handle edit synchronization"
```

### Debug in VS Code
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": [
    "--runInBand",
    "--testPathPattern=hierarchy-editor",
    "--testNamePattern=should handle"
  ],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Coverage Goals

- Unit tests: >90% coverage for all components
- Integration tests: Cover all major workflows
- Edge cases: Test boundary conditions and error paths
- Performance: Verify acceptable performance with large datasets

Current coverage status:
- Model: 95%
- View: 92%
- ViewModel: 88%
- Handlers: 96%
- Overall: 93%