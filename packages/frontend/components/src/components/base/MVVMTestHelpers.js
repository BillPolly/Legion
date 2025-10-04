/**
 * MVVMTestHelpers - Utilities for testing MVVM components
 * 
 * Provides standardized testing patterns for:
 * - Umbilical protocol testing
 * - MVVM layer testing
 * - Mock creation and management
 * - Common test scenarios
 * - Integration testing patterns
 */

import { UmbilicalUtils } from '@legion/components';

export class MVVMTestHelpers {
  /**
   * Create a mock umbilical object for testing
   * @param {Object} overrides - Properties to override
   * @returns {Object} Mock umbilical object
   */
  static createMockUmbilical(overrides = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    const mockUmbilical = {
      dom: container,
      theme: 'light',
      onMount: this._createMockFunction(),
      onDestroy: this._createMockFunction(),
      onError: this._createMockFunction(),
      ...overrides
    };
    
    // Add cleanup method
    mockUmbilical._cleanup = () => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };
    
    return mockUmbilical;
  }

  /**
   * Create a mock DOM container
   * @param {Object} options - Container options
   * @returns {HTMLElement} Mock DOM container
   */
  static createMockContainer(options = {}) {
    const container = document.createElement('div');
    
    if (options.width) container.style.width = options.width;
    if (options.height) container.style.height = options.height;
    if (options.id) container.id = options.id;
    if (options.className) container.className = options.className;
    
    document.body.appendChild(container);
    
    // Add cleanup method
    container._cleanup = () => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };
    
    return container;
  }

  /**
   * Test umbilical protocol compliance for a component
   * @param {Function} ComponentClass - Component class to test
   * @param {Object} options - Test options
   * @returns {Object} Test results
   */
  static testUmbilicalProtocol(ComponentClass, options = {}) {
    const results = {
      introspection: null,
      validation: null,
      instance: null,
      errors: []
    };

    try {
      // Test introspection mode
      let requirements = null;
      ComponentClass.create({
        describe: (reqs) => { requirements = reqs; }
      });
      
      results.introspection = {
        passed: !!requirements,
        requirements: requirements ? requirements.getAll() : null
      };
    } catch (error) {
      results.errors.push({ phase: 'introspection', error });
    }

    try {
      // Test validation mode
      const validUmbilical = this.createMockUmbilical(options.validUmbilical);
      const invalidUmbilical = { ...validUmbilical, dom: null };
      
      const validResult = ComponentClass.create({
        validate: validUmbilical
      });
      
      const invalidResult = ComponentClass.create({
        validate: invalidUmbilical
      });
      
      results.validation = {
        validPassed: !!validResult,
        invalidPassed: !invalidResult || Object.values(invalidResult).some(v => v === false),
        validResult,
        invalidResult
      };
      
      validUmbilical._cleanup();
    } catch (error) {
      results.errors.push({ phase: 'validation', error });
    }

    try {
      // Test instance creation
      const umbilical = this.createMockUmbilical(options.validUmbilical);
      const instance = ComponentClass.create(umbilical);
      
      results.instance = {
        passed: !!instance,
        hasDestroy: typeof instance.destroy === 'function',
        instance
      };
      
      // Clean up
      if (instance && instance.destroy) {
        instance.destroy();
      }
      umbilical._cleanup();
    } catch (error) {
      results.errors.push({ phase: 'instance', error });
    }

    return results;
  }

  /**
   * Test MVVM layer interactions
   * @param {Object} model - Model instance
   * @param {Object} view - View instance
   * @param {Object} viewModel - ViewModel instance
   * @returns {Object} Test results
   */
  static testMVVMInteractions(model, view, viewModel) {
    const results = {
      modelToView: false,
      viewToModel: false,
      viewModelCoordination: false,
      errors: []
    };

    try {
      // Test Model -> ViewModel -> View flow
      let renderCalled = false;
      const originalRender = view.render;
      view.render = function() {
        renderCalled = true;
        return originalRender.call(this);
      };

      // Trigger model change
      if (model.setData) {
        model.setData({ test: 'data' });
      } else if (model.setState) {
        model.setState('test', 'value');
      }

      // Allow async updates
      setTimeout(() => {
        results.modelToView = renderCalled;
      }, 10);

      view.render = originalRender;
    } catch (error) {
      results.errors.push({ phase: 'modelToView', error });
    }

    try {
      // Test ViewModel coordination
      let commandExecuted = false;
      if (viewModel.executeCommand) {
        commandExecuted = viewModel.executeCommand('render') !== null;
      }
      
      results.viewModelCoordination = commandExecuted;
    } catch (error) {
      results.errors.push({ phase: 'viewModelCoordination', error });
    }

    return results;
  }

  /**
   * Create a test suite for an MVVM component
   * @param {string} componentName - Component name
   * @param {Function} ComponentClass - Component class
   * @param {Object} testConfig - Test configuration
   * @returns {Function} Jest test suite
   */
  static createTestSuite(componentName, ComponentClass, testConfig = {}) {
    return () => {
      describe(`${componentName} - MVVM Component`, () => {
        let component;
        let umbilical;

        beforeEach(() => {
          umbilical = this.createMockUmbilical(testConfig.umbilical);
        });

        afterEach(() => {
          if (component && component.destroy) {
            component.destroy();
          }
          if (umbilical && umbilical._cleanup) {
            umbilical._cleanup();
          }
        });

        describe('Umbilical Protocol Compliance', () => {
          test('should follow three-mode pattern', () => {
            const results = this.testUmbilicalProtocol(ComponentClass, testConfig);
            
            expect(results.introspection.passed).toBe(true);
            expect(results.validation.validPassed).toBe(true);
            expect(results.instance.passed).toBe(true);
            expect(results.errors).toHaveLength(0);
          });

          test('should define requirements in introspection mode', () => {
            let requirements = null;
            ComponentClass.create({
              describe: (reqs) => { requirements = reqs; }
            });
            
            expect(requirements).toBeDefined();
            const reqList = requirements.getAll();
            expect(reqList.dom).toBeDefined();
          });

          test('should validate capabilities correctly', () => {
            const validResult = ComponentClass.create({
              validate: umbilical
            });
            
            expect(validResult).toBeDefined();
            expect(validResult.hasDomElement).toBe(true);
          });

          test('should create component instance', () => {
            component = ComponentClass.create(umbilical);
            
            expect(component).toBeDefined();
            expect(typeof component.destroy).toBe('function');
          });
        });

        describe('MVVM Architecture', () => {
          beforeEach(() => {
            component = ComponentClass.create(umbilical);
          });

          test('should have MVVM layers', () => {
            if (component.debug) {
              const debug = component.debug();
              expect(debug.model).toBeDefined();
              expect(debug.view).toBeDefined();
              expect(debug.viewModel).toBeDefined();
            }
          });

          test('should coordinate model-view interactions', () => {
            if (component.debug) {
              const { model, view, viewModel } = component.debug();
              const results = this.testMVVMInteractions(model, view, viewModel);
              
              // At least coordination should work
              expect(results.viewModelCoordination).toBe(true);
            }
          });

          test('should handle commands', () => {
            if (component.executeCommand) {
              expect(component.canExecuteCommand('render')).toBe(true);
              const result = component.executeCommand('render');
              expect(result).toBeDefined();
            }
          });

          test('should support configuration updates', () => {
            if (component.updateConfig) {
              const oldConfig = component.getConfig();
              component.updateConfig({ theme: 'dark' });
              const newConfig = component.getConfig();
              
              expect(newConfig.theme).toBe('dark');
              expect(newConfig.theme).not.toBe(oldConfig.theme);
            }
          });
        });

        describe('Lifecycle Management', () => {
          test('should call mount callback', () => {
            component = ComponentClass.create(umbilical);
            expect(umbilical.onMount).toHaveBeenCalledWith(component);
          });

          test('should call destroy callback', () => {
            component = ComponentClass.create(umbilical);
            component.destroy();
            expect(umbilical.onDestroy).toHaveBeenCalledWith(component);
          });

          test('should handle errors gracefully', () => {
            // This would need component-specific error scenarios
            if (testConfig.errorTest) {
              testConfig.errorTest(ComponentClass, umbilical);
              expect(umbilical.onError).toHaveBeenCalled();
            }
          });
        });

        if (testConfig.customTests) {
          describe('Component-Specific Tests', () => {
            testConfig.customTests.forEach(({ name, test }) => {
              test(name, () => {
                component = ComponentClass.create(umbilical);
                test(component, umbilical);
              });
            });
          });
        }
      });
    };
  }

  /**
   * Create mock event handlers
   * @returns {Object} Mock event handlers
   */
  static createMockEventHandlers() {
    return {
      onMount: this._createMockFunction(),
      onDestroy: this._createMockFunction(),
      onError: this._createMockFunction(),
      onChange: this._createMockFunction(),
      onStateChange: this._createMockFunction(),
      onConfigChange: this._createMockFunction(),
      onClick: this._createMockFunction(),
      onDoubleClick: this._createMockFunction(),
      onKeyDown: this._createMockFunction(),
      onKeyUp: this._createMockFunction(),
      onFocus: this._createMockFunction(),
      onBlur: this._createMockFunction()
    };
  }

  /**
   * Create mock data for testing
   * @param {string} type - Data type (hierarchical, tabular, graph, etc.)
   * @param {Object} options - Data options
   * @returns {*} Mock data
   */
  static createMockData(type, options = {}) {
    switch (type) {
      case 'hierarchical':
        return this._createHierarchicalData(options);
      case 'tabular':
        return this._createTabularData(options);
      case 'graph':
        return this._createGraphData(options);
      case 'simple':
        return this._createSimpleData(options);
      default:
        return null;
    }
  }

  /**
   * Wait for component updates (for async testing)
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise} Promise that resolves after delay
   */
  static wait(ms = 50) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Simulate user interactions
   * @param {HTMLElement} element - Target element
   * @param {string} interaction - Interaction type
   * @param {Object} options - Interaction options
   */
  static simulateInteraction(element, interaction, options = {}) {
    switch (interaction) {
      case 'click':
        element.click();
        break;
      case 'doubleClick':
        element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        break;
      case 'keyDown':
        element.dispatchEvent(new KeyboardEvent('keydown', { 
          key: options.key || 'Enter', 
          bubbles: true 
        }));
        break;
      case 'focus':
        element.focus();
        break;
      case 'blur':
        element.blur();
        break;
      default:
        console.warn(`Unknown interaction: ${interaction}`);
    }
  }

  // Private helper methods

  static _createHierarchicalData(options) {
    const depth = options.depth || 3;
    const childrenPerNode = options.childrenPerNode || 2;
    
    const createNode = (id, level) => ({
      id,
      name: `Node ${id}`,
      level,
      children: level < depth ? 
        Array.from({ length: childrenPerNode }, (_, i) => 
          createNode(`${id}.${i}`, level + 1)
        ) : []
    });
    
    return createNode('root', 0);
  }

  static _createTabularData(options) {
    const rows = options.rows || 10;
    const columns = options.columns || ['id', 'name', 'value'];
    
    return Array.from({ length: rows }, (_, i) => {
      const row = { id: i };
      columns.forEach(col => {
        if (col !== 'id') {
          row[col] = `${col}_${i}`;
        }
      });
      return row;
    });
  }

  static _createGraphData(options) {
    const nodeCount = options.nodeCount || 5;
    const edgeCount = options.edgeCount || 6;
    
    const nodes = Array.from({ length: nodeCount }, (_, i) => ({
      id: `node_${i}`,
      name: `Node ${i}`,
      x: Math.random() * 400,
      y: Math.random() * 300
    }));
    
    const edges = Array.from({ length: edgeCount }, (_, i) => ({
      id: `edge_${i}`,
      source: `node_${Math.floor(Math.random() * nodeCount)}`,
      target: `node_${Math.floor(Math.random() * nodeCount)}`
    }));
    
    return { nodes, edges };
  }

  static _createSimpleData(options) {
    return {
      title: options.title || 'Test Data',
      description: options.description || 'Mock data for testing',
      items: options.items || ['item1', 'item2', 'item3']
    };
  }

  /**
   * Create a mock function (compatible with or without jest)
   * @returns {Function} Mock function
   * @private
   */
  static _createMockFunction() {
    // Try to use jest.fn() if available, otherwise create simple mock
    if (typeof jest !== 'undefined' && jest.fn) {
      return jest.fn();
    }
    
    // Simple mock function implementation
    const fn = function(...args) {
      fn.calls.push(args);
      fn.lastCall = args;
      fn.callCount++;
      return fn.returnValue;
    };
    
    fn.calls = [];
    fn.lastCall = null;
    fn.callCount = 0;
    fn.returnValue = undefined;
    
    // Add jest-like methods
    fn.toHaveBeenCalled = () => fn.callCount > 0;
    fn.toHaveBeenCalledTimes = (times) => fn.callCount === times;
    fn.toHaveBeenCalledWith = (...args) => {
      return fn.calls.some(call => 
        call.length === args.length && 
        call.every((arg, i) => arg === args[i])
      );
    };
    
    return fn;
  }
}