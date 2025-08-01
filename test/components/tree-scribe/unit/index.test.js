/**
 * TreeScribe Component Tests
 * 
 * Comprehensive testing of TreeScribe umbilical component with TDD approach
 */

import { TreeScribe } from '../../../../../../src/components/tree-scribe/index.js';

describe('TreeScribe Component', () => {
  let container;
  let instance;
  
  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    if (instance && instance.destroy) {
      instance.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });
  
  describe('Umbilical Protocol Compliance', () => {
    test('should support introspection mode', () => {
      let requirements = null;
      
      TreeScribe.create({
        describe: (reqs) => {
          requirements = reqs.getAll();
        }
      });
      
      expect(requirements).toBeDefined();
      expect(requirements.dom).toBeDefined();
      expect(requirements.dom.type).toBe('HTMLElement');
      expect(requirements.dom.description).toBe('Parent DOM element for rendering');
      expect(requirements.yamlContent).toBeDefined();
      expect(requirements.theme).toBeDefined();
      expect(requirements.plugins).toBeDefined();
      expect(requirements.onNodeToggle).toBeDefined();
    });
    
    test('should support validation mode', () => {
      const validation = TreeScribe.create({
        validate: (checks) => {
          expect(checks).toBeDefined();
          expect(checks.hasDomElement).toBeDefined();
          expect(checks.hasValidTheme).toBeDefined();
          expect(checks.hasValidPlugins).toBeDefined();
          expect(checks.hasValidCallbacks).toBeDefined();
          return checks;
        }
      });
      
      expect(validation).toBeDefined();
      expect(validation.hasDomElement).toBeDefined();
    });
    
    test('should validate DOM element correctly', () => {
      const validValidation = TreeScribe.create({
        validate: (checks) => checks,
        dom: container
      });
      
      const invalidValidation = TreeScribe.create({
        validate: (checks) => checks,
        dom: null
      });
      
      expect(validValidation.hasDomElement).toBe(true);
      expect(invalidValidation.hasDomElement).toBe(false);
    });
    
    test('should validate theme correctly', () => {
      const validTheme = TreeScribe.create({
        validate: (checks) => checks,
        dom: container,
        theme: 'dark'
      });
      
      const invalidTheme = TreeScribe.create({
        validate: (checks) => checks,
        dom: container,
        theme: 'invalid'
      });
      
      expect(validTheme.hasValidTheme).toBe(true);
      expect(invalidTheme.hasValidTheme).toBe(false);
    });
    
    test('should validate plugins correctly', () => {
      const validPlugins = TreeScribe.create({
        validate: (checks) => checks,
        dom: container,
        plugins: []
      });
      
      const invalidPlugins = TreeScribe.create({
        validate: (checks) => checks,
        dom: container,
        plugins: 'not-an-array'
      });
      
      expect(validPlugins.hasValidPlugins).toBe(true);
      expect(invalidPlugins.hasValidPlugins).toBe(false);
    });
    
    test('should validate callbacks correctly', () => {
      const validCallbacks = TreeScribe.create({
        validate: (checks) => checks,
        dom: container,
        onNodeToggle: () => {},
        onSearch: () => {}
      });
      
      const invalidCallbacks = TreeScribe.create({
        validate: (checks) => checks,
        dom: container,
        onNodeToggle: 'not-a-function'
      });
      
      expect(validCallbacks.hasValidCallbacks).toBe(true);
      expect(invalidCallbacks.hasValidCallbacks).toBe(false);
    });
  });
  
  describe('Error Handling', () => {
    test('should throw error for missing DOM', () => {
      expect(() => {
        TreeScribe.create({
          dom: null
        });
      }).toThrow();
    });
    
    test('should throw error for invalid DOM', () => {
      expect(() => {
        TreeScribe.create({
          dom: 'not-a-dom-element'
        });
      }).toThrow();
    });
  });
});