/**
 * Integration tests for DiagramRenderer with ShowMe module
 */

import { DiagramRenderer } from '../../../../src/renderers/diagram/DiagramRenderer.js';
import { 
  createTestDOM, 
  cleanupTestDOM, 
  createSampleDiagramData,
  waitForAsync
} from '../test-setup.js';

describe('ShowMe Integration', () => {
  let dom;

  beforeEach(() => {
    dom = createTestDOM();
  });

  afterEach(() => {
    cleanupTestDOM();
  });

  describe('Renderer Registration', () => {
    test('should register with ShowMe renderer registry', () => {
      // Mock ShowMe registry
      const registry = {
        renderers: new Map(),
        register(type, renderer) {
          this.renderers.set(type, renderer);
        },
        get(type) {
          return this.renderers.get(type);
        }
      };

      // Register DiagramRenderer
      registry.register('diagram', DiagramRenderer);

      // Verify registration
      const registered = registry.get('diagram');
      expect(registered).toBe(DiagramRenderer);
    });

    test('should handle multiple diagram types', () => {
      const registry = new Map();
      
      // Register for different diagram types
      const types = ['dataflow', 'datamodel', 'architecture'];
      types.forEach(type => {
        registry.set(type, DiagramRenderer);
      });

      // Verify all types are registered
      types.forEach(type => {
        expect(registry.get(type)).toBe(DiagramRenderer);
      });
    });
  });

  describe('Content Type Detection', () => {
    test('should detect dataflow diagram content', () => {
      const data = createSampleDiagramData('dataflow');
      
      // Simple content type detection
      const isdiagram = data.type && ['dataflow', 'datamodel', 'architecture'].includes(data.type);
      expect(isdiagram).toBe(true);
      expect(data.type).toBe('dataflow');
    });

    test('should detect data model content', () => {
      const data = createSampleDiagramData('datamodel');
      
      const isdiagram = data.type && ['dataflow', 'datamodel', 'architecture'].includes(data.type);
      expect(isdiagram).toBe(true);
      expect(data.type).toBe('datamodel');
    });
  });

  describe('End-to-End Rendering', () => {
    test('should render diagram through ShowMe-like pipeline', async () => {
      // Simulate ShowMe rendering pipeline
      const container = document.createElement('div');
      container.style.width = '800px';
      container.style.height = '600px';
      document.body.appendChild(container);

      const data = createSampleDiagramData();
      
      // Create umbilical as ShowMe would
      let modelChangeCount = 0;
      let selectionChangeCount = 0;
      const modelChangeMock = () => { modelChangeCount++; };
      const selectionChangeMock = () => { selectionChangeCount++; };
      const umbilical = {
        dom: container,
        data: data,
        onModelChange: modelChangeMock,
        onSelectionChange: selectionChangeMock
      };

      // Create renderer instance
      const instance = DiagramRenderer.create(umbilical);
      
      // Wait for rendering
      await waitForAsync(10);

      // Verify DOM elements created
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      
      const nodes = svg.querySelectorAll('.node');
      expect(nodes.length).toBe(data.nodes.length);
      
      const edges = svg.querySelectorAll('.edge');
      expect(edges.length).toBe(data.edges.length);

      // Cleanup
      instance.destroy();
    });

    test('should handle lifecycle events properly', async () => {
      const container = document.createElement('div');
      container.style.width = '800px';
      container.style.height = '600px';
      document.body.appendChild(container);

      let mountCalled = false;
      let destroyCalled = false;
      let modelChangeCalled = false;
      let mountedInstance = null;
      
      const onMount = (instance) => { 
        mountCalled = true; 
        mountedInstance = instance;
      };
      const onDestroy = () => { destroyCalled = true; };
      const onModelChange = () => { modelChangeCalled = true; };

      const umbilical = {
        dom: container,
        data: createSampleDiagramData(),
        onMount,
        onDestroy,
        onModelChange
      };

      // Create instance
      const instance = DiagramRenderer.create(umbilical);
      
      // Verify mount called
      expect(mountCalled).toBe(true);
      expect(mountedInstance).toBe(instance);

      // Wait for initial render
      await waitForAsync(10);

      // Update data to trigger model change
      instance.render({
        ...umbilical.data,
        nodes: [...umbilical.data.nodes, {
          id: 'new-node',
          type: 'process',
          label: 'New Node'
        }]
      });

      await waitForAsync(10);

      // Verify model change called
      expect(modelChangeCalled).toBe(true);

      // Destroy instance
      instance.destroy();

      // Verify destroy called
      expect(destroyCalled).toBe(true);
    });
  });

  describe('Data Updates', () => {
    test('should handle data updates from ShowMe', async () => {
      const container = document.createElement('div');
      container.style.width = '800px';
      container.style.height = '600px';
      document.body.appendChild(container);

      const initialData = createSampleDiagramData();
      const umbilical = {
        dom: container,
        data: initialData
      };

      const instance = DiagramRenderer.create(umbilical);
      
      await waitForAsync(10);

      // Initial render check
      let nodes = container.querySelectorAll('.node');
      expect(nodes.length).toBe(3);

      // Update with new data
      const updatedData = {
        ...initialData,
        nodes: [
          ...initialData.nodes,
          {
            id: 'node4',
            type: 'process',
            label: 'New Process'
          }
        ]
      };

      instance.render(updatedData);
      await waitForAsync(10);

      // Check updated render
      nodes = container.querySelectorAll('.node');
      expect(nodes.length).toBe(4);

      instance.destroy();
    });

    test('should handle different diagram types', async () => {
      const container = document.createElement('div');
      container.style.width = '800px';
      container.style.height = '600px';
      document.body.appendChild(container);

      // Start with dataflow
      let data = createSampleDiagramData('dataflow');
      const umbilical = {
        dom: container,
        data: data
      };

      const instance = DiagramRenderer.create(umbilical);
      await waitForAsync(10);

      let nodes = container.querySelectorAll('.node');
      expect(nodes.length).toBe(3);

      // Switch to data model
      data = createSampleDiagramData('datamodel');
      instance.render(data);
      await waitForAsync(10);

      nodes = container.querySelectorAll('.node');
      expect(nodes.length).toBe(2); // Data model has 2 entities

      instance.destroy();
    });
  });

  describe('Error Handling', () => {
    test('should handle errors gracefully in ShowMe context', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      let errorCalled = false;
      let errorData = null;
      const onError = (err) => { 
        errorCalled = true; 
        errorData = err;
      };
      
      const umbilical = {
        dom: container,
        data: { invalid: 'data' }, // Invalid data
        onError
      };

      // Should handle error without crashing
      expect(() => {
        DiagramRenderer.create(umbilical);
      }).not.toThrow();

      // Error handler should be called
      expect(errorCalled).toBe(true);
    });

    test('should validate data before rendering', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const umbilical = {
        dom: container,
        data: {
          type: 'invalid-type', // Invalid diagram type
          nodes: []
        }
      };

      expect(() => {
        DiagramRenderer.create(umbilical);
      }).toThrow('Invalid diagram data');
    });
  });

  describe('Component Isolation', () => {
    test('should handle multiple instances independently', async () => {
      // Create two containers
      const container1 = document.createElement('div');
      container1.style.width = '400px';
      container1.style.height = '300px';
      document.body.appendChild(container1);

      const container2 = document.createElement('div');
      container2.style.width = '400px';
      container2.style.height = '300px';
      document.body.appendChild(container2);

      // Create two instances with different data
      const data1 = createSampleDiagramData('dataflow');
      const data2 = createSampleDiagramData('datamodel');

      const instance1 = DiagramRenderer.create({
        dom: container1,
        data: data1
      });

      const instance2 = DiagramRenderer.create({
        dom: container2,
        data: data2
      });

      await waitForAsync(10);

      // Verify both rendered independently
      const nodes1 = container1.querySelectorAll('.node');
      const nodes2 = container2.querySelectorAll('.node');

      expect(nodes1.length).toBe(3); // Dataflow has 3 nodes
      expect(nodes2.length).toBe(2); // Data model has 2 entities

      // Cleanup
      instance1.destroy();
      instance2.destroy();

      // Verify cleanup
      expect(container1.querySelector('svg')).toBeFalsy();
      expect(container2.querySelector('svg')).toBeFalsy();
    });
  });

  describe('ShowMe Protocol Compliance', () => {
    test('should support introspection mode', () => {
      let requirements = null;
      
      DiagramRenderer.create({
        describe: (reqs) => {
          requirements = reqs;
        }
      });

      expect(requirements).toBeDefined();
      const allReqs = requirements.getAll();
      
      // Verify required capabilities
      expect(allReqs.dom).toBeDefined();
      expect(allReqs.data).toBeDefined();
      
      // Verify optional capabilities
      expect(allReqs.onModelChange).toBeDefined();
      expect(allReqs.onSelectionChange).toBeDefined();
      expect(allReqs.theme).toBeDefined();
    });

    test('should support validation mode', () => {
      const container = document.createElement('div');
      const data = createSampleDiagramData();

      const validation = DiagramRenderer.create({
        dom: container,
        data: data,
        validate: (checks) => checks
      });

      expect(validation.hasDomElement).toBe(true);
      expect(validation.hasData).toBe(true);
      expect(validation.isValid).toBe(true);
    });

    test('should return undefined in describe mode', () => {
      const result = DiagramRenderer.create({
        describe: () => {}
      });

      expect(result).toBeUndefined();
    });

    test('should return validation in validate mode', () => {
      const result = DiagramRenderer.create({
        validate: (checks) => checks
      });

      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
    });
  });
});