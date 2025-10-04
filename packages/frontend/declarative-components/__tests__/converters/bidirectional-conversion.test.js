/**
 * Comprehensive test suite for bidirectional converters
 * Tests JSON ↔ DSL ↔ CNL conversions
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { JsonToDSLConverter, jsonToDSL } from '../../src/cnl/JsonToDSLConverter.js';
import { JsonToCNLConverter, jsonToCNL } from '../../src/cnl/JsonToCNLConverter.js';
import { ComponentCompiler } from '../../src/compiler/ComponentCompiler.js';
import { CNLParser } from '../../src/cnl/CNLParser.js';

describe('Bidirectional Converter Tests', () => {
  let compiler;
  let cnlParser;
  let jsonToDSLConverter;
  let jsonToCNLConverter;

  beforeAll(() => {
    compiler = new ComponentCompiler();
    cnlParser = new CNLParser();
    jsonToDSLConverter = new JsonToDSLConverter();
    jsonToCNLConverter = new JsonToCNLConverter();
  });

  describe('JSON to DSL Conversion', () => {
    it('should convert simple component with text binding', () => {
      const json = {
        name: 'SimpleDisplay',
        entity: 'data',
        structure: {
          root: {
            element: 'div',
            parent: null
          },
          root_child_0: {
            element: 'span',
            parent: 'root'
          }
        },
        bindings: [{
          source: 'data.message',
          target: 'root_child_0.textContent',
          transform: 'identity'
        }],
        events: []
      };

      const dsl = jsonToDSL(json);
      expect(dsl).toContain('SimpleDisplay :: data =>');
      expect(dsl).toContain('div [');
      expect(dsl).toContain('span { data.message }');
    });

    it('should convert component with classes and IDs', () => {
      const json = {
        name: 'StyledComponent',
        entity: 'state',
        structure: {
          root: {
            element: 'div',
            class: 'container primary',
            id: 'main-container',
            parent: null
          }
        },
        bindings: [],
        events: []
      };

      const dsl = jsonToDSL(json);
      expect(dsl).toContain('StyledComponent :: state =>');
      expect(dsl).toContain('div.container.primary#main-container');
    });

    it('should convert component with events', () => {
      const json = {
        name: 'InteractiveButton',
        entity: 'actions',
        structure: {
          root: {
            element: 'button',
            textContent: 'Click Me',
            parent: null
          }
        },
        bindings: [],
        events: [{
          element: 'root',
          event: 'click',
          action: 'actions.handleClick()',
          modifiers: []
        }]
      };

      const dsl = jsonToDSL(json);
      expect(dsl).toContain('button @click="actions.handleClick()"');
      expect(dsl).toContain('"Click Me"');
    });

    it('should convert nested components', () => {
      const json = {
        name: 'NestedStructure',
        entity: 'app',
        structure: {
          root: {
            element: 'div',
            parent: null
          },
          root_child_0: {
            element: 'header',
            parent: 'root'
          },
          root_child_0_child_0: {
            element: 'h1',
            textContent: 'Title',
            parent: 'root_child_0'
          },
          root_child_1: {
            element: 'main',
            parent: 'root'
          }
        },
        bindings: [],
        events: []
      };

      const dsl = jsonToDSL(json);
      expect(dsl).toContain('div [');
      expect(dsl).toContain('header [');
      expect(dsl).toContain('h1 { "Title" }');
      expect(dsl).toContain('main');
    });

    it('should handle event modifiers', () => {
      const json = {
        name: 'FormInput',
        entity: 'form',
        structure: {
          root: {
            element: 'input',
            parent: null
          }
        },
        bindings: [],
        events: [{
          element: 'root',
          event: 'keyup',
          action: 'form.submit()',
          modifiers: ['enter', 'prevent']
        }]
      };

      const dsl = jsonToDSL(json);
      expect(dsl).toContain('@keyup.enter.prevent="form.submit()"');
    });
  });

  describe('JSON to CNL Conversion', () => {
    it('should convert simple component to natural language', () => {
      const json = {
        name: 'SimpleDisplay',
        entity: 'data',
        structure: {
          root: {
            element: 'div',
            parent: null
          },
          root_child_0: {
            element: 'span',
            parent: 'root'
          }
        },
        bindings: [{
          source: 'data.message',
          target: 'root_child_0.textContent',
          transform: 'identity'
        }],
        events: []
      };

      const cnl = jsonToCNL(json);
      expect(cnl).toContain('Define SimpleDisplay with data:');
      expect(cnl).toContain('A container containing:');
      expect(cnl).toContain('A span showing the message');
    });

    it('should describe buttons with events', () => {
      const json = {
        name: 'ActionButton',
        entity: 'controller',
        structure: {
          root: {
            element: 'button',
            textContent: 'Save',
            class: 'btn-primary',
            parent: null
          }
        },
        bindings: [],
        events: [{
          element: 'root',
          event: 'click',
          action: 'controller.save()',
          modifiers: []
        }]
      };

      const cnl = jsonToCNL(json);
      expect(cnl).toContain('Define ActionButton with controller:');
      expect(cnl).toContain('A button with class "btn-primary"');
      expect(cnl).toContain('labeled "Save"');
      expect(cnl).toContain('that calls save on click');
    });

    it('should handle increment/decrement actions', () => {
      const json = {
        name: 'Counter',
        entity: 'counter',
        structure: {
          root: {
            element: 'div',
            parent: null
          },
          root_child_0: {
            element: 'button',
            textContent: '+',
            parent: 'root'
          },
          root_child_1: {
            element: 'button',
            textContent: '-',
            parent: 'root'
          }
        },
        bindings: [],
        events: [
          {
            element: 'root_child_0',
            event: 'click',
            action: 'counter.value++',
            modifiers: []
          },
          {
            element: 'root_child_1',
            event: 'click',
            action: 'counter.value--',
            modifiers: []
          }
        ]
      };

      const cnl = jsonToCNL(json);
      expect(cnl).toContain('increments the value on click');
      expect(cnl).toContain('decrements the value on click');
    });

    it('should describe form inputs', () => {
      const json = {
        name: 'SearchForm',
        entity: 'search',
        structure: {
          root: {
            element: 'form',
            parent: null
          },
          root_child_0: {
            element: 'input',
            parent: 'root',
            attributes: {
              type: 'text',
              placeholder: 'Search...'
            }
          }
        },
        bindings: [{
          source: 'search.query',
          target: 'root_child_0.value',
          transform: 'identity'
        }],
        events: []
      };

      const cnl = jsonToCNL(json);
      expect(cnl).toContain('A form containing:');
      expect(cnl).toContain('An input bound to the query');
    });
  });

  describe('DSL to JSON Compilation', () => {
    it('should compile DSL back to JSON', () => {
      const dsl = `Counter :: state =>
  div.container [
    h2 { state.count }
    button @click="state.count++" { "Increment" }
  ]`;

      const json = compiler.compile(dsl);
      
      expect(json.name).toBe('Counter');
      expect(json.entity).toBe('state');
      expect(json.structure.root.element).toBe('div');
      expect(json.structure.root.class).toBe('container');
      expect(json.events).toHaveLength(1);
      expect(json.events[0].action).toBe('state.count++');
    });

    it('should handle nested structures', () => {
      const dsl = `Layout :: page =>
  div [
    header [
      h1 { "Title" }
    ]
    main [
      p { page.content }
    ]
  ]`;

      const json = compiler.compile(dsl);
      
      expect(Object.keys(json.structure)).toHaveLength(5);
      expect(json.bindings).toHaveLength(1);
      expect(json.bindings[0].source).toBe('page.content');
    });
  });

  describe('CNL to JSON Parsing', () => {
    it('should parse CNL to JSON', () => {
      const cnl = `Define Counter with state:
  A container containing:
    A heading showing the count
    A button labeled "Plus" that increments the count on click`;

      const json = cnlParser.parse(cnl, {toJSON: true});

      expect(json.name).toBe('Counter');
      expect(json.entity).toBe('state');
      expect(json.structure.root.element).toBe('div');
      expect(json.events).toHaveLength(1);
      expect(json.events[0].action).toContain('++');
    });

    it('should parse CNL with classes', () => {
      const cnl = `Define Card with data:
  A container with class "card" containing:
    A heading with class "card-title" showing the title`;

      const json = cnlParser.parse(cnl, {toJSON: true});
      
      expect(json.structure.root.class).toBe('card');
      expect(json.structure.root_child_0.class).toBe('card-title');
    });
  });

  describe('Round-trip Conversions', () => {
    it('should maintain structure through JSON → DSL → JSON', () => {
      const originalJSON = {
        name: 'TestComponent',
        entity: 'data',
        structure: {
          root: {
            element: 'div',
            class: 'wrapper',
            parent: null
          },
          root_child_0: {
            element: 'span',
            parent: 'root'
          }
        },
        bindings: [{
          source: 'data.text',
          target: 'root_child_0.textContent',
          transform: 'identity'
        }],
        events: [{
          element: 'root',
          event: 'click',
          action: 'data.toggle()',
          modifiers: []
        }]
      };

      const dsl = jsonToDSL(originalJSON);
      const resultJSON = compiler.compile(dsl);
      
      expect(resultJSON.name).toBe(originalJSON.name);
      expect(resultJSON.entity).toBe(originalJSON.entity);
      expect(Object.keys(resultJSON.structure).length).toBe(Object.keys(originalJSON.structure).length);
      expect(resultJSON.bindings.length).toBe(originalJSON.bindings.length);
      expect(resultJSON.events.length).toBe(originalJSON.events.length);
    });

    it('should maintain structure through JSON → CNL → JSON', () => {
      const originalJSON = {
        name: 'SimpleButton',
        entity: 'app',
        structure: {
          root: {
            element: 'button',
            textContent: 'Click Me',
            class: 'btn',
            parent: null
          }
        },
        bindings: [],
        events: [{
          element: 'root',
          event: 'click',
          action: 'app.handleClick()',
          modifiers: []
        }]
      };

      const cnl = jsonToCNL(originalJSON);
      const resultJSON = cnlParser.parse(cnl, {toJSON: true});

      expect(resultJSON.name).toBe(originalJSON.name);
      expect(resultJSON.entity).toBe(originalJSON.entity);
      expect(resultJSON.structure.root.element).toBe('button');
      expect(resultJSON.events.length).toBe(1);
    });

    it('should handle complex round-trip with TodoItem', () => {
      const todoJSON = {
        name: 'TodoItem',
        entity: 'todo',
        structure: {
          root: {
            element: 'div',
            class: 'todo-item',
            parent: null
          },
          root_child_0: {
            element: 'input',
            parent: 'root',
            attributes: {
              type: 'checkbox'
            }
          },
          root_child_1: {
            element: 'span',
            class: 'todo-text',
            parent: 'root'
          },
          root_child_2: {
            element: 'button',
            textContent: 'Delete',
            class: 'delete-btn',
            parent: 'root'
          }
        },
        bindings: [
          {
            source: 'todo.completed',
            target: 'root_child_0.checked',
            transform: 'identity'
          },
          {
            source: 'todo.text',
            target: 'root_child_1.textContent',
            transform: 'identity'
          }
        ],
        events: [
          {
            element: 'root_child_0',
            event: 'change',
            action: 'todo.completed = !todo.completed',
            modifiers: []
          },
          {
            element: 'root_child_2',
            event: 'click',
            action: 'deleteTodo(todo.id)',
            modifiers: []
          }
        ]
      };

      // Test JSON → DSL → JSON
      const dsl = jsonToDSL(todoJSON);
      const dslResult = compiler.compile(dsl);
      
      expect(dslResult.name).toBe('TodoItem');
      expect(dslResult.bindings.length).toBe(2);
      expect(dslResult.events.length).toBe(2);
      
      // Test JSON → CNL → JSON
      const cnl = jsonToCNL(todoJSON);
      const cnlResult = cnlParser.parse(cnl, {toJSON: true});

      expect(cnlResult.name).toBe('TodoItem');
      expect(cnlResult.structure.root.class).toBe('todo-item');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty structure', () => {
      const emptyJSON = {
        name: 'Empty',
        entity: 'none',
        structure: {},
        bindings: [],
        events: []
      };

      const dsl = jsonToDSL(emptyJSON);
      expect(dsl).toBe('Empty :: none =>');
      
      const cnl = jsonToCNL(emptyJSON);
      expect(cnl).toBe('Define Empty with none:');
    });

    it('should throw error for missing name', () => {
      const invalidJSON = {
        entity: 'data',
        structure: {},
        bindings: [],
        events: []
      };

      expect(() => jsonToDSL(invalidJSON)).toThrow('JSON must have name and entity properties');
      expect(() => jsonToCNL(invalidJSON)).toThrow('JSON must have name and entity properties');
    });

    it('should throw error for missing entity', () => {
      const invalidJSON = {
        name: 'Test',
        structure: {},
        bindings: [],
        events: []
      };

      expect(() => jsonToDSL(invalidJSON)).toThrow('JSON must have name and entity properties');
      expect(() => jsonToCNL(invalidJSON)).toThrow('JSON must have name and entity properties');
    });

    it('should handle special characters in text content', () => {
      const json = {
        name: 'SpecialChars',
        entity: 'data',
        structure: {
          root: {
            element: 'div',
            textContent: 'Text with "quotes" and \'apostrophes\'',
            parent: null
          }
        },
        bindings: [],
        events: []
      };

      const dsl = jsonToDSL(json);
      expect(dsl).toContain('"Text with \\"quotes\\" and \'apostrophes\'"');
    });

    it('should handle deeply nested structures', () => {
      const deepJSON = {
        name: 'DeepNested',
        entity: 'deep',
        structure: {
          root: { element: 'div', parent: null },
          level1: { element: 'div', parent: 'root' },
          level2: { element: 'div', parent: 'level1' },
          level3: { element: 'div', parent: 'level2' },
          level4: { element: 'span', textContent: 'Deep', parent: 'level3' }
        },
        bindings: [],
        events: []
      };

      const dsl = jsonToDSL(deepJSON);
      expect(dsl.split('[').length - 1).toBe(4); // 4 opening brackets for nesting
      
      const cnl = jsonToCNL(deepJSON);
      expect(cnl.split('containing:').length - 1).toBe(4); // 4 levels of containing
    });

    it('should handle multiple classes correctly', () => {
      const json = {
        name: 'MultiClass',
        entity: 'ui',
        structure: {
          root: {
            element: 'div',
            class: 'btn btn-primary btn-large active',
            parent: null
          }
        },
        bindings: [],
        events: []
      };

      const dsl = jsonToDSL(json);
      expect(dsl).toContain('div.btn.btn-primary.btn-large.active');
      
      const cnl = jsonToCNL(json);
      expect(cnl).toContain('with class "btn btn-primary btn-large active"');
    });
  });

  describe('Complex Real-world Scenarios', () => {
    it('should handle a complete form component', () => {
      const formJSON = {
        name: 'ContactForm',
        entity: 'form',
        structure: {
          root: {
            element: 'form',
            class: 'contact-form',
            parent: null
          },
          root_child_0: {
            element: 'label',
            textContent: 'Name:',
            parent: 'root'
          },
          root_child_1: {
            element: 'input',
            parent: 'root',
            attributes: {
              type: 'text',
              name: 'name'
            }
          },
          root_child_2: {
            element: 'label',
            textContent: 'Email:',
            parent: 'root'
          },
          root_child_3: {
            element: 'input',
            parent: 'root',
            attributes: {
              type: 'email',
              name: 'email'
            }
          },
          root_child_4: {
            element: 'button',
            textContent: 'Submit',
            parent: 'root',
            attributes: {
              type: 'submit'
            }
          }
        },
        bindings: [
          {
            source: 'form.name',
            target: 'root_child_1.value',
            transform: 'identity'
          },
          {
            source: 'form.email',
            target: 'root_child_3.value',
            transform: 'identity'
          }
        ],
        events: [
          {
            element: 'root',
            event: 'submit',
            action: 'form.handleSubmit()',
            modifiers: ['prevent']
          }
        ]
      };

      // Test all conversions
      const dsl = jsonToDSL(formJSON);
      expect(dsl).toContain('ContactForm :: form =>');
      expect(dsl).toContain('@submit.prevent="form.handleSubmit()"');
      
      const cnl = jsonToCNL(formJSON);
      expect(cnl).toContain('A form with class "contact-form"');
      expect(cnl).toContain('calls handleSubmit on submit');
      
      // Round-trip test
      const compiledFromDSL = compiler.compile(dsl);
      expect(compiledFromDSL.bindings.length).toBe(2);
      expect(compiledFromDSL.events.length).toBe(1);
    });

    it('should handle a data grid component', () => {
      const gridJSON = {
        name: 'DataGrid',
        entity: 'grid',
        structure: {
          root: {
            element: 'table',
            class: 'data-grid',
            parent: null
          },
          root_child_0: {
            element: 'thead',
            parent: 'root'
          },
          root_child_0_child_0: {
            element: 'tr',
            parent: 'root_child_0'
          },
          root_child_0_child_0_child_0: {
            element: 'th',
            textContent: 'Name',
            parent: 'root_child_0_child_0'
          },
          root_child_0_child_0_child_1: {
            element: 'th',
            textContent: 'Value',
            parent: 'root_child_0_child_0'
          },
          root_child_1: {
            element: 'tbody',
            parent: 'root'
          }
        },
        bindings: [],
        events: []
      };

      const dsl = jsonToDSL(gridJSON);
      expect(dsl).toContain('table.data-grid');
      expect(dsl).toContain('thead');
      expect(dsl).toContain('tbody');
      
      const cnl = jsonToCNL(gridJSON);
      expect(cnl).toContain('A table with class "data-grid"');
    });
  });
});