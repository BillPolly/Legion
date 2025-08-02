/**
 * Unit tests for JSOMValidator
 */
import { describe, test, expect, jest } from '@jest/globals';
import { JSOMValidator } from '../../../src/validators/JSOMValidator.js';

describe('JSOMValidator', () => {
  describe('createTestEnvironment', () => {
    test('should create complete test environment', () => {
      const environment = JSOMValidator.createTestEnvironment();
      
      expect(environment.dom).toBeDefined();
      expect(environment.eventSystem).toBeDefined();
      expect(environment.actorSpace).toBeDefined();
      expect(environment.dependencies).toBeDefined();
      expect(environment.options).toBeDefined();
      
      expect(environment.options.timeout).toBe(5000);
      expect(environment.options.strictMode).toBe(true);
    });

    test('should accept custom options', () => {
      const options = { timeout: 10000, strictMode: false, customOption: true };
      const environment = JSOMValidator.createTestEnvironment(options);
      
      expect(environment.options.timeout).toBe(10000);
      expect(environment.options.strictMode).toBe(false);
      expect(environment.options.customOption).toBe(true);
    });
  });

  describe('createDOMContainer', () => {
    test('should create DOM container', () => {
      const container = JSOMValidator.createDOMContainer();
      
      expect(container.id).toBe('jsdom-test-container');
      expect(container.className).toBe('jsdom-validation-container');
      expect(typeof container.querySelector).toBe('function');
      expect(typeof container.appendChild).toBe('function');
      expect(typeof container.removeChild).toBe('function');
    });

    test('should support DOM operations', () => {
      const container = JSOMValidator.createDOMContainer();
      
      // In non-JSDOM environment, we get a mock container
      if (typeof document === 'undefined') {
        // Mock child element for mock container
        const child = {
          id: 'test-child',
          matches: (selector) => selector === '#test-child',
          parentNode: null
        };
        
        container.appendChild(child);
        expect(container.children).toContain(child);
        expect(child.parentNode).toBe(container);
        
        const found = container.querySelector('#test-child');
        expect(found).toBe(child);
        
        container.removeChild(child);
        expect(container.children).not.toContain(child);
        expect(child.parentNode).toBeNull();
      } else {
        // Real JSDOM environment
        const child = document.createElement('div');
        child.id = 'test-child';
        
        container.appendChild(child);
        expect(container.children).toContain(child);
        expect(child.parentNode).toBe(container);
        
        const found = container.querySelector('#test-child');
        expect(found).toBe(child);
        
        container.removeChild(child);
        expect(container.children).not.toContain(child);
        expect(child.parentNode).toBeNull();
      }
    });
  });

  describe('createEventSystem', () => {
    test('should create event system', () => {
      const eventSystem = JSOMValidator.createEventSystem();
      
      expect(typeof eventSystem.addEventListener).toBe('function');
      expect(typeof eventSystem.removeEventListener).toBe('function');
      expect(typeof eventSystem.dispatchEvent).toBe('function');
      expect(typeof eventSystem.getEventHistory).toBe('function');
      expect(typeof eventSystem.clearEventHistory).toBe('function');
    });

    test('should handle event listeners', () => {
      const eventSystem = JSOMValidator.createEventSystem();
      let receivedEvent = null;
      
      const handler = (event) => { receivedEvent = event; };
      eventSystem.addEventListener('test-event', handler);
      
      const event = eventSystem.dispatchEvent('test-event', { data: 'test' });
      
      expect(receivedEvent).toBe(event);
      expect(event.type).toBe('test-event');
      expect(event.data).toEqual({ data: 'test' });
      expect(event.timestamp).toBeDefined();
    });

    test('should track event history', () => {
      const eventSystem = JSOMValidator.createEventSystem();
      
      eventSystem.dispatchEvent('event1', { data: 'first' });
      eventSystem.dispatchEvent('event2', { data: 'second' });
      
      const history = eventSystem.getEventHistory();
      expect(history).toHaveLength(2);
      expect(history[0].type).toBe('event1');
      expect(history[1].type).toBe('event2');
      
      eventSystem.clearEventHistory();
      expect(eventSystem.getEventHistory()).toHaveLength(0);
    });

    test('should remove event listeners', () => {
      const eventSystem = JSOMValidator.createEventSystem();
      let callCount = 0;
      
      const handler = () => { callCount++; };
      eventSystem.addEventListener('test-event', handler);
      
      eventSystem.dispatchEvent('test-event', {});
      expect(callCount).toBe(1);
      
      eventSystem.removeEventListener('test-event', handler);
      eventSystem.dispatchEvent('test-event', {});
      expect(callCount).toBe(1); // Should not increase
    });
  });

  describe('createMockActorSpace', () => {
    test('should create mock actor space', () => {
      const actorSpace = JSOMValidator.createMockActorSpace();
      
      expect(typeof actorSpace.registerActor).toBe('function');
      expect(typeof actorSpace.sendMessage).toBe('function');
      expect(typeof actorSpace.getMessageHistory).toBe('function');
      expect(typeof actorSpace.clearMessageHistory).toBe('function');
      expect(typeof actorSpace.getActor).toBe('function');
    });

    test('should register and retrieve actors', () => {
      const actorSpace = JSOMValidator.createMockActorSpace();
      const mockActor = { receive: jest.fn() };
      
      actorSpace.registerActor('test-actor', mockActor);
      
      const retrievedActor = actorSpace.getActor('test-actor');
      expect(retrievedActor).toBe(mockActor);
    });

    test('should send messages to actors', () => {
      const actorSpace = JSOMValidator.createMockActorSpace();
      const mockActor = { receive: jest.fn() };
      
      actorSpace.registerActor('test-actor', mockActor);
      
      const message = actorSpace.sendMessage('test-actor', 'test-message', { data: 'test' });
      
      expect(message.to).toBe('test-actor');
      expect(message.type).toBe('test-message');
      expect(message.payload).toEqual({ data: 'test' });
      expect(message.timestamp).toBeDefined();
      
      expect(mockActor.receive).toHaveBeenCalledWith(message);
    });

    test('should track message history', () => {
      const actorSpace = JSOMValidator.createMockActorSpace();
      
      actorSpace.sendMessage('actor1', 'message1', { data: 'first' });
      actorSpace.sendMessage('actor2', 'message2', { data: 'second' });
      
      const history = actorSpace.getMessageHistory();
      expect(history).toHaveLength(2);
      expect(history[0].to).toBe('actor1');
      expect(history[1].to).toBe('actor2');
      
      actorSpace.clearMessageHistory();
      expect(actorSpace.getMessageHistory()).toHaveLength(0);
    });
  });

  describe('validateCreatedElement', () => {
    test('should validate element existence', () => {
      const container = JSOMValidator.createDOMContainer();
      const element = { selector: '.test-element', attributes: {} };
      
      if (typeof document === 'undefined') {
        // Mock DOM environment
        const mockElement = {
          matches: (sel) => sel === '.test-element',
          getAttribute: () => null
        };
        container.children.push(mockElement);
        container.mockQuerySelector = (sel) => sel === '.test-element' ? mockElement : null;
      } else {
        // Real JSDOM environment
        const mockElement = document.createElement('div');
        mockElement.className = 'test-element';
        container.appendChild(mockElement);
      }
      
      const result = JSOMValidator.validateCreatedElement(container, element);
      
      expect(result.selector).toBe('.test-element');
      expect(result.found).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('should detect missing elements', () => {
      const container = JSOMValidator.createDOMContainer();
      const element = { selector: '.missing-element', attributes: {} };
      
      const result = JSOMValidator.validateCreatedElement(container, element);
      
      expect(result.selector).toBe('.missing-element');
      expect(result.found).toBe(false);
    });

    test('should validate element attributes', () => {
      const container = JSOMValidator.createDOMContainer();
      const element = { 
        selector: '.test-element', 
        attributes: { id: 'test-id', 'data-test': 'value' }
      };
      
      if (typeof document === 'undefined') {
        // Mock DOM environment
        const mockElement = {
          matches: (sel) => sel === '.test-element',
          getAttribute: (attr) => {
            if (attr === 'id') return 'test-id';
            if (attr === 'data-test') return 'wrong-value';
            return null;
          }
        };
        container.children.push(mockElement);
        container.mockQuerySelector = (sel) => sel === '.test-element' ? mockElement : null;
      } else {
        // Real JSDOM environment
        const mockElement = document.createElement('div');
        mockElement.className = 'test-element';
        mockElement.id = 'test-id';
        mockElement.setAttribute('data-test', 'wrong-value');
        container.appendChild(mockElement);
      }
      
      const result = JSOMValidator.validateCreatedElement(container, element);
      
      expect(result.found).toBe(true);
      expect(result.attributes.id.matches).toBe(true);
      expect(result.attributes['data-test'].matches).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('ATTRIBUTE_MISMATCH');
    });
  });

  describe('validateDOMHierarchy', () => {
    test('should validate correct hierarchy', () => {
      const container = JSOMValidator.createDOMContainer();
      const domStructure = {
        elements: [
          { selector: '.parent', within: null },
          { selector: '.child', within: '.parent' }
        ]
      };
      
      if (typeof document === 'undefined') {
        // Mock DOM environment
        const parent = {
          matches: (sel) => sel === '.parent',
          querySelector: (sel) => sel === '.child' ? child : null,
          children: []
        };
        const child = {
          matches: (sel) => sel === '.child'
        };
        parent.children.push(child);
        
        container.children.push(parent);
        container.mockQuerySelector = (sel) => sel === '.parent' ? parent : null;
      } else {
        // Real JSDOM environment
        const parent = document.createElement('div');
        parent.className = 'parent';
        const child = document.createElement('div');
        child.className = 'child';
        parent.appendChild(child);
        container.appendChild(parent);
      }
      
      const result = JSOMValidator.validateDOMHierarchy(container, domStructure);
      
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('should detect missing parent elements', () => {
      const container = JSOMValidator.createDOMContainer();
      const domStructure = {
        elements: [
          { selector: '.child', within: '.missing-parent' }
        ]
      };
      
      const result = JSOMValidator.validateDOMHierarchy(container, domStructure);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('MISSING_PARENT');
      expect(result.issues[0].child).toBe('.child');
      expect(result.issues[0].parent).toBe('.missing-parent');
    });

    test('should detect child not in parent', () => {
      const container = JSOMValidator.createDOMContainer();
      const domStructure = {
        elements: [
          { selector: '.child', within: '.parent' }
        ]
      };
      
      if (typeof document === 'undefined') {
        // Mock DOM environment - Parent exists but child is not within it
        const parent = {
          matches: (sel) => sel === '.parent',
          querySelector: (sel) => null // Child not found in parent
        };
        
        container.children.push(parent);
        container.mockQuerySelector = (sel) => sel === '.parent' ? parent : null;
      } else {
        // Real JSDOM environment
        const parent = document.createElement('div');
        parent.className = 'parent';
        // Don't add child to parent
        container.appendChild(parent);
      }
      
      const result = JSOMValidator.validateDOMHierarchy(container, domStructure);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('CHILD_NOT_IN_PARENT');
    });
  });

  describe('createComponentInEnvironment', () => {
    test('should create component with environment dependencies', async () => {
      const mockComponent = {
        create: (deps) => ({
          dependencies: deps,
          created: true
        })
      };
      
      const testEnvironment = JSOMValidator.createTestEnvironment();
      
      const result = await JSOMValidator.createComponentInEnvironment(mockComponent, testEnvironment);
      
      expect(result.created).toBe(true);
      expect(result.dependencies.dom).toBe(testEnvironment.dom);
      expect(result.dependencies.eventSystem).toBe(testEnvironment.eventSystem);
      expect(result.dependencies.actorSpace).toBe(testEnvironment.actorSpace);
    });

    test('should handle component with describe method', async () => {
      const mockComponent = {
        describe: (d) => d.requires('dom', 'HTMLElement')
      };
      
      const testEnvironment = JSOMValidator.createTestEnvironment();
      
      const result = await JSOMValidator.createComponentInEnvironment(mockComponent, testEnvironment);
      
      expect(result.created).toBe(true);
      expect(result.testEnvironment).toBe(testEnvironment);
    });

    test('should throw error for invalid component', async () => {
      const invalidComponent = {};
      const testEnvironment = JSOMValidator.createTestEnvironment();
      
      await expect(
        JSOMValidator.createComponentInEnvironment(invalidComponent, testEnvironment)
      ).rejects.toThrow('Unable to create component in test environment');
    });
  });

  describe('validateComponent', () => {
    test('should validate complete component', async () => {
      const mockComponent = {
        describe: (d) => {
          d.requires('dom', 'HTMLElement')
            .creates('.test-component')
            .manages('value', 'string')
            .emits('change', 'string');
        },
        create: (deps) => ({
          dependencies: deps,
          created: true
        })
      };

      const mockDescription = {
        dependencies: { total: 1, dependencies: [{ name: 'dom', type: 'HTMLElement', required: true }] },
        domStructure: { total: 1, elements: [{ type: 'creates', selector: '.test-component' }] },
        stateProperties: { total: 1, properties: [{ property: 'value', type: 'string' }] },
        events: { total: 1, byType: { emits: [{ event: 'change', payloadType: 'string' }], listens: [] } }
      };

      const result = await JSOMValidator.validateComponent(mockComponent, mockDescription);
      
      expect(result.component).toBeDefined();
      expect(result.validations).toBeDefined();
      expect(result.validations.dom).toBeDefined();
      expect(result.validations.events).toBeDefined();
      expect(result.validations.state).toBeDefined();
      expect(result.validations.dependencies).toBeDefined();
      expect(result.validations.coordination).toBeDefined();
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    test('should handle validation errors gracefully', async () => {
      const faultyComponent = {
        describe: (d) => d.requires('dom', 'HTMLElement'),
        create: (deps) => {
          throw new Error('Component creation failed');
        }
      };

      const mockDescription = {
        dependencies: { total: 1, dependencies: [{ name: 'dom', type: 'HTMLElement', required: true }] },
        domStructure: { total: 0, elements: [] },
        stateProperties: { total: 0, properties: [] },
        events: { total: 0, byType: { emits: [], listens: [] } }
      };

      const result = await JSOMValidator.validateComponent(faultyComponent, mockDescription);
      
      expect(result.success).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].type).toBe('COORDINATION_VALIDATION_ERROR');
    });
  });

  describe('aggregateResults', () => {
    test('should aggregate results correctly', () => {
      const results = {
        validations: {
          dom: {
            issues: [{ type: 'DOM_ERROR', severity: 'ERROR' }],
            warnings: [{ type: 'DOM_WARNING', severity: 'WARNING' }]
          },
          events: {
            issues: [{ type: 'EVENT_ERROR', severity: 'ERROR' }]
          }
        },
        issues: [],
        warnings: [],
        success: true
      };

      JSOMValidator.aggregateResults(results);

      expect(results.issues).toHaveLength(2);
      expect(results.warnings).toHaveLength(1);
      expect(results.success).toBe(false); // Should be false due to ERROR issues
    });

    test('should maintain success when only warnings present', () => {
      const results = {
        validations: {
          dom: {
            warnings: [{ type: 'DOM_WARNING', severity: 'WARNING' }]
          }
        },
        issues: [],
        warnings: [],
        success: true
      };

      JSOMValidator.aggregateResults(results);

      expect(results.warnings).toHaveLength(1);
      expect(results.success).toBe(true); // Should remain true for warnings only
    });
  });
});