/**
 * Unit tests for DiagramRenderer component
 */

import { DiagramRenderer } from '../../../../src/renderers/diagram/DiagramRenderer.js';
import { 
  createTestDOM, 
  cleanupTestDOM, 
  createMockUmbilical,
  createSampleDiagramData 
} from '../test-setup.js';

describe('DiagramRenderer', () => {
  let dom;

  beforeEach(() => {
    dom = createTestDOM();
  });

  afterEach(() => {
    cleanupTestDOM();
  });

  describe('Umbilical Protocol', () => {
    test('should support introspection mode', () => {
      let requirements = null;
      
      DiagramRenderer.create({
        describe: (reqs) => {
          requirements = reqs;
        }
      });

      expect(requirements).toBeDefined();
      const allReqs = requirements.getAll();
      expect(allReqs.dom).toBeDefined();
      expect(allReqs.data).toBeDefined();
      expect(allReqs.onModelChange).toBeDefined();
    });

    test('should support validation mode', () => {
      const validation = DiagramRenderer.create({
        validate: (checks) => checks
      });

      expect(validation).toBeDefined();
      expect(validation.hasDomElement).toBeDefined();
      expect(validation.hasData).toBeDefined();
      expect(validation.isValid).toBeDefined();
    });

    test('should validate required capabilities', () => {
      const validation = DiagramRenderer.create({
        dom: document.createElement('div'),
        data: createSampleDiagramData(),
        validate: (checks) => checks
      });

      expect(validation.hasDomElement).toBe(true);
      expect(validation.hasData).toBe(true);
      expect(validation.isValid).toBe(true);
    });

    test('should fail validation without required capabilities', () => {
      const validation = DiagramRenderer.create({
        validate: (checks) => checks
      });

      expect(validation.hasDomElement).toBe(false);
      expect(validation.hasData).toBe(false);
      expect(validation.isValid).toBe(false);
    });
  });

  describe('Instance Creation', () => {
    test('should create instance with valid umbilical', () => {
      const umbilical = createMockUmbilical({
        data: createSampleDiagramData()
      });

      const instance = DiagramRenderer.create(umbilical);
      
      expect(instance).toBeDefined();
      expect(instance.render).toBeInstanceOf(Function);
      expect(instance.destroy).toBeInstanceOf(Function);
      expect(instance.getViewModel).toBeInstanceOf(Function);
      expect(instance.getView).toBeInstanceOf(Function);
    });

    test('should throw error without required dom', () => {
      expect(() => {
        DiagramRenderer.create({
          data: createSampleDiagramData()
        });
      }).toThrow('DiagramRenderer requires dom');
    });

    test('should throw error without required data', () => {
      expect(() => {
        DiagramRenderer.create({
          dom: document.createElement('div')
        });
      }).toThrow('DiagramRenderer requires data');
    });
  });

  describe('Component Lifecycle', () => {
    test('should call onMount when created', () => {
      let mountCalled = false;
      let mountedInstance = null;
      const onMount = (instance) => {
        mountCalled = true;
        mountedInstance = instance;
      };
      const umbilical = createMockUmbilical({
        data: createSampleDiagramData(),
        onMount
      });

      const instance = DiagramRenderer.create(umbilical);
      
      expect(mountCalled).toBe(true);
      expect(mountedInstance).toBe(instance);
    });

    test('should call onDestroy when destroyed', () => {
      let destroyCalled = false;
      const onDestroy = () => {
        destroyCalled = true;
      };
      const umbilical = createMockUmbilical({
        data: createSampleDiagramData(),
        onDestroy
      });

      const instance = DiagramRenderer.create(umbilical);
      instance.destroy();
      
      expect(destroyCalled).toBe(true);
    });

    test('should clean up DOM when destroyed', () => {
      const umbilical = createMockUmbilical({
        data: createSampleDiagramData()
      });

      const instance = DiagramRenderer.create(umbilical);
      const container = umbilical.dom.querySelector('.diagram-renderer');
      expect(container).toBeTruthy();

      instance.destroy();
      const afterDestroy = umbilical.dom.querySelector('.diagram-renderer');
      expect(afterDestroy).toBeFalsy();
    });

    test('should prevent usage after destroy', () => {
      const umbilical = createMockUmbilical({
        data: createSampleDiagramData()
      });

      const instance = DiagramRenderer.create(umbilical);
      instance.destroy();

      expect(() => instance.render()).toThrow('destroyed');
      expect(() => instance.getViewModel()).toThrow('destroyed');
      expect(() => instance.getView()).toThrow('destroyed');
    });
  });

  describe('Data Handling', () => {
    test('should render initial data', () => {
      const data = createSampleDiagramData();
      const umbilical = createMockUmbilical({ data });

      const instance = DiagramRenderer.create(umbilical);
      
      // Check that SVG is created
      const svg = umbilical.dom.querySelector('svg');
      expect(svg).toBeTruthy();

      // Check that nodes are rendered
      const nodes = svg.querySelectorAll('.node');
      expect(nodes.length).toBe(data.nodes.length);
    });

    test('should update when data changes', () => {
      const data = createSampleDiagramData();
      const umbilical = createMockUmbilical({ data });

      const instance = DiagramRenderer.create(umbilical);
      
      // Update with new data
      const newData = {
        ...data,
        nodes: [...data.nodes, {
          id: 'node4',
          type: 'process',
          label: 'New Process'
        }]
      };

      instance.render(newData);

      const nodes = umbilical.dom.querySelectorAll('.node');
      expect(nodes.length).toBe(4);
    });

    test('should handle invalid data gracefully', () => {
      const umbilical = createMockUmbilical({
        data: { invalid: 'data' },
        onError: undefined // Remove the error handler to test throwing behavior
      });

      expect(() => {
        DiagramRenderer.create(umbilical);
      }).toThrow('Invalid diagram data');
    });
  });

  describe('Error Handling', () => {
    test('should call onError for rendering errors', () => {
      let errorCalled = false;
      let errorData = null;
      const onError = (err) => {
        errorCalled = true;
        errorData = err;
      };
      const umbilical = createMockUmbilical({
        data: createSampleDiagramData(),
        onError
      });

      const instance = DiagramRenderer.create(umbilical);
      
      // Force an error by passing invalid data
      instance.render({ invalid: 'data' });

      expect(errorCalled).toBe(true);
      expect(errorData).toBeInstanceOf(Error);
    });

    test('should throw errors when no error handler provided', () => {
      const umbilical = createMockUmbilical({
        data: createSampleDiagramData(),
        onError: undefined
      });

      const instance = DiagramRenderer.create(umbilical);

      expect(() => {
        instance.render({ invalid: 'data' });
      }).toThrow();
    });
  });
});