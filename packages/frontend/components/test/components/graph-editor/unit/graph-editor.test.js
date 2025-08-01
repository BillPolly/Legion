/**
 * Unit tests for GraphEditor Umbilical Component
 */

import { GraphEditor } from '../../../../src/components/graph-editor/index.js';

describe('GraphEditor - Umbilical Component Protocol', () => {
  describe('Component Creation', () => {
    it('should export a create function', () => {
      expect(typeof GraphEditor.create).toBe('function');
    });

    it('should throw error when no umbilical provided', () => {
      expect(() => GraphEditor.create()).toThrow('GraphEditor requires an umbilical');
    });
  });

  describe('Introspection Mode', () => {
    it('should describe requirements when umbilical.describe is provided', () => {
      const requirements = [];
      const umbilical = {
        describe: (req) => requirements.push(req)
      };

      GraphEditor.create(umbilical);

      expect(requirements).toHaveLength(1);
      const req = requirements[0];
      
      // Required capabilities
      expect(req.required).toContain('dom');
      expect(req.required).toContain('onModelChange');
      
      // Optional capabilities
      expect(req.optional).toContain('width');
      expect(req.optional).toContain('height');
      expect(req.optional).toContain('theme');
      expect(req.optional).toContain('onSelectionChange');
      expect(req.optional).toContain('onNodeClick');
      expect(req.optional).toContain('onNodeDoubleClick');
      expect(req.optional).toContain('onEdgeClick');
      expect(req.optional).toContain('onBackgroundClick');
      expect(req.optional).toContain('onError');
      
      // Descriptions
      expect(req.descriptions.dom).toBe('DOM element to render the graph editor into');
      expect(req.descriptions.onModelChange).toBe('Callback when the graph model changes');
    });

    it('should not create instance in describe mode', () => {
      const umbilical = {
        describe: () => {},
        dom: document.createElement('div'),
        onModelChange: () => {}
      };

      const result = GraphEditor.create(umbilical);
      expect(result).toBeUndefined();
    });
  });

  describe('Validation Mode', () => {
    it('should validate when umbilical.validate is provided', () => {
      let validationResult = null;
      const umbilical = {
        validate: (validator) => {
          validationResult = validator({
            dom: document.createElement('div'),
            onModelChange: () => {}
          });
        }
      };

      GraphEditor.create(umbilical);
      expect(validationResult).toBe(true);
    });

    it('should fail validation without required dom', () => {
      let validationResult = null;
      const umbilical = {
        validate: (validator) => {
          validationResult = validator({
            onModelChange: () => {}
          });
        }
      };

      GraphEditor.create(umbilical);
      expect(validationResult).toBe(false);
    });

    it('should fail validation without required onModelChange', () => {
      let validationResult = null;
      const umbilical = {
        validate: (validator) => {
          validationResult = validator({
            dom: document.createElement('div')
          });
        }
      };

      GraphEditor.create(umbilical);
      expect(validationResult).toBe(false);
    });

    it('should fail validation with wrong types', () => {
      let validationResult = null;
      const umbilical = {
        validate: (validator) => {
          validationResult = validator({
            dom: 'not-a-dom-element',
            onModelChange: 'not-a-function'
          });
        }
      };

      GraphEditor.create(umbilical);
      expect(validationResult).toBe(false);
    });

    it('should pass validation with all optional params', () => {
      let validationResult = null;
      const umbilical = {
        validate: (validator) => {
          validationResult = validator({
            dom: document.createElement('div'),
            onModelChange: () => {},
            width: 800,
            height: 600,
            theme: 'light',
            onSelectionChange: () => {},
            onNodeClick: () => {},
            onNodeDoubleClick: () => {},
            onEdgeClick: () => {},
            onBackgroundClick: () => {},
            onError: () => {}
          });
        }
      };

      GraphEditor.create(umbilical);
      expect(validationResult).toBe(true);
    });
  });

  describe('Instance Mode', () => {
    let container;
    let umbilical;

    beforeEach(() => {
      container = document.createElement('div');
      umbilical = {
        dom: container,
        onModelChange: () => {}
      };
    });

    it('should create instance with required parameters', () => {
      const instance = GraphEditor.create(umbilical);
      
      expect(instance).toBeDefined();
      expect(typeof instance.destroy).toBe('function');
      expect(typeof instance.getModel).toBe('function');
      expect(typeof instance.getViewModel).toBe('function');
      expect(typeof instance.getView).toBe('function');
    });

    it('should append editor to provided DOM element', () => {
      const instance = GraphEditor.create(umbilical);
      
      expect(container.children.length).toBeGreaterThan(0);
      expect(container.querySelector('.graph-editor')).toBeTruthy();
    });

    it('should use default dimensions when not provided', () => {
      const instance = GraphEditor.create(umbilical);
      const editorElement = container.querySelector('.graph-editor');
      
      expect(editorElement.style.width).toBe('100%');
      expect(editorElement.style.height).toBe('400px');
    });

    it('should use provided dimensions', () => {
      umbilical.width = 800;
      umbilical.height = 600;
      
      const instance = GraphEditor.create(umbilical);
      const editorElement = container.querySelector('.graph-editor');
      
      expect(editorElement.style.width).toBe('800px');
      expect(editorElement.style.height).toBe('600px');
    });

    it('should apply theme class', () => {
      umbilical.theme = 'dark';
      
      const instance = GraphEditor.create(umbilical);
      const editorElement = container.querySelector('.graph-editor');
      
      expect(editorElement.classList.contains('graph-editor--dark')).toBe(true);
    });

    it('should clean up on destroy', () => {
      const instance = GraphEditor.create(umbilical);
      
      instance.destroy();
      
      expect(container.children.length).toBe(0);
      expect(() => instance.getModel()).toThrow();
    });

    it('should handle multiple instances', () => {
      const container2 = document.createElement('div');
      const umbilical2 = {
        dom: container2,
        onModelChange: () => {}
      };

      const instance1 = GraphEditor.create(umbilical);
      const instance2 = GraphEditor.create(umbilical2);

      expect(instance1).not.toBe(instance2);
      expect(container.querySelector('.graph-editor')).toBeTruthy();
      expect(container2.querySelector('.graph-editor')).toBeTruthy();

      instance1.destroy();
      instance2.destroy();
    });

    it('should call onError when provided and error occurs', () => {
      const errorCallback = [];
      umbilical.onError = (error) => errorCallback.push(error);
      
      const instance = GraphEditor.create(umbilical);
      
      // Simulate an error
      instance._handleError(new Error('Test error'));
      
      expect(errorCallback).toHaveLength(1);
      expect(errorCallback[0].message).toBe('Test error');
    });
  });

  describe('Component Lifecycle', () => {
    let container;
    let umbilical;
    let instance;

    let callbacks;
    
    beforeEach(() => {
      container = document.createElement('div');
      callbacks = { mount: [], destroy: [] };
      umbilical = {
        dom: container,
        onModelChange: () => {},
        onMount: (instance) => callbacks.mount.push(instance),
        onDestroy: () => callbacks.destroy.push(true)
      };
    });

    afterEach(() => {
      if (instance && !instance._destroyed) {
        instance.destroy();
      }
    });

    it('should call onMount after creation', () => {
      instance = GraphEditor.create(umbilical);
      
      expect(callbacks.mount).toHaveLength(1);
      expect(callbacks.mount[0]).toBe(instance);
    });

    it('should call onDestroy when destroyed', () => {
      instance = GraphEditor.create(umbilical);
      instance.destroy();
      
      expect(callbacks.destroy).toHaveLength(1);
    });

    it('should prevent double destruction', () => {
      instance = GraphEditor.create(umbilical);
      
      instance.destroy();
      expect(() => instance.destroy()).not.toThrow();
      
      expect(callbacks.destroy).toHaveLength(1);
    });
  });
});