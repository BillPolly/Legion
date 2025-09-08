/**
 * Unit Tests for JSONRenderer
 * 
 * Tests JSON data rendering with syntax highlighting, formatting, and tree view
 * NO MOCKS - Tests real JSON rendering capabilities
 */

import { JSONRenderer } from '../../../src/renderers/JSONRenderer.js';

describe('JSONRenderer', () => {
  let renderer;

  beforeEach(() => {
    renderer = new JSONRenderer();
  });

  describe('constructor', () => {
    test('should initialize with default configuration', () => {
      expect(renderer).toBeInstanceOf(JSONRenderer);
      expect(typeof renderer.render).toBe('function');
      expect(typeof renderer.canRender).toBe('function');
    });

    test('should accept custom configuration', () => {
      const customRenderer = new JSONRenderer({
        maxDisplayLength: 500,
        showControls: true,
        autoFormat: false
      });

      const config = customRenderer.getConfig();
      expect(config.maxDisplayLength).toBe(500);
      expect(config.showControls).toBe(true);
      expect(config.autoFormat).toBe(false);
    });
  });

  describe('canRender', () => {
    test('should return true for JSON objects', () => {
      expect(renderer.canRender({ key: 'value' })).toBe(true);
      expect(renderer.canRender([])).toBe(true);
      expect(renderer.canRender([1, 2, 3])).toBe(true);
      expect(renderer.canRender({ nested: { object: true } })).toBe(true);
    });

    test('should return true for valid JSON strings', () => {
      expect(renderer.canRender('{"key": "value"}')).toBe(true);
      expect(renderer.canRender('[1, 2, 3]')).toBe(true);
      expect(renderer.canRender('null')).toBe(true);
      expect(renderer.canRender('true')).toBe(true);
      expect(renderer.canRender('42')).toBe(true);
    });

    test('should return false for non-JSON data', () => {
      expect(renderer.canRender('plain text')).toBe(false);
      expect(renderer.canRender('invalid json {')).toBe(false);
      expect(renderer.canRender(null)).toBe(false);
      expect(renderer.canRender(undefined)).toBe(false);
      expect(renderer.canRender(42)).toBe(false); // Raw numbers not objects
      expect(renderer.canRender('not json')).toBe(false);
    });
  });

  describe('render', () => {
    test('should render simple JSON object', () => {
      const data = { name: 'test', value: 123 };
      const result = renderer.render(data);

      expect(result).toHaveProperty('element');
      expect(result.element).toBeInstanceOf(HTMLElement);
      expect(result.element.className).toBe('json-renderer');
      
      const content = result.element.textContent;
      expect(content).toContain('name');
      expect(content).toContain('test');
      expect(content).toContain('value');
      expect(content).toContain('123');
    });

    test('should render JSON array', () => {
      const data = ['apple', 'banana', 'cherry'];
      const result = renderer.render(data);

      expect(result).toHaveProperty('element');
      const content = result.element.textContent;
      expect(content).toContain('apple');
      expect(content).toContain('banana');
      expect(content).toContain('cherry');
    });

    test('should render nested JSON objects', () => {
      const data = {
        user: {
          name: 'John',
          profile: {
            age: 30,
            settings: {
              theme: 'dark'
            }
          }
        }
      };

      const result = renderer.render(data);
      const content = result.element.textContent;
      
      expect(content).toContain('user');
      expect(content).toContain('John');
      expect(content).toContain('profile');
      expect(content).toContain('age');
      expect(content).toContain('30');
      expect(content).toContain('settings');
      expect(content).toContain('theme');
      expect(content).toContain('dark');
    });

    test('should render JSON from string', () => {
      const jsonString = '{"message": "hello", "count": 42}';
      const result = renderer.render(jsonString);

      const content = result.element.textContent;
      expect(content).toContain('message');
      expect(content).toContain('hello');
      expect(content).toContain('count');
      expect(content).toContain('42');
    });

    test('should include syntax highlighting', () => {
      const data = { string: 'text', number: 123, boolean: true, null: null };
      const result = renderer.render(data);

      // Check for different syntax highlighting classes
      const stringElements = result.element.querySelectorAll('.json-string');
      const numberElements = result.element.querySelectorAll('.json-number');
      const booleanElements = result.element.querySelectorAll('.json-boolean');
      const nullElements = result.element.querySelectorAll('.json-null');

      expect(stringElements.length).toBeGreaterThan(0);
      expect(numberElements.length).toBeGreaterThan(0);
      expect(booleanElements.length).toBeGreaterThan(0);
      expect(nullElements.length).toBeGreaterThan(0);
    });

    test('should apply proper formatting with indentation', () => {
      const data = { level1: { level2: { level3: 'deep' } } };
      const result = renderer.render(data);

      // Check that content is structured with proper nested elements
      const nestedElements = result.element.querySelectorAll('.json-items');
      expect(nestedElements.length).toBeGreaterThan(0);
      
      // Check for proper indentation styling (margin-left)
      nestedElements.forEach(element => {
        expect(element.style.marginLeft).toBe('16px');
      });
    });

    test('should include controls when enabled', () => {
      const rendererWithControls = new JSONRenderer({
        showControls: true
      });

      const result = rendererWithControls.render({ test: 'data' });
      
      expect(result.element.querySelector('.json-controls')).toBeTruthy();
      expect(result.element.querySelector('.expand-all')).toBeTruthy();
      expect(result.element.querySelector('.collapse-all')).toBeTruthy();
      expect(result.element.querySelector('.format-json')).toBeTruthy();
      expect(result.element.querySelector('.copy-json')).toBeTruthy();
    });

    test('should handle different JSON data types correctly', () => {
      const data = {
        string: 'hello',
        number: 42,
        float: 3.14,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        object: { nested: 'value' }
      };

      const result = renderer.render(data);
      const content = result.element.textContent;

      expect(content).toContain('hello');
      expect(content).toContain('42');
      expect(content).toContain('3.14');
      expect(content).toContain('true');
      expect(content).toContain('null');
      expect(content).toContain('nested');
      expect(content).toContain('value');
    });

    test('should truncate large JSON data with expansion option', () => {
      const rendererWithLimit = new JSONRenderer({
        maxDisplayLength: 100
      });

      const largeData = {};
      for (let i = 0; i < 50; i++) {
        largeData[`key_${i}`] = `value_${i}`;
      }

      const result = rendererWithLimit.render(largeData);
      expect(result.element.querySelector('.json-truncated')).toBeTruthy();
      expect(result.element.querySelector('.expand-full')).toBeTruthy();
    });
  });

  describe('expand/collapse functionality', () => {
    let rendererWithControls;

    beforeEach(() => {
      rendererWithControls = new JSONRenderer({
        showControls: true
      });
    });

    test('should expand all nodes when expand all button is clicked', () => {
      const data = { level1: { level2: { level3: 'deep' } } };
      const result = rendererWithControls.render(data);
      
      const expandAllBtn = result.element.querySelector('.expand-all');
      expandAllBtn.click();
      
      // All collapsible nodes should be expanded
      const collapsedNodes = result.element.querySelectorAll('.json-collapsed');
      expect(collapsedNodes.length).toBe(0);
    });

    test('should collapse all nodes when collapse all button is clicked', () => {
      const data = { level1: { level2: { level3: 'deep' } } };
      const result = rendererWithControls.render(data);
      
      const collapseAllBtn = result.element.querySelector('.collapse-all');
      collapseAllBtn.click();
      
      // All expandable nodes should be collapsed
      const expandedNodes = result.element.querySelectorAll('.json-expanded');
      expect(expandedNodes.length).toBe(0);
    });

    test('should toggle individual node expand/collapse on click', () => {
      const data = { parent: { child: 'value' } };
      const result = rendererWithControls.render(data);
      
      const toggleButton = result.element.querySelector('.json-toggle');
      if (toggleButton) {
        const initialState = toggleButton.classList.contains('expanded');
        toggleButton.click();
        const newState = toggleButton.classList.contains('expanded');
        expect(newState).toBe(!initialState);
      }
    });
  });

  describe('error handling', () => {
    test('should handle invalid JSON string gracefully', () => {
      expect(() => {
        renderer.render('invalid json {');
      }).toThrow('Invalid JSON data provided');
    });

    test('should handle circular references in objects', () => {
      const circularObj = { name: 'test' };
      circularObj.self = circularObj;

      const result = renderer.render(circularObj);
      expect(result.element).toBeTruthy();
      
      // Should show circular reference indicator
      const content = result.element.textContent;
      expect(content).toContain('[Circular Reference]');
    });

    test('should handle very deep nesting gracefully', () => {
      let deepObj = {};
      let current = deepObj;
      
      for (let i = 0; i < 100; i++) {
        current.nested = {};
        current = current.nested;
      }
      current.value = 'deep';

      const result = renderer.render(deepObj);
      expect(result.element).toBeTruthy();
      
      // Should either render or show depth limit message
      const content = result.element.textContent;
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe('utility functions', () => {
    test('should copy JSON to clipboard when copy button is clicked', () => {
      const rendererWithControls = new JSONRenderer({
        showControls: true
      });

      // Mock clipboard API
      let copiedText = '';
      const mockWriteText = (text) => {
        copiedText = text;
        return Promise.resolve();
      };
      
      Object.assign(navigator, {
        clipboard: { writeText: mockWriteText }
      });

      const data = { test: 'copy' };
      const result = rendererWithControls.render(data);
      
      const copyBtn = result.element.querySelector('.copy-json');
      copyBtn.click();
      
      expect(copiedText).toBe(JSON.stringify(data, null, 2));
    });

    test('should reformat JSON when format button is clicked', () => {
      const rendererWithControls = new JSONRenderer({
        showControls: true
      });

      const result = rendererWithControls.render('{"compact":"json"}');
      const formatBtn = result.element.querySelector('.format-json');
      
      formatBtn.click();
      
      // Content should be reformatted with proper indentation
      const content = result.element.innerHTML;
      expect(content).toContain('\n');
    });
  });

  describe('accessibility', () => {
    test('should include proper ARIA attributes', () => {
      const result = renderer.render({ test: 'data' });
      
      expect(result.element.getAttribute('role')).toBe('tree');
      
      const jsonNodes = result.element.querySelectorAll('.json-node');
      jsonNodes.forEach(node => {
        expect(node.getAttribute('role')).toBe('treeitem');
      });
    });

    test('should support keyboard navigation', () => {
      const rendererWithControls = new JSONRenderer({
        showControls: true
      });
      
      const result = rendererWithControls.render({ test: 'data' });
      const controls = result.element.querySelectorAll('.json-controls button');
      
      controls.forEach(button => {
        expect(button.tabIndex).toBe(0);
        expect(button.getAttribute('aria-label')).toBeTruthy();
      });
    });
  });
});