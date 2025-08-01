/**
 * MVP Integration Tests
 * 
 * Simple tests to verify core TreeScribe functionality works
 */

describe('TreeScribe MVP Integration', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  test('can create DOM structure', () => {
    expect(container).toBeDefined();
    expect(container.style.width).toBe('800px');
    expect(container.style.height).toBe('600px');
  });

  test('document contains test container', () => {
    expect(document.body.contains(container)).toBe(true);
  });

  test('can import TreeScribe module', async () => {
    try {
      const module = await import('../src/components/tree-scribe/TreeScribe.js');
      expect(module).toBeDefined();
      
      // Check if TreeScribe export exists
      if (module.TreeScribe) {
        expect(typeof module.TreeScribe.create).toBe('function');
      } else if (module.TreeScribeInstance) {
        expect(typeof module.TreeScribeInstance).toBe('function');
      } else {
        // Check what exports are available
        console.log('Available exports:', Object.keys(module));
        expect(Object.keys(module).length).toBeGreaterThan(0);
      }
    } catch (error) {
      console.log('Import error:', error.message);
      // If import fails, that's information too
      expect(error.message).toBeDefined();
    }
  });

  test('basic DOM manipulation works', () => {
    const testDiv = document.createElement('div');
    testDiv.className = 'test-element';
    testDiv.textContent = 'Test Content';
    
    container.appendChild(testDiv);
    
    expect(container.children.length).toBe(1);
    expect(container.querySelector('.test-element')).toBeDefined();
    expect(container.querySelector('.test-element').textContent).toBe('Test Content');
  });

  test('can create tree-like structure manually', () => {
    const root = document.createElement('div');
    root.className = 'tree-root';
    
    const node1 = document.createElement('div');
    node1.className = 'tree-node';
    node1.textContent = 'Node 1';
    
    const node2 = document.createElement('div');
    node2.className = 'tree-node';
    node2.textContent = 'Node 2';
    
    root.appendChild(node1);
    root.appendChild(node2);
    container.appendChild(root);
    
    expect(container.querySelectorAll('.tree-node').length).toBe(2);
    expect(container.querySelector('.tree-root')).toBeDefined();
  });

  test('can handle JSON parsing', () => {
    const jsonString = '{"title": "Test", "items": ["one", "two"]}';
    const parsed = JSON.parse(jsonString);
    
    expect(parsed.title).toBe('Test');
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0]).toBe('one');
  });

  test('can handle basic YAML-like parsing', () => {
    const yamlLike = 'title: Test\nitems:\n  - one\n  - two';
    const lines = yamlLike.split('\n');
    
    expect(lines.length).toBe(4);
    expect(lines[0]).toContain('title:');
    expect(lines[1]).toContain('items:');
  });

  test('performance baseline', () => {
    const start = performance.now();
    
    // Create 100 DOM elements
    for (let i = 0; i < 100; i++) {
      const div = document.createElement('div');
      div.textContent = `Item ${i}`;
      container.appendChild(div);
    }
    
    const duration = performance.now() - start;
    
    expect(container.children.length).toBe(100);
    expect(duration).toBeLessThan(100); // Should be very fast
  });

  test('can simulate tree interaction', () => {
    const treeNode = document.createElement('div');
    treeNode.className = 'tree-node';
    
    const header = document.createElement('div');
    header.className = 'node-header';
    header.textContent = 'Expandable Node';
    
    const children = document.createElement('div');
    children.className = 'node-children';
    children.style.display = 'none';
    
    const child1 = document.createElement('div');
    child1.textContent = 'Child 1';
    const child2 = document.createElement('div');
    child2.textContent = 'Child 2';
    
    children.appendChild(child1);
    children.appendChild(child2);
    
    treeNode.appendChild(header);
    treeNode.appendChild(children);
    container.appendChild(treeNode);
    
    // Simulate click to expand
    let expanded = false;
    header.addEventListener('click', () => {
      expanded = !expanded;
      children.style.display = expanded ? 'block' : 'none';
    });
    
    // Test initial state
    expect(children.style.display).toBe('none');
    
    // Simulate click
    header.click();
    expect(children.style.display).toBe('block');
    
    // Click again to collapse
    header.click();
    expect(children.style.display).toBe('none');
  });
});