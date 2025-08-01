/**
 * @jest-environment jsdom
 */

import { 
  BaseUmbilicalComponent, 
  BaseModel, 
  BaseView, 
  BaseViewModel,
  createMVVMComponent,
  MVVMTestHelpers 
} from '../src/components/base/index.js';

// Helper function for creating mock functions
function createMockFn() {
  return MVVMTestHelpers._createMockFunction();
}

describe('MVVM Base Classes', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('BaseUmbilicalComponent', () => {
    class TestComponent extends BaseUmbilicalComponent {
      static validateUmbilical(umbilical, config = {}) {
        // For this test component, require DOM
        if (!umbilical.dom) {
          throw new Error('TestComponent requires dom');
        }
        super.validateUmbilical(umbilical, config);
      }

      constructor(umbilical, config) {
        super();
        this.umbilical = umbilical;
        this.config = config;
        this.destroyed = false;
      }

      destroy() {
        this.destroyed = true;
      }
    }

    test('should handle three-mode pattern', () => {
      // Test introspection mode
      let requirements = null;
      TestComponent.create({
        describe: (reqs) => { requirements = reqs; }
      }, TestComponent);
      
      expect(requirements).toBeDefined();
      expect(requirements.getAll().dom).toBeDefined();

      // Test validation mode
      const validResult = TestComponent.create({
        validate: (checks) => checks
      }, TestComponent);
      
      expect(validResult.hasDomElement).toBeDefined();

      // Test instance creation
      const instance = TestComponent.create({
        dom: container
      }, TestComponent);
      
      expect(instance).toBeInstanceOf(TestComponent);
      expect(instance.umbilical.dom).toBe(container);
    });

    test('should validate configuration', () => {
      expect(() => {
        TestComponent.create({
          dom: null
        }, TestComponent);
      }).toThrow();

      expect(() => {
        TestComponent.create({
          dom: container,
          theme: 'invalid'
        }, TestComponent);
      }).toThrow();
    });

    test('should extract and merge configuration', () => {
      const config = BaseUmbilicalComponent.extractConfig({
        dom: container,
        theme: 'dark',
        customProp: 'value'
      }, { defaultProp: 'default' });

      expect(config.dom).toBe(container);
      expect(config.theme).toBe('dark');
      expect(config.customProp).toBe('value');
      expect(config.defaultProp).toBe('default');
    });
  });

  describe('BaseModel', () => {
    let model;

    beforeEach(() => {
      model = new BaseModel();
    });

    afterEach(() => {
      if (model) {
        model.destroy();
      }
    });

    test('should manage items with ID-based lookup', () => {
      model.setItem('item1', { name: 'Test Item' });
      
      expect(model.hasItem('item1')).toBe(true);
      expect(model.getItem('item1').name).toBe('Test Item');
      expect(model.getItemCount()).toBe(1);
    });

    test('should track changes and notify listeners', (done) => {
      const listener = (event) => {
        expect(event.type).toBe('itemChanged');
        expect(event.data.id).toBe('item1');
        done();
      };
      
      model.addChangeListener(listener);
      model.setItem('item1', { name: 'Test' });
    });

    test('should support batch updates', () => {
      const changes = [];
      model.addChangeListener((event) => {
        changes.push(event);
      });

      model.startBatch();
      model.setItem('item1', { name: 'Item 1' });
      model.setItem('item2', { name: 'Item 2' });
      model.endBatch();

      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('batchChanged');
      expect(changes[0].data.changes).toHaveLength(2);
    });

    test('should export and import state', () => {
      model.setItem('item1', { name: 'Test' });
      model.setMetadata('item1', 'color', 'red');
      model.setState('viewMode', 'list');

      const state = model.exportState();
      
      const newModel = new BaseModel();
      newModel.importState(state);

      expect(newModel.getItem('item1').name).toBe('Test');
      expect(newModel.getMetadata('item1', 'color')).toBe('red');
      expect(newModel.getState('viewMode')).toBe('list');
      
      newModel.destroy();
    });
  });

  describe('BaseView', () => {
    let view;

    beforeEach(() => {
      view = new BaseView(container, { baseClass: 'test-component' });
    });

    afterEach(() => {
      if (view) {
        view.destroy();
      }
    });

    test('should create container with proper classes', () => {
      expect(view.container).toBeDefined();
      expect(view.container.classList.contains('test-component')).toBe(true);
      expect(view.container.classList.contains('theme-light')).toBe(true);
    });

    test('should manage theme switching', () => {
      view.setTheme('dark');
      
      expect(view.getTheme()).toBe('dark');
      expect(view.container.classList.contains('theme-dark')).toBe(true);
      expect(view.container.classList.contains('theme-light')).toBe(false);
    });

    test('should manage named elements', () => {
      const element = document.createElement('div');
      view.addElement('testElement', element);
      
      expect(view.getElement('testElement')).toBe(element);
      
      view.removeElement('testElement');
      expect(view.getElement('testElement')).toBeNull();
    });

    test('should manage event listeners with cleanup', () => {
      const handler = createMockFn();
      const button = document.createElement('button');
      
      view.addEventListener(button, 'click', handler);
      button.click();
      
      expect(handler.callCount).toBe(1);
      
      view.removeEventListener(button, 'click', handler);
      button.click();
      
      expect(handler.callCount).toBe(1); // Should not increase
    });

    test('should handle loading/error/empty states', () => {
      view.showLoading('Loading data...');
      expect(view.container.classList.contains('loading')).toBe(true);
      expect(view.container.getAttribute('aria-busy')).toBe('true');
      
      view.hideLoading();
      expect(view.container.classList.contains('loading')).toBe(false);
      
      view.showError('Test error');
      expect(view.container.classList.contains('error')).toBe(true);
      
      view.hideError();
      expect(view.container.classList.contains('error')).toBe(false);
    });
  });

  describe('BaseViewModel', () => {
    let model;
    let view;
    let viewModel;

    beforeEach(() => {
      model = new BaseModel();
      view = new BaseView(container);
      viewModel = new BaseViewModel(model, view);
    });

    afterEach(() => {
      if (viewModel) viewModel.destroy();
      if (view) view.destroy();
      if (model) model.destroy();
    });

    test('should coordinate model and view', () => {
      expect(viewModel.model).toBe(model);
      expect(viewModel.view).toBe(view);
      expect(viewModel.getState().ready).toBe(true);
    });

    test('should execute commands', () => {
      expect(viewModel.canExecuteCommand('render')).toBe(true);
      
      const result = viewModel.executeCommand('render');
      expect(result).toBe(true);
    });

    test('should register custom commands', () => {
      const customCommand = createMockFn();
      customCommand.returnValue = 'custom result';
      viewModel.registerCommand('customCommand', customCommand);
      
      const result = viewModel.executeCommand('customCommand', { param: 'value' });
      
      expect(customCommand.toHaveBeenCalledWith({ param: 'value' })).toBe(true);
      expect(result).toBe('custom result');
    });

    test('should track command history', () => {
      viewModel.executeCommand('render');
      viewModel.executeCommand('setTheme', { theme: 'dark' });
      
      const history = viewModel.getCommandHistory();
      expect(history).toHaveLength(2);
      expect(history[0].name).toBe('render');
      expect(history[1].name).toBe('setTheme');
    });

    test('should handle model-view event coordination', (done) => {
      // Mock view render to detect coordination
      const originalRender = view.render;
      const mockRender = createMockFn();
      view.render = function() {
        mockRender();
        return originalRender.call(this);
      };
      
      // Listen for model changes that should trigger view updates
      setTimeout(() => {
        model.setItem('test', { data: 'value' });
        
        // Give time for async coordination
        setTimeout(() => {
          expect(mockRender.callCount).toBeGreaterThan(0);
          view.render = originalRender;
          done();
        }, 10);
      }, 10);
    });
  });

  describe('createMVVMComponent Factory', () => {
    let TestComponent;
    let component;

    beforeEach(() => {
      class TestModel extends BaseModel {}
      class TestView extends BaseView {}
      class TestViewModel extends BaseViewModel {}

      TestComponent = createMVVMComponent({
        ModelClass: TestModel,
        ViewClass: TestView,
        ViewModelClass: TestViewModel,
        name: 'TestComponent',
        defaults: { theme: 'light' }
      });
    });

    afterEach(() => {
      if (component && component.destroy) {
        component.destroy();
      }
    });

    test('should create component following umbilical protocol', () => {
      // Test three-mode pattern
      const protocolResults = MVVMTestHelpers.testUmbilicalProtocol(TestComponent);
      
      expect(protocolResults.introspection.passed).toBe(true);
      expect(protocolResults.validation.validPassed).toBe(true);
      expect(protocolResults.instance.passed).toBe(true);
      expect(protocolResults.errors).toHaveLength(0);
    });

    test('should create MVVM component instance', () => {
      component = TestComponent.create({
        dom: container
      });
      
      expect(component).toBeDefined();
      expect(typeof component.destroy).toBe('function');
      
      const debug = component.debug();
      expect(debug.model).toBeInstanceOf(BaseModel);
      expect(debug.view).toBeInstanceOf(BaseView);
      expect(debug.viewModel).toBeInstanceOf(BaseViewModel);
    });

    test('should support configuration and updates', () => {
      component = TestComponent.create({
        dom: container,
        theme: 'dark'
      });
      
      expect(component.getConfig().theme).toBe('dark');
      
      component.updateConfig({ theme: 'light' });
      expect(component.getConfig().theme).toBe('light');
    });

    test('should execute commands through viewModel', () => {
      component = TestComponent.create({
        dom: container
      });
      
      expect(component.canExecuteCommand('render')).toBe(true);
      const result = component.executeCommand('render');
      expect(result).toBe(true);
    });
  });

  describe('MVVMTestHelpers', () => {
    test('should create mock umbilical objects', () => {
      const mockUmbilical = MVVMTestHelpers.createMockUmbilical({
        customProp: 'value'
      });
      
      expect(mockUmbilical.dom).toBeInstanceOf(HTMLElement);
      expect(mockUmbilical.theme).toBe('light');
      expect(mockUmbilical.customProp).toBe('value');
      expect(typeof mockUmbilical.onMount).toBe('function');
      
      // Cleanup
      mockUmbilical._cleanup();
    });

    test('should create mock containers', () => {
      const mockContainer = MVVMTestHelpers.createMockContainer({
        width: '400px',
        height: '300px',
        id: 'test-container'
      });
      
      expect(mockContainer.style.width).toBe('400px');
      expect(mockContainer.style.height).toBe('300px');
      expect(mockContainer.id).toBe('test-container');
      
      // Cleanup
      mockContainer._cleanup();
    });

    test('should create different types of mock data', () => {
      const hierarchicalData = MVVMTestHelpers.createMockData('hierarchical', {
        depth: 2,
        childrenPerNode: 3
      });
      
      expect(hierarchicalData.id).toBe('root');
      expect(hierarchicalData.children).toHaveLength(3);
      expect(hierarchicalData.children[0].children).toHaveLength(3);
      
      const tabularData = MVVMTestHelpers.createMockData('tabular', {
        rows: 5,
        columns: ['id', 'name', 'status']
      });
      
      expect(tabularData).toHaveLength(5);
      expect(tabularData[0]).toHaveProperty('id');
      expect(tabularData[0]).toHaveProperty('name');
      expect(tabularData[0]).toHaveProperty('status');
    });

    test('should simulate user interactions', () => {
      const button = document.createElement('button');
      const clickHandler = createMockFn();
      
      button.addEventListener('click', clickHandler);
      
      MVVMTestHelpers.simulateInteraction(button, 'click');
      expect(clickHandler.callCount).toBe(1);
    });
  });

  describe('Integration Testing', () => {
    test('should demonstrate complete MVVM workflow', async () => {
      // Create a simple test component
      class CounterModel extends BaseModel {
        constructor(data, config) {
          super(data, config);
          this.setState('count', 0);
        }
        
        increment() {
          const count = this.getState('count') + 1;
          this.setState('count', count);
        }
      }

      class CounterView extends BaseView {
        render() {
          if (!this.model) return;
          
          this.container.innerHTML = `
            <div class="counter">
              <span id="count">${this.model.getState('count')}</span>
              <button id="increment">+</button>
            </div>
          `;
          
          const button = this.container.querySelector('#increment');
          this.addEventListener(button, 'click', () => {
            this._emitViewEvent('increment', {});
          });
          
          super.render();
        }
      }

      class CounterViewModel extends BaseViewModel {
        _initializeCommands() {
          super._initializeCommands();
          this.registerCommand('increment', this._incrementCommand.bind(this));
        }
        
        _handleViewEvent(event) {
          super._handleViewEvent(event);
          if (event.type === 'increment') {
            this.executeCommand('increment');
          }
        }
        
        _incrementCommand() {
          this.model.increment();
          this.render();
          return true;
        }
      }

      const CounterComponent = createMVVMComponent({
        ModelClass: CounterModel,
        ViewClass: CounterView,
        ViewModelClass: CounterViewModel,
        name: 'CounterComponent'
      });

      // Test the complete workflow
      const counter = CounterComponent.create({
        dom: container
      });

      // Initial render should show count of 0
      expect(container.querySelector('#count').textContent).toBe('0');

      // Simulate user clicking increment button
      const button = container.querySelector('#increment');
      button.click();

      // Wait for async updates
      await MVVMTestHelpers.wait(10);

      // Count should be incremented
      expect(container.querySelector('#count').textContent).toBe('1');

      counter.destroy();
    });
  });
});