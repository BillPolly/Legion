/**
 * Unit tests for DOMTestGenerator
 */
import { describe, test, expect } from '@jest/globals';
import { DOMTestGenerator } from '../../../src/generators/DOMTestGenerator.js';

describe('DOMTestGenerator', () => {
  describe('generateTests', () => {
    test('should return empty array for component with no DOM structure', () => {
      const description = {
        domStructure: {
          total: 0,
          elements: []
        }
      };

      const tests = DOMTestGenerator.generateTests(description);
      expect(tests).toEqual([]);
    });

    test('should generate tests for element creation', () => {
      const description = {
        domStructure: {
          total: 2,
          hasHierarchy: 0,
          elements: [
            { type: 'creates', selector: '.terminal', attributes: { id: 'main-terminal' } },
            { type: 'creates', selector: 'input[type=text]', attributes: {} }
          ]
        }
      };

      const tests = DOMTestGenerator.generateTests(description);
      
      expect(tests.length).toBeGreaterThan(0);
      
      const testNames = tests.map(t => t.name);
      expect(testNames).toContain("should create element matching selector '.terminal'");
      expect(testNames).toContain("should set correct attributes on '.terminal'");
      expect(testNames).toContain("should create element matching selector 'input[type=text]'");
      expect(testNames).toContain('should create all required DOM elements');
    });

    test('should generate tests for element containment', () => {
      const description = {
        domStructure: {
          total: 1,
          hasHierarchy: 0,
          elements: [
            { type: 'contains', selector: '.output-area', attributes: {} }
          ]
        }
      };

      const tests = DOMTestGenerator.generateTests(description);
      
      const testNames = tests.map(t => t.name);
      expect(testNames).toContain("should contain element matching selector '.output-area'");
    });

    test('should generate hierarchy tests', () => {
      const description = {
        domStructure: {
          total: 2,
          hasHierarchy: 1,
          elements: [
            { type: 'creates', selector: '.terminal', attributes: {} },
            { type: 'creates', selector: 'input[type=text]', within: '.terminal', attributes: {} }
          ]
        }
      };

      const tests = DOMTestGenerator.generateTests(description);
      
      const testNames = tests.map(t => t.name);
      expect(testNames).toContain('should maintain correct DOM hierarchy');
    });
  });

  describe('generateElementTests', () => {
    test('should generate creation test for creates element', () => {
      const element = {
        type: 'creates',
        selector: '.test-element',
        attributes: {}
      };

      const tests = DOMTestGenerator.generateElementTests(element);
      
      expect(tests).toHaveLength(1);
      expect(tests[0].name).toBe("should create element matching selector '.test-element'");
      expect(tests[0].type).toBe('dom-creates');
    });

    test('should generate attribute test for element with attributes', () => {
      const element = {
        type: 'creates',
        selector: '.test-element',
        attributes: { id: 'test-id', 'data-test': 'value' }
      };

      const tests = DOMTestGenerator.generateElementTests(element);
      
      expect(tests).toHaveLength(2);
      expect(tests[0].name).toBe("should create element matching selector '.test-element'");
      expect(tests[1].name).toBe("should set correct attributes on '.test-element'");
      expect(tests[1].type).toBe('dom-attributes');
    });

    test('should generate containment test for contains element', () => {
      const element = {
        type: 'contains',
        selector: '.existing-element',
        attributes: {}
      };

      const tests = DOMTestGenerator.generateElementTests(element);
      
      expect(tests).toHaveLength(1);
      expect(tests[0].name).toBe("should contain element matching selector '.existing-element'");
      expect(tests[0].type).toBe('dom-contains');
    });
  });

  describe('generateHierarchyTests', () => {
    test('should generate hierarchy test for hierarchical elements', () => {
      const domStructure = {
        elements: [
          { type: 'creates', selector: '.parent', within: null },
          { type: 'creates', selector: '.child', within: '.parent' }
        ]
      };

      const tests = DOMTestGenerator.generateHierarchyTests(domStructure);
      
      expect(tests).toHaveLength(1);
      expect(tests[0].name).toBe('should maintain correct DOM hierarchy');
      expect(tests[0].type).toBe('dom-hierarchy');
    });

    test('should return empty array for non-hierarchical elements', () => {
      const domStructure = {
        elements: [
          { type: 'creates', selector: '.element1' },
          { type: 'creates', selector: '.element2' }
        ]
      };

      const tests = DOMTestGenerator.generateHierarchyTests(domStructure);
      expect(tests).toEqual([]);
    });
  });

  describe('generateIntegrationTests', () => {
    test('should generate integration test', () => {
      const domStructure = {
        total: 2,
        elements: [
          { type: 'creates', selector: '.element1' },
          { type: 'contains', selector: '.element2' }
        ]
      };

      const tests = DOMTestGenerator.generateIntegrationTests(domStructure);
      
      expect(tests).toHaveLength(1);
      expect(tests[0].name).toBe('should create all required DOM elements');
      expect(tests[0].type).toBe('dom-integration');
    });
  });

  describe('test execution', () => {
    const mockComponent = {
      describe: (d) => d.creates('.test-element'),
      create: (deps) => {
        if (!deps.dom) {
          throw new Error('dom is required');
        }
        
        // Simulate element creation
        const element = deps.dom.ownerDocument ? 
          deps.dom.ownerDocument.createElement('div') :
          { tagName: 'DIV', className: 'test-element', matches: (sel) => sel === '.test-element' };
        
        if (element.classList) {
          element.classList.add('test-element');
        } else {
          element.className = 'test-element';
        }
        
        deps.dom.appendChild(element);
        
        return { dependencies: deps, created: true };
      }
    };

    test('should execute element creation test', async () => {
      const element = {
        type: 'creates',
        selector: '.test-element',
        attributes: {}
      };

      const tests = DOMTestGenerator.generateElementTests(element);
      const creationTest = tests.find(t => t.type === 'dom-creates');
      
      const result = await creationTest.execute(mockComponent, {});
      
      expect(result.selector).toBe('.test-element');
      expect(result.elementFound).toBe(true);
      expect(result.elementCount).toBeGreaterThan(0);
    });

    test('should execute attribute test', async () => {
      const mockComponentWithAttrs = {
        describe: (d) => d.creates('.test-element'),
        create: (deps) => {
          const element = deps.dom.ownerDocument ?
            deps.dom.ownerDocument.createElement('div') :
            { 
              tagName: 'DIV', 
              className: 'test-element',
              id: 'test-id',
              attributes: new Map([['data-test', 'value']]),
              getAttribute: function(name) { return this.attributes.get(name) || this[name]; },
              matches: (sel) => sel === '.test-element'
            };
          
          if (element.classList) {
            element.classList.add('test-element');
            element.id = 'test-id';
            element.setAttribute('data-test', 'value');
          } else {
            element.className = 'test-element';
            element.getAttribute = function(name) {
              if (name === 'id') return 'test-id';
              if (name === 'data-test') return 'value';
              return null;
            };
          }
          
          deps.dom.appendChild(element);
          return { dependencies: deps, created: true };
        }
      };

      const element = {
        type: 'creates',
        selector: '.test-element',
        attributes: { id: 'test-id', 'data-test': 'value' }
      };

      const tests = DOMTestGenerator.generateElementTests(element);
      const attributeTest = tests.find(t => t.type === 'dom-attributes');
      
      const result = await attributeTest.execute(mockComponentWithAttrs, {});
      
      expect(result.selector).toBe('.test-element');
      expect(result.elementFound).toBe(true);
      expect(result.attributeResults.id.expected).toBe('test-id');
      expect(result.attributeResults.id.actual).toBe('test-id');
      expect(result.attributeResults.id.matches).toBe(true);
    });

    test('should execute containment test', async () => {
      const element = {
        type: 'contains',
        selector: '.existing-element',
        attributes: {}
      };

      const tests = DOMTestGenerator.generateElementTests(element);
      const containmentTest = tests.find(t => t.type === 'dom-contains');
      
      const result = await containmentTest.execute(mockComponent, {});
      
      expect(result.selector).toBe('.existing-element');
      expect(result.elementFound).toBe(true); // Should be created by createRequiredElements
    });

    test('should execute hierarchy test', async () => {
      const mockHierarchyComponent = {
        create: (deps) => {
          // Create parent
          const parent = deps.dom.ownerDocument ?
            deps.dom.ownerDocument.createElement('div') :
            { 
              className: 'parent',
              children: [],
              querySelector: function(sel) { return this.children.find(c => c.matches && c.matches(sel)); },
              appendChild: function(child) { this.children.push(child); }
            };
          
          if (parent.classList) {
            parent.classList.add('parent');
          } else {
            parent.className = 'parent';
            parent.matches = (sel) => sel === '.parent';
          }
          
          // Create child
          const child = deps.dom.ownerDocument ?
            deps.dom.ownerDocument.createElement('div') :
            { className: 'child', matches: (sel) => sel === '.child' };
          
          if (child.classList) {
            child.classList.add('child');
          } else {
            child.className = 'child';
          }
          
          parent.appendChild(child);
          deps.dom.appendChild(parent);
          
          return { dependencies: deps, created: true };
        }
      };

      const domStructure = {
        elements: [
          { type: 'creates', selector: '.parent' },
          { type: 'creates', selector: '.child', within: '.parent' }
        ]
      };

      const tests = DOMTestGenerator.generateHierarchyTests(domStructure);
      const hierarchyTest = tests[0];
      
      const result = await hierarchyTest.execute(mockHierarchyComponent, {});
      
      expect(result.hierarchyResults).toHaveLength(1);
      expect(result.hierarchyResults[0].selector).toBe('.child');
      expect(result.hierarchyResults[0].expectedParent).toBe('.parent');
      expect(result.hierarchyResults[0].parentFound).toBe(true);
      expect(result.hierarchyResults[0].childFoundInParent).toBe(true);
      expect(result.allHierarchiesCorrect).toBe(true);
    });

    test('should execute integration test', async () => {
      const domStructure = {
        total: 2,
        elements: [
          { type: 'creates', selector: '.element1' },
          { type: 'contains', selector: '.element2' }
        ]
      };

      const tests = DOMTestGenerator.generateIntegrationTests(domStructure);
      const integrationTest = tests[0];
      
      const result = await integrationTest.execute(mockComponent, {});
      
      expect(result.totalExpected).toBe(2);
      expect(result.createdElements).toHaveLength(1);
      expect(result.containedElements).toHaveLength(1);
      expect(result.totalFound).toBeGreaterThan(0);
    });
  });

  describe('utility methods', () => {
    describe('createTestContainer', () => {
      test('should create test container', () => {
        const container = DOMTestGenerator.createTestContainer();
        
        expect(container).toBeDefined();
        expect(container.id).toBe('test-container');
        expect(typeof container.querySelector).toBe('function');
        expect(typeof container.appendChild).toBe('function');
      });
    });

    describe('parseSelector', () => {
      test('should parse simple tag selector', () => {
        const result = DOMTestGenerator.parseSelector('div');
        
        expect(result.tagName).toBe('div');
        expect(result.id).toBeNull();
        expect(result.classes).toEqual([]);
        expect(result.attributes).toEqual({});
      });

      test('should parse class selector', () => {
        const result = DOMTestGenerator.parseSelector('.test-class');
        
        expect(result.tagName).toBe('div');
        expect(result.classes).toEqual(['test-class']);
      });

      test('should parse id selector', () => {
        const result = DOMTestGenerator.parseSelector('#test-id');
        
        expect(result.tagName).toBe('div');
        expect(result.id).toBe('test-id');
      });

      test('should parse attribute selector', () => {
        const result = DOMTestGenerator.parseSelector('input[type=text]');
        
        expect(result.tagName).toBe('input');
        expect(result.attributes.type).toBe('text');
      });

      test('should parse complex selector', () => {
        const result = DOMTestGenerator.parseSelector('input.test-class#test-id[type=text]');
        
        expect(result.tagName).toBe('input');
        expect(result.id).toBe('test-id');
        expect(result.classes).toEqual(['test-class']);
        expect(result.attributes.type).toBe('text');
      });
    });

    describe('serializeElement', () => {
      test('should serialize element', () => {
        const mockElement = {
          tagName: 'DIV',
          id: 'test-id',
          className: 'test-class',
          attributes: [
            { name: 'data-test', value: 'value' },
            { name: 'id', value: 'test-id' }
          ]
        };

        const result = DOMTestGenerator.serializeElement(mockElement);
        
        expect(result.tagName).toBe('div');
        expect(result.id).toBe('test-id');
        expect(result.className).toBe('test-class');
        expect(result.attributes['data-test']).toBe('value');
      });

      test('should return null for null element', () => {
        const result = DOMTestGenerator.serializeElement(null);
        expect(result).toBeNull();
      });
    });

    describe('elementMatchesSelector', () => {
      test('should match element to selector', () => {
        const mockElement = {
          tagName: 'DIV',
          id: 'test-id',
          className: 'test-class',
          matches: (sel) => sel === 'div.test-class#test-id'
        };

        const matches = DOMTestGenerator.elementMatchesSelector(mockElement, 'div.test-class#test-id');
        expect(matches).toBe(true);
      });

      test('should return false for non-matching element', () => {
        const mockElement = {
          tagName: 'DIV',
          id: 'test-id',
          className: 'test-class',
          matches: (sel) => false
        };

        const matches = DOMTestGenerator.elementMatchesSelector(mockElement, 'span');
        expect(matches).toBe(false);
      });

      test('should return false for null element', () => {
        const matches = DOMTestGenerator.elementMatchesSelector(null, 'div');
        expect(matches).toBe(false);
      });
    });
  });
});