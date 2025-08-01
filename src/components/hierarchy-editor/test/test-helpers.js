/**
 * Test utilities for HierarchyEditor component
 */

export function createTestContainer() {
  const container = document.createElement('div');
  container.id = 'test-container-' + Date.now();
  document.body.appendChild(container);
  return container;
}

export function cleanupTestContainer(container) {
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
}

function createMockFn() {
  if (typeof jest !== 'undefined' && jest.fn) {
    return jest.fn();
  }
  
  const mockFn = function(...args) {
    mockFn.calls.push(args);
    if (mockFn.implementation) {
      return mockFn.implementation(...args);
    }
  };
  
  mockFn.calls = [];
  mockFn.mockImplementation = function(impl) {
    mockFn.implementation = impl;
    return mockFn;
  };
  
  return mockFn;
}

export function createMockUmbilical(overrides = {}) {
  const mockUmbilical = {
    dom: createTestContainer(),
    content: '{"test": true}',
    format: 'json',
    editable: true,
    onMount: createMockFn(),
    onDestroy: createMockFn(),
    onContentChange: createMockFn(),
    onNodeEdit: createMockFn(),
    ...overrides
  };
  
  return mockUmbilical;
}

export async function waitForUpdate() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

export async function waitForRender() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

export function createTestNode(type = 'value', name = 'test', value = 'testValue') {
  return {
    id: 'node-' + Math.random().toString(36).substr(2, 9),
    type,
    name,
    value: arguments.length >= 3 ? value : 'testValue',
    children: [],
    metadata: {},
    parent: null
  };
}

export function createTestHierarchy() {
  const root = createTestNode('object', 'root', null);
  const child1 = createTestNode('value', 'name', 'test');
  const child2 = createTestNode('value', 'value', 42);
  
  child1.parent = root;
  child2.parent = root;
  root.children = [child1, child2];
  
  return root;
}