/**
 * YamlRenderer Tests
 * 
 * Testing YamlRenderer class for YAML object rendering with nested structures and arrays
 */

import { YamlRenderer } from '../../../../../../src/components/tree-scribe/features/rendering/renderers/YamlRenderer.js';

describe('YamlRenderer', () => {
  let renderer;
  let container;

  beforeEach(() => {
    renderer = new YamlRenderer();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Content Type Detection', () => {
    test('should identify YAML content correctly', () => {
      expect(renderer.canRender('yaml')).toBe(true);
      expect(renderer.canRender('yml')).toBe(true);
      expect(renderer.canRender('text/yaml')).toBe(true);
      expect(renderer.canRender('application/yaml')).toBe(true);
    });

    test('should reject non-YAML content types', () => {
      expect(renderer.canRender('markdown')).toBe(false);
      expect(renderer.canRender('html')).toBe(false);
      expect(renderer.canRender('json')).toBe(false);
      expect(renderer.canRender('plaintext')).toBe(false);
    });

    test('should be case insensitive for content types', () => {
      expect(renderer.canRender('YAML')).toBe(true);
      expect(renderer.canRender('Yaml')).toBe(true);
      expect(renderer.canRender('YML')).toBe(true);
    });

    test('should handle null and undefined content types', () => {
      expect(renderer.canRender(null)).toBe(false);
      expect(renderer.canRender(undefined)).toBe(false);
      expect(renderer.canRender('')).toBe(false);
    });
  });

  describe('Object Rendering', () => {
    test('should render simple YAML objects', () => {
      const yamlObject = {
        title: 'Test Document',
        version: '1.0.0',
        description: 'A simple test document'
      };
      
      renderer.render(yamlObject, container);
      
      const yamlContent = container.querySelector('.yaml-content');
      expect(yamlContent).toBeDefined();
      
      const properties = yamlContent.querySelectorAll('.yaml-property');
      expect(properties.length).toBe(3);
      
      expect(yamlContent.textContent).toContain('title');
      expect(yamlContent.textContent).toContain('Test Document');
      expect(yamlContent.textContent).toContain('version');
      expect(yamlContent.textContent).toContain('1.0.0');
    });

    test('should render nested objects with proper indentation', () => {
      const yamlObject = {
        config: {
          database: {
            host: 'localhost',
            port: 5432,
            name: 'testdb'
          },
          cache: {
            enabled: true,
            ttl: 3600
          }
        }
      };
      
      renderer.render(yamlObject, container);
      
      const yamlContent = container.querySelector('.yaml-content');
      const nestedObjects = yamlContent.querySelectorAll('.yaml-object');
      expect(nestedObjects.length).toBeGreaterThan(1);
      
      // Check indentation levels
      const level1 = yamlContent.querySelector('[data-depth="1"]');
      const level2 = yamlContent.querySelector('[data-depth="2"]');
      expect(level1).toBeDefined();
      expect(level2).toBeDefined();
    });

    test('should handle deeply nested structures', () => {
      const yamlObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep nesting test'
              }
            }
          }
        }
      };
      
      renderer.render(yamlObject, container);
      
      const yamlContent = container.querySelector('.yaml-content');
      const deepElement = yamlContent.querySelector('[data-depth="4"]');
      expect(deepElement).toBeDefined();
      expect(yamlContent.textContent).toContain('deep nesting test');
    });

    test('should render empty objects correctly', () => {
      const yamlObject = {
        empty: {},
        filled: { value: 'test' }
      };
      
      renderer.render(yamlObject, container);
      
      const yamlContent = container.querySelector('.yaml-content');
      expect(yamlContent.textContent).toContain('empty');
      expect(yamlContent.textContent).toContain('{}');
    });
  });

  describe('Array Rendering', () => {
    test('should render simple arrays', () => {
      const yamlObject = {
        items: ['apple', 'banana', 'cherry'],
        numbers: [1, 2, 3, 4, 5]
      };
      
      renderer.render(yamlObject, container);
      
      const yamlContent = container.querySelector('.yaml-content');
      const arrayElements = yamlContent.querySelectorAll('.yaml-array');
      expect(arrayElements.length).toBe(2);
      
      expect(yamlContent.textContent).toContain('apple');
      expect(yamlContent.textContent).toContain('banana');
      expect(yamlContent.textContent).toContain('cherry');
    });

    test('should render arrays of objects', () => {
      const yamlObject = {
        users: [
          { name: 'John', age: 30 },
          { name: 'Jane', age: 25 },
          { name: 'Bob', age: 35 }
        ]
      };
      
      renderer.render(yamlObject, container);
      
      const yamlContent = container.querySelector('.yaml-content');
      const arrayItems = yamlContent.querySelectorAll('.yaml-array-item');
      expect(arrayItems.length).toBe(3);
      
      expect(yamlContent.textContent).toContain('John');
      expect(yamlContent.textContent).toContain('Jane');
      expect(yamlContent.textContent).toContain('Bob');
    });

    test('should render nested arrays', () => {
      const yamlObject = {
        matrix: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9]
        ]
      };
      
      renderer.render(yamlObject, container);
      
      const yamlContent = container.querySelector('.yaml-content');
      const nestedArrays = yamlContent.querySelectorAll('.yaml-array .yaml-array');
      expect(nestedArrays.length).toBe(3);
    });

    test('should handle empty arrays correctly', () => {
      const yamlObject = {
        empty: [],
        filled: ['item1', 'item2']
      };
      
      renderer.render(yamlObject, container);
      
      const yamlContent = container.querySelector('.yaml-content');
      expect(yamlContent.textContent).toContain('empty');
      expect(yamlContent.textContent).toContain('[]');
    });
  });

  describe('Primitive Value Rendering', () => {
    test('should render different data types correctly', () => {
      const yamlObject = {
        stringValue: 'Hello World',
        numberValue: 42,
        booleanTrue: true,
        booleanFalse: false,
        nullValue: null,
        undefinedValue: undefined
      };
      
      renderer.render(yamlObject, container);
      
      const yamlContent = container.querySelector('.yaml-content');
      
      // Check string rendering
      const stringElement = yamlContent.querySelector('.yaml-string');
      expect(stringElement).toBeDefined();
      expect(stringElement.textContent).toContain('Hello World');
      
      // Check number rendering
      const numberElement = yamlContent.querySelector('.yaml-number');
      expect(numberElement).toBeDefined();
      expect(numberElement.textContent).toContain('42');
      
      // Check boolean rendering
      const booleanElements = yamlContent.querySelectorAll('.yaml-boolean');
      expect(booleanElements.length).toBe(2);
      
      // Check null rendering
      const nullElement = yamlContent.querySelector('.yaml-null');
      expect(nullElement).toBeDefined();
    });

    test('should handle special string values', () => {
      const yamlObject = {
        emptyString: '',
        whitespaceString: '   ',
        multilineString: 'Line 1\nLine 2\nLine 3',
        specialChars: 'Special: @#$%^&*()'
      };
      
      renderer.render(yamlObject, container);
      
      const yamlContent = container.querySelector('.yaml-content');
      expect(yamlContent.textContent).toContain('emptyString');
      expect(yamlContent.textContent).toContain('multilineString');
      expect(yamlContent.textContent).toContain('Special: @#$%^&*()');
    });

    test('should handle numeric edge cases', () => {
      const yamlObject = {
        zero: 0,
        negative: -42,
        float: 3.14159,
        scientific: 1.23e-4,
        infinity: Infinity,
        negativeInfinity: -Infinity,
        notANumber: NaN
      };
      
      renderer.render(yamlObject, container);
      
      const yamlContent = container.querySelector('.yaml-content');
      const numberElements = yamlContent.querySelectorAll('.yaml-number');
      expect(numberElements.length).toBeGreaterThan(0);
      
      expect(yamlContent.textContent).toContain('3.14159');
      expect(yamlContent.textContent).toContain('-42');
    });
  });

  describe('Interactive Features', () => {
    test('should make nested structures collapsible', () => {
      const yamlObject = {
        collapsible: {
          nested: {
            data: 'value'
          }
        }
      };
      
      renderer.render(yamlObject, container);
      
      const toggleButtons = container.querySelectorAll('.yaml-toggle');
      expect(toggleButtons.length).toBeGreaterThan(0);
      
      // Test toggle functionality
      const firstToggle = toggleButtons[0];
      firstToggle.click();
      
      const collapsibleContent = container.querySelector('.yaml-collapsible');
      expect(collapsibleContent.classList.contains('collapsed')).toBe(true);
    });

    test('should expand and collapse arrays', () => {
      const yamlObject = {
        longArray: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      };
      
      renderer.render(yamlObject, container);
      
      const arrayToggle = container.querySelector('.yaml-array .yaml-toggle');
      expect(arrayToggle).toBeDefined();
      
      arrayToggle.click();
      
      const arrayContent = container.querySelector('.yaml-array-items');
      expect(arrayContent.classList.contains('collapsed')).toBe(true);
    });

    test('should show item counts for collapsed structures', () => {
      const yamlObject = {
        manyItems: {
          item1: 'value1',
          item2: 'value2',
          item3: 'value3',
          item4: 'value4',
          item5: 'value5'
        }
      };
      
      renderer.render(yamlObject, container);
      
      const toggle = container.querySelector('.yaml-toggle');
      toggle.click();
      
      const countIndicator = container.querySelector('.yaml-count');
      expect(countIndicator).toBeDefined();
      expect(countIndicator.textContent).toContain('5');
    });

    test('should handle deeply nested toggle states independently', () => {
      const yamlObject = {
        level1: {
          level2a: {
            data: 'a'
          },
          level2b: {
            data: 'b'
          }
        }
      };
      
      renderer.render(yamlObject, container);
      
      const toggles = container.querySelectorAll('.yaml-toggle');
      expect(toggles.length).toBeGreaterThan(1);
      
      // Toggle first nested structure
      toggles[1].click();
      
      // Check that only one structure is collapsed
      const collapsedElements = container.querySelectorAll('.collapsed');
      expect(collapsedElements.length).toBe(1);
    });
  });

  describe('Visual Formatting', () => {
    test('should apply different styles for different data types', () => {
      const yamlObject = {
        stringValue: 'text',
        numberValue: 123,
        booleanValue: true,
        nullValue: null,
        objectValue: { nested: 'data' },
        arrayValue: [1, 2, 3]
      };
      
      renderer.render(yamlObject, container);
      
      const yamlContent = container.querySelector('.yaml-content');
      
      expect(yamlContent.querySelector('.yaml-string')).toBeDefined();
      expect(yamlContent.querySelector('.yaml-number')).toBeDefined();
      expect(yamlContent.querySelector('.yaml-boolean')).toBeDefined();
      expect(yamlContent.querySelector('.yaml-null')).toBeDefined();
      expect(yamlContent.querySelector('.yaml-object')).toBeDefined();
      expect(yamlContent.querySelector('.yaml-array')).toBeDefined();
    });

    test('should apply proper indentation for nested levels', () => {
      const yamlObject = {
        level0: {
          level1: {
            level2: {
              level3: 'deep'
            }
          }
        }
      };
      
      renderer.render(yamlObject, container);
      
      const level0 = container.querySelector('[data-depth="0"]');
      const level1 = container.querySelector('[data-depth="1"]');
      const level2 = container.querySelector('[data-depth="2"]');
      const level3 = container.querySelector('[data-depth="3"]');
      
      expect(level0).toBeDefined();
      expect(level1).toBeDefined();
      expect(level2).toBeDefined();
      expect(level3).toBeDefined();
    });

    test('should handle theme configuration', () => {
      const darkRenderer = new YamlRenderer({ theme: 'dark' });
      const yamlObject = { test: 'value' };
      
      darkRenderer.render(yamlObject, container);
      
      const yamlContent = container.querySelector('.yaml-content');
      expect(yamlContent.classList.contains('theme-dark')).toBe(true);
    });

    test('should support custom formatting options', () => {
      const customRenderer = new YamlRenderer({
        maxArrayPreview: 3,
        maxObjectPreview: 2,
        showTypeAnnotations: true
      });
      
      const yamlObject = {
        longArray: [1, 2, 3, 4, 5, 6],
        bigObject: { a: 1, b: 2, c: 3, d: 4 }
      };
      
      customRenderer.render(yamlObject, container);
      
      expect(customRenderer.options.maxArrayPreview).toBe(3);
      expect(customRenderer.options.maxObjectPreview).toBe(2);
      expect(customRenderer.options.showTypeAnnotations).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle circular references gracefully', () => {
      const yamlObject = { name: 'test' };
      yamlObject.self = yamlObject; // Circular reference
      
      expect(() => {
        renderer.render(yamlObject, container);
      }).not.toThrow();
      
      const yamlContent = container.querySelector('.yaml-content');
      expect(yamlContent).toBeDefined();
      expect(yamlContent.textContent).toContain('[Circular Reference]');
    });

    test('should handle extremely deep nesting', () => {
      let deepObject = { value: 'deep' };
      for (let i = 0; i < 100; i++) {
        deepObject = { level: i, nested: deepObject };
      }
      
      expect(() => {
        renderer.render(deepObject, container);
      }).not.toThrow();
      
      const yamlContent = container.querySelector('.yaml-content');
      expect(yamlContent).toBeDefined();
    });

    test('should handle invalid content gracefully', () => {
      const invalidInputs = [
        undefined,
        null,
        '',
        function() {},
        Symbol('test'),
        new Date()
      ];
      
      invalidInputs.forEach(input => {
        expect(() => {
          renderer.render(input, container);
        }).not.toThrow();
      });
    });

    test('should handle container validation errors', () => {
      const yamlObject = { test: 'value' };
      
      expect(() => {
        renderer.render(yamlObject, null);
      }).toThrow('Container is required for rendering');
      
      expect(() => {
        renderer.render(yamlObject, 'not-a-dom-element');
      }).toThrow('Container must be a DOM element');
    });

    test('should handle rendering errors gracefully', () => {
      const yamlObject = { test: 'value' };
      
      // Mock a rendering error by temporarily breaking document.createElement
      const originalCreateElement = document.createElement;
      document.createElement = () => {
        throw new Error('DOM creation failed');
      };
      
      expect(() => {
        renderer.render(yamlObject, container);
      }).toThrow('Failed to render YAML content');
      
      // Restore original method
      document.createElement = originalCreateElement;
    });
  });

  describe('Performance', () => {
    test('should render large YAML objects efficiently', () => {
      const largeObject = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`property${i}`] = {
          value: i,
          description: `Property number ${i}`,
          metadata: {
            created: new Date().toISOString(),
            modified: new Date().toISOString()
          }
        };
      }
      
      const startTime = Date.now();
      renderer.render(largeObject, container);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should render in less than 1 second
      
      const yamlContent = container.querySelector('.yaml-content');
      expect(yamlContent).toBeDefined();
      expect(yamlContent.children.length).toBeGreaterThan(0);
    });

    test('should not leak memory with repeated renders', () => {
      const yamlObject = {
        test: 'value',
        nested: { data: 'test' }
      };
      
      for (let i = 0; i < 50; i++) {
        renderer.render(yamlObject, container);
      }
      
      // Should only have one content div (previous ones cleaned up)
      const yamlDivs = container.querySelectorAll('.yaml-content');
      expect(yamlDivs.length).toBe(1);
    });

    test('should handle complex nested structures efficiently', () => {
      const complexObject = {
        configurations: {},
        data: [],
        metadata: {}
      };
      
      // Build complex nested structure
      for (let i = 0; i < 100; i++) {
        complexObject.configurations[`config${i}`] = {
          settings: { value: i },
          options: [i, i * 2, i * 3]
        };
        complexObject.data.push({ id: i, values: [i, i + 1, i + 2] });
        complexObject.metadata[`meta${i}`] = `metadata for ${i}`;
      }
      
      const startTime = Date.now();
      renderer.render(complexObject, container);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(500); // Should be fast
      
      const yamlContent = container.querySelector('.yaml-content');
      expect(yamlContent).toBeDefined();
    });
  });

  describe('Renderer Information', () => {
    test('should provide correct renderer name', () => {
      expect(renderer.getName()).toBe('YamlRenderer');
    });

    test('should provide renderer version', () => {
      expect(renderer.getVersion()).toBeDefined();
      expect(typeof renderer.getVersion()).toBe('string');
    });

    test('should provide supported content types', () => {
      const supportedTypes = renderer.getSupportedTypes();
      
      expect(Array.isArray(supportedTypes)).toBe(true);
      expect(supportedTypes).toContain('yaml');
      expect(supportedTypes).toContain('yml');
      expect(supportedTypes).toContain('text/yaml');
      expect(supportedTypes).toContain('application/yaml');
    });

    test('should provide renderer description', () => {
      const description = renderer.getDescription();
      
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
      expect(description.toLowerCase()).toContain('yaml');
    });
  });
});